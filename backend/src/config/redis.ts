import IORedis from "ioredis";
import { config } from "./index.js";

function reportRedisError(error: Error): void {
  console.warn(JSON.stringify({
    event: "redis.connection.error",
    error: error.name,
  }));
}

function attachErrorHandler(connection: IORedis): IORedis {
  connection.on("error", reportRedisError);
  return connection;
}

/**
 * Shared Redis connection for BullMQ and rate limiting.
 * Uses ioredis which BullMQ requires.
 */
export const redisConnection = attachErrorHandler(config.redis.url
  ? new IORedis(config.redis.url, { maxRetriesPerRequest: null })
  : new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    }));

/**
 * Create a new ioredis instance (for BullMQ workers that need their own connection).
 */
export function createRedisConnection(): IORedis {
  return attachErrorHandler(config.redis.url
    ? new IORedis(config.redis.url, { maxRetriesPerRequest: null })
    : new IORedis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
      }));
}

/**
 * Test Redis connectivity.
 */
export async function checkRedisConnection(): Promise<boolean> {
  const pong = await redisConnection.ping();
  return pong === "PONG";
}
