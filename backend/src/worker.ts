import { checkDatabaseConnection, prisma } from "./config/database.js";
import { checkRedisConnection, redisConnection } from "./config/redis.js";
import { emailQueue } from "./queues/emailQueue.js";
import { recoverScheduledEmails } from "./services/emailService.js";
import { closeElasticsearchConnection } from "./services/elasticsearchService.js";
import { startEmailWorker } from "./workers/emailWorker.js";

async function startWorkerProcess(): Promise<void> {
  await checkDatabaseConnection();
  await checkRedisConnection();
  await emailQueue.waitUntilReady();
  await recoverScheduledEmails();

  const worker = startEmailWorker();
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (signal: string): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      console.info(JSON.stringify({ event: "worker.shutdown.started", signal }));
      await closeResource("worker", () => worker.close());
      await closeResource("queue", () => emailQueue.close());
      await closeResource("elasticsearch", closeElasticsearchConnection);
      await closeResource("redis", () => redisConnection.quit());
      await closeResource("prisma", () => prisma.$disconnect());
      process.exitCode = 0;
    })();
    return shutdownPromise;
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

async function closeResource(name: string, close: () => Promise<unknown>): Promise<void> {
  try {
    await close();
  } catch (error) {
    console.error(JSON.stringify({
      event: "worker.shutdown.resource_error",
      resource: name,
      error: error instanceof Error ? error.name : "unknown",
    }));
  }
}

void startWorkerProcess().catch(async (error: unknown) => {
  console.error(JSON.stringify({
    event: "worker.startup.failed",
    error: error instanceof Error ? error.name : "unknown",
  }));
  await closeResource("worker_queue", () => emailQueue.close());
  await closeResource("elasticsearch", closeElasticsearchConnection);
  await closeResource("redis", () => redisConnection.quit());
  await closeResource("prisma", () => prisma.$disconnect());
  process.exitCode = 1;
});