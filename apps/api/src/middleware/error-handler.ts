import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { ApiErrorCode, ApiErrorResponse } from "@footconnect/shared";
import { logger } from "../lib/logger";

function isZodValidationError(
  error: unknown,
): error is ZodError | { name: "ZodError"; issues: ZodError["issues"] } {
  if (error instanceof ZodError) return true;
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { name?: unknown; issues?: unknown };
  return candidate.name === "ZodError" && Array.isArray(candidate.issues);
}

const defaultErrorCodeByStatus: Readonly<Record<number, ApiErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "CONDITIONS_VIOLATION",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
};

function defaultErrorCode(status: number): ApiErrorCode {
  return defaultErrorCodeByStatus[status] ?? "INTERNAL_ERROR";
}

function requestIdFrom(req: Request, res: Response): string | undefined {
  const responseRequestId: unknown = res.locals.requestId;
  if (typeof responseRequestId === "string" && responseRequestId.length > 0) {
    return responseRequestId;
  }

  const requestRequestId = (req as Request & { id?: string | number }).id;
  if (
    typeof requestRequestId === "string" ||
    typeof requestRequestId === "number"
  ) {
    return String(requestRequestId);
  }

  return undefined;
}

function errorResponse(
  req: Request,
  res: Response,
  body: Omit<ApiErrorResponse, "requestId">,
): ApiErrorResponse {
  const requestId = requestIdFrom(req, res);
  return requestId ? { ...body, requestId } : body;
}

/** Error carrying an HTTP status code, thrown by modules for expected failures. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ApiErrorCode = defaultErrorCode(status),
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 404 handler for unmatched routes. */
export function notFound(req: Request, res: Response): void {
  res
    .status(404)
    .json(errorResponse(req, res, { code: "NOT_FOUND", message: "Not found" }));
}

/** Centralized error handler. Must be registered last. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isZodValidationError(err)) {
    res.status(400).json(
      errorResponse(req, res, {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        issues: err.issues,
      }),
    );
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json(
      errorResponse(req, res, {
        code: err.code,
        message: err.message,
        details: err.details,
      }),
    );
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json(
    errorResponse(req, res, {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    }),
  );
}
