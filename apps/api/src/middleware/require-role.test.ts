import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireRole } from "./require-role";

function requestWithContext(
  userId?: string,
  userRoles?: Request["userRoles"],
): Request {
  return { userId, userRoles } as Request;
}

const response = {} as Response;

describe("requireRole", () => {
  it("returns UNAUTHENTICATED when prior authentication context is absent", () => {
    const next = vi.fn() as NextFunction;

    expect(() =>
      requireRole("PLAYER")(requestWithContext(), response, next),
    ).toThrowError(
      expect.objectContaining({ status: 401, code: "UNAUTHENTICATED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when none of the allowed roles match", () => {
    const next = vi.fn() as NextFunction;

    expect(() =>
      requireRole("PITCH_OWNER", "ADMIN")(
        requestWithContext("user-01", ["PLAYER"]),
        response,
        next,
      ),
    ).toThrowError(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next exactly once when any allowed global role matches", () => {
    const next = vi.fn() as NextFunction;

    requireRole("PITCH_OWNER", "ADMIN")(
      requestWithContext("user-01", ["PLAYER", "ADMIN"]),
      response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});
