import { PrismaClient } from "@prisma/client";
import { config } from "./index";

/**
 * Singleton PrismaClient instance.
 * In development, the client is cached on `globalThis` to survive
 * hot-reloads without creating new connections.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDev ? ["query", "error", "warn"] : ["error"],
  });

if (config.isDev) {
  globalForPrisma.prisma = prisma;
}

/**
 * Test database connectivity. Returns true if connected, throws otherwise.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
