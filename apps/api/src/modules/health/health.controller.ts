import type { Request, Response } from "express";
import { getHealth } from "./health.service";

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const health = await getHealth();
  const code = health.status === "down" ? 503 : 200;
  res.status(code).json(health);
}
