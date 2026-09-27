import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../config/redis.js";
import { config } from "../config/index.js";
import { EMAIL_QUEUE_NAME, emailQueue } from "../queues/emailQueue.js";
import type { EmailJobData } from "../queues/emailQueue.js";
import { emailMessageRepository } from "../repositories/email-message.repository.js";
import { deliverEmail } from "../services/email.service.js";
import { syncEmailIndex } from "../services/elasticsearchService.js";
import { notifyRateLimitHit } from "../services/slackService.js";
import { checkRateLimit, reserveMinimumSendDelay } from "../utils/rateLimiter.js";

/**
 * Email send worker.
 *
 * Responsibilities:
 * 1. Receive job from BullMQ
 * 2. Atomically claim the email (SCHEDULED → PROCESSING)
 * 3. Apply Redis-based hourly rate limit
 * 4. Send via Ethereal SMTP
 * 5. Update MySQL status (SENT / FAILED)
 * 6. Reschedule if rate-limited
 */

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailRecordId, userId, senderEmail, recipientEmail, subject, body, maxPerHour } = job.data;

  console.info(JSON.stringify({ event: "EMAIL_PROCESSING", jobId: job.id, emailId: emailRecordId }));

  // ── Step 1: Idempotency check — claim the email atomically ─────────
  const email = await emailMessageRepository.claimForProcessing(emailRecordId);

  if (!email) {
    // Already processed (SENT/FAILED/PROCESSING by another worker)
    console.info(JSON.stringify({ event: "email.processing.skipped", emailId: emailRecordId }));
    return;
  }

  void syncEmailIndex(emailRecordId);

  console.info(JSON.stringify({ event: "email.claimed", emailId: emailRecordId, attempt: email.attempts }));

  const minDelayWait = await reserveMinimumSendDelay(
    senderEmail,
    config.worker.minEmailDelayMs
  );
  if (minDelayWait > 0) {
    await reschedule(job, minDelayWait, "spacing");
    return;
  }

  // ── Step 2: Rate limit check ───────────────────────────────────────
  const rateCheck = await checkRateLimit(senderEmail, maxPerHour);

  if (!rateCheck.allowed) {
    const hourWindow = new Date().toISOString().slice(0, 13).replace("T", "-");
    void notifyRateLimitHit(userId, senderEmail, hourWindow);
    console.info(JSON.stringify({
      event: "email.rate_limited",
      emailId: emailRecordId,
      senderEmail,
      current: rateCheck.current,
      limit: rateCheck.limit,
    }));
    await reschedule(job, rateCheck.retryAfterMs, "hourly-limit");
    return;
  }

  // ── Step 4: Send email via Ethereal SMTP ───────────────────────────
  let delivery: Awaited<ReturnType<typeof deliverEmail>>;
  try {
    delivery = await deliverEmail({
      senderEmail,
      recipientEmail,
      subject,
      body,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await emailMessageRepository.markFailed(emailRecordId, errorMsg);
    void syncEmailIndex(emailRecordId);

    console.error(JSON.stringify({
      event: "EMAIL_FAILED",
      emailId: emailRecordId,
      recipient: recipientEmail,
      error: errorMsg,
    }));
    return;
  }

  await emailMessageRepository.markSent(emailRecordId, delivery);
  void syncEmailIndex(emailRecordId);
  console.info(JSON.stringify({
    event: "EMAIL_SENT",
    emailId: emailRecordId,
    recipient: recipientEmail,
    messageId: delivery.messageId,
    previewUrl: delivery.previewUrl,
  }));
}

async function reschedule(
  job: Job<EmailJobData>,
  delayMs: number,
  reason: string
): Promise<void> {
  const scheduledAt = new Date(Date.now() + Math.max(1, delayMs));
  const reset = await emailMessageRepository.rescheduleFromProcessing(
    job.data.emailRecordId,
    scheduledAt
  );
  if (!reset) return;
  void syncEmailIndex(job.data.emailRecordId);

  await emailQueue.add("send", job.data, {
    jobId: `email-${job.data.emailRecordId}-${reason}-${Date.now()}`,
    delay: Math.max(1, delayMs),
  });
  console.info(JSON.stringify({
    event: "email.rescheduled",
    emailId: job.data.emailRecordId,
    reason,
    scheduledAt: scheduledAt.toISOString(),
    delayMs,
  }));
}

/**
 * Start the email worker.
 * Returns the Worker instance for lifecycle management.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: createRedisConnection(),
      concurrency: config.worker.concurrency,
    }
  );

  worker.on("completed", (job) => {
    console.info(JSON.stringify({ event: "email.job.completed", jobId: job.id }));
  });

  worker.on("failed", (job, err) => {
    console.error(JSON.stringify({ event: "email.job.failed", jobId: job?.id, error: err.message }));
  });

  worker.on("error", (err) => {
    console.error(JSON.stringify({ event: "email.worker.error", error: err.message }));
  });

  console.info(JSON.stringify({
    event: "email.worker.started",
    concurrency: config.worker.concurrency,
  }));

  return worker;
}
