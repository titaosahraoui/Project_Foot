import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

async function main(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    logger.info(`FootConnect API listening on http://localhost:${env.API_PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close();
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
