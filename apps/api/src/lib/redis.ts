import Redis from "ioredis";
import { env } from "../config/env";

// Lazy-connecting Redis client so the API can boot even if Redis is briefly down.
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

export async function checkRedis(): Promise<boolean> {
  try {
    if (redis.status !== "ready") {
      await redis.connect().catch(() => undefined);
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
