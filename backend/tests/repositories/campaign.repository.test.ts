import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../prisma-mock";
import { CampaignRepository } from "../../src/repositories/campaign.repository";

const repo = new CampaignRepository();

const mockCampaign = {
  id: "camp-1",
  userId: "user-1",
  senderAccountId: "sender-1",
  name: "Welcome Campaign",
  subject: "Welcome!",
  body: "Thanks for joining",
  status: "DRAFT" as const,
  scheduledAt: null,
  totalRecipients: 0,
  sentCount: 0,
  failedCount: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampaignRepository", () => {
  describe("create", () => {
    it("should create and return a new campaign", async () => {
      prismaMock.campaign.create.mockResolvedValue(mockCampaign);

      const result = await repo.create({
        name: "Welcome Campaign",
        subject: "Welcome!",
        body: "Thanks for joining",
        user: { connect: { id: "user-1" } },
        senderAccount: { connect: { id: "sender-1" } },
      });

      expect(prismaMock.campaign.create).toHaveBeenCalled();
      expect(result.name).toBe("Welcome Campaign");
    });
  });

  describe("findById", () => {
    it("should find a campaign by ID without messages", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(mockCampaign);

      const result = await repo.findById("camp-1");

      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "camp-1" },
        include: undefined,
      });
      expect(result).toEqual(mockCampaign);
    });

    it("should include emailMessages when requested", async () => {
      const withMessages = { ...mockCampaign, emailMessages: [] };
      prismaMock.campaign.findUnique.mockResolvedValue(withMessages);

      const result = await repo.findById("camp-1", true);

      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "camp-1" },
        include: { emailMessages: true },
      });
      expect(result).toHaveProperty("emailMessages");
    });
  });

  describe("findByUser", () => {
    it("should return all campaigns for a user", async () => {
      prismaMock.campaign.findMany.mockResolvedValue([mockCampaign]);

      const result = await repo.findByUser("user-1");

      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
    });

    it("should filter by status when provided", async () => {
      prismaMock.campaign.findMany.mockResolvedValue([]);

      await repo.findByUser("user-1", "ACTIVE");

      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("update", () => {
    it("should update and return the campaign", async () => {
      const updated = { ...mockCampaign, status: "ACTIVE" as const };
      prismaMock.campaign.update.mockResolvedValue(updated);

      const result = await repo.update("camp-1", { status: "ACTIVE" });

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: "camp-1" },
        data: { status: "ACTIVE" },
      });
      expect(result.status).toBe("ACTIVE");
    });
  });
});
