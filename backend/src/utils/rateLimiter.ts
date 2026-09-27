import { redisConnection } from "../config/redis.js";
import { config } from "../config/index.js";

/**
 * Redis-based hourly rate limiter for email sending.
 *
 * Key pattern: email-rate:{senderEmail}:{YYYY-MM-DD-HH}
 *
 * Uses atomic INCR + EXPIRE to track per-sender hourly sends.
 * Safe across multiple workers and backend instances.
 */

/**
 * Build the Redis key for the current hour window.
 */
function buildRateKey(senderEmail: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  return `email-rate:${senderEmail.trim().toLowerCase()}:${yyyy}-${mm}-${dd}-${hh}`;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  retryAfterMs: number; // ms until next hour window opens
}

/**
 * Check and atomically increment the send count for this sender in this hour.
 *
 * @returns RateLimitResult indicating whether the send is allowed.
 *          If not allowed, retryAfterMs indicates when the next window opens.
 */
export async function checkRateLimit(
  senderEmail: string,
  maxPerHour: number = config.worker.maxEmailsPerHour
): Promise<RateLimitResult> {
  const now = new Date();
  const key = buildRateKey(senderEmail, now);
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const expirySeconds = Math.ceil((nextHour.getTime() - now.getTime()) / 1000) + 60;
  const result = (await redisConnection.eval(
    `local current = tonumber(redis.call('GET', KEYS[1]) or '0')
     local limit = tonumber(ARGV[1])
     if current >= limit then return {0, current} end
     current = redis.call('INCR', KEYS[1])
     if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
     return {1, current}`,
    1,
    key,
    String(maxPerHour),
    String(expirySeconds)
  )) as [number, number];

  if (Number(result[0]) === 0) {
    return {
      allowed: false,
      current: Number(result[1]),
      limit: maxPerHour,
      retryAfterMs: nextHour.getTime() - now.getTime() + 1000,
    };
  }

  return {
    allowed: true,
    current: Number(result[1]),
    limit: maxPerHour,
    retryAfterMs: 0,
  };
}

/** Reserve a sender-wide spacing window without relying on process-local timers. */
export async function reserveMinimumSendDelay(
  senderEmail: string,
  delayMs: number
): Promise<number> {
  if (delayMs <= 0) return 0;

  const key = `email-send-gap:${senderEmail.toLowerCase()}`;
  const reserved = await redisConnection.set(key, "1", "PX", delayMs, "NX");
  if (reserved === "OK") return 0;

  const remainingMs = await redisConnection.pttl(key);
  return remainingMs > 0 ? remainingMs : delayMs;
}
