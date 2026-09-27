import app from "./app.js";
import { config } from "./config/index.js";
import { checkDatabaseConnection, prisma } from "./config/database.js";
import { checkRedisConnection, redisConnection } from "./config/redis.js";
import { emailQueue } from "./queues/emailQueue.js";
import { closeElasticsearchConnection } from "./services/elasticsearchService.js";

async function startApi(): Promise<void> {
  const server = app.listen(config.port, () => {
    console.info(JSON.stringify({
      event: "api.started",
      environment: config.nodeEnv,
      port: config.port,
    }));
  });

  void reportDependency("mysql", async () => {
    await checkDatabaseConnection();
    return true;
  });
  void reportDependency("redis", checkRedisConnection);
  void reportDependency("bullmq", async () => {
    await emailQueue.waitUntilReady();
    return true;
  });

  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (signal: string): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      console.info(JSON.stringify({ event: "api.shutdown.started", signal }));
      await new Promise<void>((resolve) => {
        server.close((error) => {
          if (error) {
            console.error(JSON.stringify({ event: "api.shutdown.http_error", error: error.name }));
          }
          resolve();
        });
      });
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

async function reportDependency(
  dependency: string,
  check: () => Promise<boolean>,
  timeoutMs = 2500
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const available = await Promise.race([
      check(),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        timer.unref();
      }),
    ]);
    console.info(JSON.stringify({
      event: available ? "api.dependency.ready" : "api.dependency.unavailable",
      dependency,
    }));
  } catch (error) {
    console.warn(JSON.stringify({
      event: "api.dependency.unavailable",
      dependency,
      error: error instanceof Error ? error.name : "unknown",
    }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeResource(name: string, close: () => Promise<unknown>): Promise<void> {
  try {
    await close();
  } catch (error) {
    console.error(JSON.stringify({
      event: "api.shutdown.resource_error",
      resource: name,
      error: error instanceof Error ? error.name : "unknown",
    }));
  }
}

void startApi().catch(async (error: unknown) => {
  console.error(JSON.stringify({
    event: "api.startup.failed",
    error: error instanceof Error ? error.name : "unknown",
  }));
  await closeResource("queue", () => emailQueue.close());
  await closeResource("elasticsearch", closeElasticsearchConnection);
  await closeResource("redis", () => redisConnection.quit());
  await closeResource("prisma", () => prisma.$disconnect());
  process.exitCode = 1;
});
