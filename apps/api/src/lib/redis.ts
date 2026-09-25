import { Redis } from "@upstash/redis";
import { env } from "../config/env";

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });

// Upstash Redis uses stateless HTTP REST and does not hold persistent TCP sockets.
// Provide a no-op disconnect for backward compatibility with shutdown routines.
(redis as unknown as { disconnect: () => void }).disconnect = () => undefined;

export async function checkRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
