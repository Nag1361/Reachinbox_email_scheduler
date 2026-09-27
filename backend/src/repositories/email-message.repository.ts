import { prisma } from "../config/database";
import { Prisma, EmailMessage, EmailStatus } from "@prisma/client";

export class EmailMessageRepository {
  /**
   * Create a single email message.
   */
  async create(data: Prisma.EmailMessageCreateInput): Promise<EmailMessage> {
    return prisma.emailMessage.create({ data });
  }

  /**
   * Create multiple email messages in a single transaction.
   * Uses createManyAndReturn when available, falls back to createMany.
   */
  async createMany(
    data: Prisma.EmailMessageCreateManyInput[]
  ): Promise<{ count: number }> {
    return prisma.emailMessage.createMany({ data });
  }

  /**
   * Find an email message by its primary key.
   */
  async findById(id: string): Promise<EmailMessage | null> {
    return prisma.emailMessage.findUnique({ where: { id } });
  }

  async findScheduledForRecovery() {
    return prisma.emailMessage.findMany({
      where: { status: EmailStatus.SCHEDULED },
      include: { senderAccount: true },
      orderBy: { scheduledAt: "asc" },
    });
  }

  /**
   * Find all scheduled messages that are due for sending.
   * Returns messages whose scheduledAt is at or before the given cutoff.
   */
  async findScheduled(cutoff: Date, limit = 100): Promise<EmailMessage[]> {
    return prisma.emailMessage.findMany({
      where: {
        status: EmailStatus.SCHEDULED,
        scheduledAt: { lte: cutoff },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });
  }

  /**
   * Find all sent messages for a given campaign.
   */
  async findSent(campaignId: string): Promise<EmailMessage[]> {
    return prisma.emailMessage.findMany({
      where: {
        campaignId,
        status: EmailStatus.SENT,
      },
      orderBy: { sentAt: "asc" },
    });
  }

  /**
   * Update the status of an email message by ID.
   */
  async updateStatus(
    id: string,
    status: EmailStatus,
    extra?: Partial<Pick<EmailMessage, "sentAt" | "failedAt" | "errorMessage" | "attempts">>
  ): Promise<EmailMessage> {
    return prisma.emailMessage.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  /**
   * Atomically claim a SCHEDULED message for processing.
   *
   * Uses a raw UPDATE ... WHERE to ensure the transition
   * SCHEDULED → PROCESSING only happens if the message is
   * currently SCHEDULED. This prevents race conditions when
   * multiple workers try to claim the same message.
   *
   * MySQL does not support UPDATE ... RETURNING, so we use a
   * two-step approach within a transaction: UPDATE then SELECT.
   * The WHERE clause guarantees atomicity — only one worker
   * can successfully update a given row.
   *
   * Returns the claimed message, or null if the message was
   * already claimed (no rows updated).
   */
  async claimForProcessing(id: string): Promise<EmailMessage | null> {
    return prisma.$transaction(async (tx) => {
      // Atomic compare-and-swap: only transitions SCHEDULED → PROCESSING
      const result = await tx.$executeRaw`
        UPDATE email_messages
        SET
          status = ${EmailStatus.PROCESSING},
          attempts = attempts + 1,
          updated_at = NOW()
        WHERE id = ${id}
          AND status = ${EmailStatus.SCHEDULED}
      `;

      // If no rows were updated, the message was already claimed
      if (result === 0) return null;

      // Fetch the updated row
      return tx.emailMessage.findUnique({ where: { id } });
    });
  }

  /**
   * Mark an email message as successfully sent.
   */
  async markSent(
    id: string,
    delivery: { messageId: string; previewUrl: string | null }
  ): Promise<EmailMessage> {
    return prisma.emailMessage.update({
      where: { id },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        messageId: delivery.messageId,
        previewUrl: delivery.previewUrl,
      },
    });
  }

  /**
   * Mark an email message as failed with an error message.
   */
  async markFailed(id: string, errorMessage: string): Promise<EmailMessage> {
    return prisma.emailMessage.update({
      where: { id },
      data: {
        status: EmailStatus.FAILED,
        failedAt: new Date(),
        errorMessage,
      },
    });
  }

  async rescheduleFromProcessing(id: string, scheduledAt: Date): Promise<boolean> {
    const result = await prisma.emailMessage.updateMany({
      where: { id, status: EmailStatus.PROCESSING },
      data: { status: EmailStatus.SCHEDULED, scheduledAt },
    });
    return result.count === 1;
  }
}

export const emailMessageRepository = new EmailMessageRepository();
