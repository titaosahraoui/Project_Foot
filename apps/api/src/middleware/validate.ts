import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

/**
 * Validates a request part against a Zod schema, replacing it with the parsed
 * (typed, coerced) value. Throws ZodError, handled by the error middleware.
 */
export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[part]);
    // Reassign so downstream handlers receive the coerced value.
    (req as unknown as Record<RequestPart, unknown>)[part] = parsed;
    next();
  };
}
