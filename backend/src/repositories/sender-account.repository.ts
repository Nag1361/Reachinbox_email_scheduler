import { prisma } from "../config/database";
import { Prisma, SenderAccount } from "@prisma/client";

export class SenderAccountRepository {
  /**
   * Find a sender account by its primary key.
   */
  async findById(id: string): Promise<SenderAccount | null> {
    return prisma.senderAccount.findUnique({ where: { id } });
  }

  /**
   * Find all sender accounts belonging to a specific user.
   */
  async findByUser(userId: string): Promise<SenderAccount[]> {
    return prisma.senderAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a new sender account.
   */
  async create(data: Prisma.SenderAccountCreateInput): Promise<SenderAccount> {
    return prisma.senderAccount.create({ data });
  }

  /**
   * Update an existing sender account by ID.
   */
  async update(
    id: string,
    data: Prisma.SenderAccountUpdateInput
  ): Promise<SenderAccount> {
    return prisma.senderAccount.update({
      where: { id },
      data,
    });
  }
}

export const senderAccountRepository = new SenderAccountRepository();
