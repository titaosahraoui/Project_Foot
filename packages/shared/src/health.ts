import { z } from "zod";

/** Shape returned by the API `GET /health` endpoint. */
export const healthStatusSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  db: z.boolean(),
  redis: z.boolean(),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
});
export type HealthStatus = z.infer<typeof healthStatusSchema>;
