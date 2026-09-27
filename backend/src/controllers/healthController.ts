import { Request, Response } from "express";
import { checkDatabaseConnection } from "../config/database.js";
import { checkRedisConnection } from "../config/redis.js";
import { checkElasticsearchConnection } from "../services/elasticsearchService.js";

async function probe(check: () => Promise<boolean>, timeoutMs = 2000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      check(),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        timer.unref();
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  const [mysql, redis, elasticsearch] = await Promise.all([
    probe(async () => { await checkDatabaseConnection(); return true; }),
    probe(checkRedisConnection),
    probe(checkElasticsearchConnection),
  ]);
  const components = {
    application: "ok",
    mysql: mysql ? "ok" : "unavailable",
    redis: redis ? "ok" : "unavailable",
    elasticsearch: elasticsearch ? "ok" : "unavailable",
  } as const;

  res.status(200).json({
    status: components.mysql === "ok" && components.redis === "ok" ? "ok" : "degraded",
    components,
  });
};
