import { prisma } from "../config/database.js";
import { enqueueEmail, emailQueue } from "../queues/emailQueue.js";
import type { EmailJobData } from "../queues/emailQueue.js";
import { config } from "../config/index.js";
import { emailMessageRepository } from "../repositories/email-message.repository.js";
import { indexEmailDocument } from "./elasticsearchService.js";

/**
 * Input for scheduling a batch of emails.
 */
export interface ScheduleEmailsInput {
  userId: string;
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string; // ISO 8601
  delayBetweenEmails: number; // ms between each recipient
  hourlyLimit: number;
}

/**
 * Result of scheduling a batch of emails.
 */
export interface ScheduleEmailsResult {
  scheduled: number;
  campaignId: string;
  emailIds: string[];
  firstSendAt: string;
  lastSendAt: string;
}

/**
 * Schedule a batch of emails.
 *
 * 1. Creates a SenderAccount (or reuses) — simplified for the assignment
 * 2. Creates a Campaign
 * 3. Creates individual EmailMessage records in MySQL
 * 4. Enqueues BullMQ delayed jobs for each recipient
 */
export async function scheduleEmails(
  input: ScheduleEmailsInput
): Promise<ScheduleEmailsResult> {
  const startTimeMs = new Date(input.startTime).getTime();
  const now = Date.now();

  // ── Create/find a SenderAccount ────────────────────────────────────
  // For the assignment, we use Ethereal SMTP config from env
  let senderAccount = await prisma.senderAccount.findFirst({
    where: { email: input.senderEmail, userId: input.userId },
  });

  if (!senderAccount) {
    senderAccount = await prisma.senderAccount.create({
      data: {
        email: input.senderEmail,
        displayName: input.senderEmail,
        smtpHost: config.ethereal.host,
        smtpPort: config.ethereal.port,
        smtpUser: config.ethereal.user || "pending",
        smtpPass: config.ethereal.password || "pending",
        userId: input.userId,
      },
    });
  }

  // ── Create Campaign ────────────────────────────────────────────────
  const { campaign, emailRecords } = await prisma.$transaction(async (tx) => {
    const createdCampaign = await tx.campaign.create({
      data: {
        name: `Campaign ${new Date().toISOString()}`,
        subject: input.subject,
        body: input.body,
        status: "ACTIVE",
        scheduledAt: new Date(input.startTime),
        totalRecipients: input.recipients.length,
        userId: senderAccount!.userId,
        senderAccountId: senderAccount!.id,
      },
    });
    const createdEmails = await Promise.all(
      input.recipients.map((recipientEmail, index) =>
        tx.emailMessage.create({
          data: {
            recipientEmail,
            subject: input.subject,
            body: input.body,
            scheduledAt: new Date(startTimeMs + index * input.delayBetweenEmails),
            hourlyLimit: input.hourlyLimit,
            campaignId: createdCampaign.id,
            senderAccountId: senderAccount!.id,
          },
        })
      )
    );
    return { campaign: createdCampaign, emailRecords: createdEmails };
  });

  for (const record of emailRecords) {
    void indexEmailDocument({
      id: record.id,
      userId: input.userId,
      senderEmail: input.senderEmail,
      recipientEmail: record.recipientEmail,
      subject: record.subject,
      body: record.body,
      status: record.status,
      scheduledAt: record.scheduledAt,
      sentAt: record.sentAt,
      createdAt: record.createdAt,
    });
  }

  // ── Enqueue BullMQ delayed jobs ────────────────────────────────────
  const emailIds: string[] = [];

  for (let i = 0; i < emailRecords.length; i++) {
    const record = emailRecords[i];
    const scheduledAtMs = record.scheduledAt.getTime();
    const delayMs = Math.max(0, scheduledAtMs - now);

    const jobData: EmailJobData = {
      emailRecordId: record.id,
      userId: input.userId,
      senderEmail: input.senderEmail,
      recipientEmail: record.recipientEmail,
      subject: record.subject,
      body: record.body,
      maxPerHour: input.hourlyLimit,
    };

    await enqueueEmail(jobData, delayMs);
    emailIds.push(record.id);

    console.info(JSON.stringify({
      event: "email.scheduled",
      emailId: record.id,
      recipient: record.recipientEmail,
      delayMs,
      scheduledAt: record.scheduledAt.toISOString(),
    }));
  }

  const firstSendAt = emailRecords[0].scheduledAt.toISOString();
  const lastSendAt = emailRecords[emailRecords.length - 1].scheduledAt.toISOString();

  console.info(JSON.stringify({
    event: "campaign.scheduled",
    campaignId: campaign.id,
    count: emailRecords.length,
    firstSendAt,
    lastSendAt,
  }));

  return {
    scheduled: emailRecords.length,
    campaignId: campaign.id,
    emailIds,
    firstSendAt,
    lastSendAt,
  };
}

/** Recreate missing BullMQ jobs for DB rows left scheduled after an interruption. */
export async function recoverScheduledEmails(): Promise<number> {
  const records = await emailMessageRepository.findScheduledForRecovery();
  let recovered = 0;

  for (const record of records) {
    const jobId = `email-${record.id}`;
    const existingJob = await emailQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state !== "failed") continue;
      await existingJob.remove();
    }

    const delayMs = Math.max(0, record.scheduledAt.getTime() - Date.now());
    await enqueueEmail({
      emailRecordId: record.id,
      userId: record.senderAccount.userId,
      senderEmail: record.senderAccount.email,
      recipientEmail: record.recipientEmail,
      subject: record.subject,
      body: record.body,
      maxPerHour: record.hourlyLimit,
    }, delayMs);
    recovered += 1;
  }

  console.info(JSON.stringify({ event: "email.recovery.completed", recovered }));
  return recovered;
}

/**
 * Get all scheduled (pending) email messages.
 */
export async function getScheduledEmails(userId: string) {
  return prisma.emailMessage.findMany({
    where: { status: "SCHEDULED", senderAccount: { userId } },
    orderBy: { scheduledAt: "asc" },
  });
}

/**
 * Get all sent email messages.
 */
export async function getSentEmails(userId: string) {
  return prisma.emailMessage.findMany({
    where: { status: "SENT", senderAccount: { userId } },
    orderBy: { sentAt: "desc" },
  });
}

/**
 * Get a single email message by ID.
 */
export async function getEmailById(id: string, userId: string) {
  return prisma.emailMessage.findFirst({
    where: { id, senderAccount: { userId } },
  });
}
