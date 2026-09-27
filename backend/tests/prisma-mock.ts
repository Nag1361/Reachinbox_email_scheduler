/**
 * Shared Prisma mock for all repository tests.
 *
 * Creates a mock PrismaClient whose model delegates
 * (user, senderAccount, campaign, emailMessage, slackConnection)
 * are replaced with vi.fn() stubs.
 *
 * Each test file imports the mock and configures return values
 * using mockResolvedValue / mockResolvedValueOnce.
 */
import { vi } from "vitest";

// Build mock delegate with common Prisma methods
function mockDelegate() {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  };
}

export const prismaMock = {
  user: mockDelegate(),
  senderAccount: mockDelegate(),
  campaign: mockDelegate(),
  emailMessage: mockDelegate(),
  slackConnection: mockDelegate(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
};

// Mock the database module so all repositories get the mock client
vi.mock("../src/config/database", () => ({
  prisma: prismaMock,
}));
