import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../prisma-mock";
import { EmailMessageRepository } from "../../src/repositories/email-message.repository";

const repo = new EmailMessageRepository();

const mockMessage = {
  id: "msg-1",
  campaignId: "camp-1",
  senderAccountId: "sender-1",
  recipientEmail: "recipient@example.com",
  recipientName: "Recipient",
  subject: "Hello",
  body: "World",
  status: "SCHEDULED" as const,
  scheduledAt: new Date("2024-06-01T10:00:00Z"),
  sentAt: null,
  messageId: null,
  previewUrl: null,
  failedAt: null,
  errorMessage: null,
  attempts: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmailMessageRepository", () => {
  describe("create", () => {
    it("should create a single email message", async () => {
      prismaMock.emailMessage.create.mockResolvedValue(mockMessage);

      const result = await repo.create({
        recipientEmail: "recipient@example.com",
        subject: "Hello",
        body: "World",
        scheduledAt: new Date("2024-06-01T10:00:00Z"),
        campaign: { connect: { id: "camp-1" } },
        senderAccount: { connect: { id: "sender-1" } },
      });

      expect(prismaMock.emailMessage.create).toHaveBeenCalled();
      expect(result.recipientEmail).toBe("recipient@example.com");
    });
  });

  describe("createMany", () => {
    it("should create multiple messages and return count", async () => {
      prismaMock.emailMessage.createMany.mockResolvedValue({ count: 3 });

      const result = await repo.createMany([
        {
          campaignId: "camp-1",
          senderAccountId: "sender-1",
          recipientEmail: "a@test.com",
          subject: "S",
          body: "B",
          scheduledAt: new Date(),
        },
        {
          campaignId: "camp-1",
          senderAccountId: "sender-1",
          recipientEmail: "b@test.com",
          subject: "S",
          body: "B",
          scheduledAt: new Date(),
        },
        {
          campaignId: "camp-1",
          senderAccountId: "sender-1",
          recipientEmail: "c@test.com",
          subject: "S",
          body: "B",
          scheduledAt: new Date(),
        },
      ]);

      expect(result.count).toBe(3);
    });
  });

  describe("findById", () => {
    it("should find a message by ID", async () => {
      prismaMock.emailMessage.findUnique.mockResolvedValue(mockMessage);

      const result = await repo.findById("msg-1");

      expect(prismaMock.emailMessage.findUnique).toHaveBeenCalledWith({
        where: { id: "msg-1" },
      });
      expect(result).toEqual(mockMessage);
    });
  });

  describe("findScheduled", () => {
    it("should return scheduled messages up to cutoff with limit", async () => {
      prismaMock.emailMessage.findMany.mockResolvedValue([mockMessage]);
      const cutoff = new Date("2024-06-01T12:00:00Z");

      const result = await repo.findScheduled(cutoff, 50);

      expect(prismaMock.emailMessage.findMany).toHaveBeenCalledWith({
        where: {
          status: "SCHEDULED",
          scheduledAt: { lte: cutoff },
        },
        orderBy: { scheduledAt: "asc" },
        take: 50,
      });
      expect(result).toHaveLength(1);
    });

    it("should default limit to 100", async () => {
      prismaMock.emailMessage.findMany.mockResolvedValue([]);
      const cutoff = new Date();

      await repo.findScheduled(cutoff);

      expect(prismaMock.emailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe("findSent", () => {
    it("should return sent messages for a campaign", async () => {
      const sentMsg = { ...mockMessage, status: "SENT" as const, sentAt: new Date() };
      prismaMock.emailMessage.findMany.mockResolvedValue([sentMsg]);

      const result = await repo.findSent("camp-1");

      expect(prismaMock.emailMessage.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: "camp-1",
          status: "SENT",
        },
        orderBy: { sentAt: "asc" },
      });
      expect(result[0].status).toBe("SENT");
    });
  });

  describe("updateStatus", () => {
    it("should update status with extra fields", async () => {
      const updated = { ...mockMessage, status: "PROCESSING" as const, attempts: 1 };
      prismaMock.emailMessage.update.mockResolvedValue(updated);

      const result = await repo.updateStatus("msg-1", "PROCESSING" as any, { attempts: 1 });

      expect(prismaMock.emailMessage.update).toHaveBeenCalledWith({
        where: { id: "msg-1" },
        data: { status: "PROCESSING", attempts: 1 },
      });
      expect(result.status).toBe("PROCESSING");
    });
  });

  describe("claimForProcessing", () => {
    it("should return the claimed message when status is SCHEDULED", async () => {
      const claimed = { ...mockMessage, status: "PROCESSING" as const, attempts: 1 };

      // $transaction receives a callback; we mock it to execute the callback
      // with a mock tx that has $executeRaw (returns 1 row affected) and
      // emailMessage.findUnique (returns the claimed row).
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(1),
          emailMessage: { findUnique: vi.fn().mockResolvedValue(claimed) },
        };
        return cb(tx);
      });

      const result = await repo.claimForProcessing("msg-1");

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result).toEqual(claimed);
    });

    it("should return null when message is already claimed (no rows updated)", async () => {
      prismaMock.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(0),
          emailMessage: { findUnique: vi.fn() },
        };
        return cb(tx);
      });

      const result = await repo.claimForProcessing("msg-1");

      expect(result).toBeNull();
    });
  });

  describe("markSent", () => {
    it("should mark message as SENT with sentAt timestamp", async () => {
      const delivery = {
        messageId: "ethereal-message-1",
        previewUrl: "https://ethereal.email/message/preview-1",
      };
      const sent = {
        ...mockMessage,
        ...delivery,
        status: "SENT" as const,
        sentAt: new Date(),
      };
      prismaMock.emailMessage.update.mockResolvedValue(sent);

      const result = await repo.markSent("msg-1", delivery);

      expect(prismaMock.emailMessage.update).toHaveBeenCalledWith({
        where: { id: "msg-1" },
        data: {
          status: "SENT",
          sentAt: expect.any(Date),
          messageId: delivery.messageId,
          previewUrl: delivery.previewUrl,
        },
      });
      expect(result.status).toBe("SENT");
      expect(result.messageId).toBe(delivery.messageId);
      expect(result.previewUrl).toBe(delivery.previewUrl);
    });
  });

  describe("markFailed", () => {
    it("should mark message as FAILED with error message", async () => {
      const failed = {
        ...mockMessage,
        status: "FAILED" as const,
        failedAt: new Date(),
        errorMessage: "SMTP timeout",
      };
      prismaMock.emailMessage.update.mockResolvedValue(failed);

      const result = await repo.markFailed("msg-1", "SMTP timeout");

      expect(prismaMock.emailMessage.update).toHaveBeenCalledWith({
        where: { id: "msg-1" },
        data: {
          status: "FAILED",
          failedAt: expect.any(Date),
          errorMessage: "SMTP timeout",
        },
      });
      expect(result.errorMessage).toBe("SMTP timeout");
    });
  });

  describe("rescheduleFromProcessing", () => {
    it("returns the email to SCHEDULED with its next scheduled time", async () => {
      const scheduledAt = new Date("2026-09-28T10:00:00Z");
      prismaMock.emailMessage.updateMany.mockResolvedValue({ count: 1 });

      await expect(repo.rescheduleFromProcessing("msg-1", scheduledAt)).resolves.toBe(true);
      expect(prismaMock.emailMessage.updateMany).toHaveBeenCalledWith({
        where: { id: "msg-1", status: "PROCESSING" },
        data: { status: "SCHEDULED", scheduledAt },
      });
    });

    it("does not reschedule a message that is no longer PROCESSING", async () => {
      prismaMock.emailMessage.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.rescheduleFromProcessing("msg-1", new Date())).resolves.toBe(false);
    });
  });
});
