import type { HealthStatus } from "@footconnect/shared";
import { checkDatabase } from "../../lib/prisma";
import { checkRedis } from "../../lib/redis";

/** Pure: derive the overall status from dependency health. Unit-tested. */
export function computeHealthStatus(db: boolean, redis: boolean): HealthStatus["status"] {
  if (db && redis) return "ok";
  if (db || redis) return "degraded";
  return "down";
}

/** Probe dependencies and build the health payload. */
export async function getHealth(): Promise<HealthStatus> {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return {
    status: computeHealthStatus(db, redis),
    db,
    redis,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
