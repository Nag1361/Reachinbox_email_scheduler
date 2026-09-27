import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

/**
 * BullMQ email queue.
 *
 * Each job carries the emailRecordId and is scheduled with a BullMQ delay.
 * Jobs use deterministic IDs: `email-{emailRecordId}` for idempotency.
 */

export const EMAIL_QUEUE_NAME = "email-send";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 }, // Keep last 1000 for debugging
    removeOnFail: { count: 5000 },
    attempts: 1, // Retries are handled by the worker + reschedule logic
  },
});

export interface EmailJobData {
  emailRecordId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  maxPerHour: number;
}

/**
 * Add a single email job to the queue with a BullMQ delay.
 *
 * @param data - Job payload
 * @param delayMs - Delay in ms from now before the job becomes active
 */
export async function enqueueEmail(
  data: EmailJobData,
  delayMs: number
): Promise<string> {
  const jobId = `email-${data.emailRecordId}`;
  const job = await emailQueue.add("send", data, {
    jobId,
    delay: Math.max(0, delayMs),
  });
  return job.id ?? jobId;
}
