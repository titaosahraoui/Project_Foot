import type { Request, Response } from "express";
import { loginSchema, refreshSchema, registerSchema } from "@footconnect/shared";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/error-handler";
import * as service from "./auth.service";

const REFRESH_COOKIE = "fc_refresh";
const COOKIE_PATH = "/api/v1/auth";

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: COOKIE_PATH,
  });
}

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await service.register(input);
  setRefreshCookie(res, result.refreshToken!);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await service.login(input);
  setRefreshCookie(res, result.refreshToken!);
  res.json(result);
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const body = refreshSchema.parse(req.body ?? {});
  // Web sends the refresh token via httpOnly cookie; mobile sends it in the body.
  const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? body.refreshToken;
  if (!token) throw new HttpError(401, "No refresh token provided");

  const result = await service.refresh(token);
  setRefreshCookie(res, result.refreshToken!);
  res.json(result);
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token =
    (req.cookies?.[REFRESH_COOKIE] as string | undefined) ??
    (req.body?.refreshToken as string | undefined);
  await service.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  res.status(204).send();
}
