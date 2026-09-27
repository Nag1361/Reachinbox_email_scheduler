import { prisma } from "../config/database";
import { Prisma, User } from "@prisma/client";

export class UserRepository {
  /**
   * Find a user by their primary key.
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find a user by their Google OAuth ID.
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { googleId } });
  }

  /**
   * Find a user by email address.
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * Create a new user.
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  /**
   * Update an existing user by ID.
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}

export const userRepository = new UserRepository();
