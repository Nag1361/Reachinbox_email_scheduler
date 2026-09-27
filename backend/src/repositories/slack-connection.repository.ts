import { prisma } from "../config/database";
import { Prisma, SlackConnection } from "@prisma/client";

export class SlackConnectionRepository {
  /**
   * Find all Slack connections belonging to a specific user.
   */
  async findByUser(userId: string): Promise<SlackConnection[]> {
    return prisma.slackConnection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a new Slack connection.
   */
  async create(
    data: Prisma.SlackConnectionCreateInput
  ): Promise<SlackConnection> {
    return prisma.slackConnection.create({ data });
  }

  /**
   * Update an existing Slack connection by ID.
   */
  async update(
    id: string,
    data: Prisma.SlackConnectionUpdateInput
  ): Promise<SlackConnection> {
    return prisma.slackConnection.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a Slack connection by ID.
   */
  async delete(id: string): Promise<SlackConnection> {
    return prisma.slackConnection.delete({ where: { id } });
  }
}

export const slackConnectionRepository = new SlackConnectionRepository();
