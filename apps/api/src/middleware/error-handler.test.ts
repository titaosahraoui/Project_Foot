import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiErrorResponseSchema } from "@footconnect/shared";
import { errorHandler, HttpError, notFound } from "./error-handler";
import { requestId } from "./request-id";

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn() },
}));

function createErrorApp(error: unknown, includeRequestId = false): Express {
  const app = express();
  if (includeRequestId) app.use(requestId);
  app.get("/error", (_req, _res, next) => next(error));
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("returns validation errors with the canonical code and issues", async () => {
    const validationError = z
      .object({ name: z.string().min(1) })
      .safeParse({ name: "" });
    if (validationError.success)
      throw new Error("Expected the fixture to fail validation");

    const response = await request(createErrorApp(validationError.error)).get(
      "/error",
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.issues).toHaveLength(1);
    expect(apiErrorResponseSchema.parse(response.body)).toEqual(response.body);
  });

  it("preserves an explicit HttpError code and details", async () => {
    const error = new HttpError(
      409,
      "Challenge state changed",
      "STATE_CONFLICT",
      {
        currentState: "ACCEPTED",
      },
    );

    const response = await request(createErrorApp(error)).get("/error");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: "STATE_CONFLICT",
      message: "Challenge state changed",
      details: { currentState: "ACCEPTED" },
    });
  });

  it("maps existing two-argument HttpError call sites by status", async () => {
    const response = await request(
      createErrorApp(new HttpError(404, "Team not found")),
    ).get("/error");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "NOT_FOUND",
      message: "Team not found",
    });
  });

  it("hides unexpected error internals", async () => {
    const response = await request(
      createErrorApp(new Error("database password leaked")),
    ).get("/error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "database password leaked",
    );
  });

  it("includes the request ID established for the Express request", async () => {
    const response = await request(
      createErrorApp(new HttpError(403, "Forbidden"), true),
    )
      .get("/error")
      .set("x-request-id", "request-error-test-01");

    expect(response.status).toBe(403);
    expect(response.body.requestId).toBe("request-error-test-01");
  });
});

describe("notFound", () => {
  it("uses the canonical not-found response", async () => {
    const app = express();
    app.use(notFound);

    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: "NOT_FOUND", message: "Not found" });
  });
});
