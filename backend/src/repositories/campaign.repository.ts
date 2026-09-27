import { prisma } from "../config/database";
import { Prisma, Campaign, CampaignStatus } from "@prisma/client";

export class CampaignRepository {
  /**
   * Create a new campaign.
   */
  async create(data: Prisma.CampaignCreateInput): Promise<Campaign> {
    return prisma.campaign.create({ data });
  }

  /**
   * Find a campaign by its primary key.
   * Optionally include related emailMessages.
   */
  async findById(
    id: string,
    includeMessages = false
  ): Promise<Campaign | null> {
    return prisma.campaign.findUnique({
      where: { id },
      include: includeMessages ? { emailMessages: true } : undefined,
    });
  }

  /**
   * Find all campaigns belonging to a specific user.
   * Optionally filter by status.
   */
  async findByUser(
    userId: string,
    status?: CampaignStatus
  ): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update an existing campaign by ID.
   */
  async update(
    id: string,
    data: Prisma.CampaignUpdateInput
  ): Promise<Campaign> {
    return prisma.campaign.update({
      where: { id },
      data,
    });
  }
}

export const campaignRepository = new CampaignRepository();
