import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt";

describe("access tokens", () => {
  it("round-trips userId and roles", () => {
    const token = signAccessToken({ userId: "u1", roles: ["PLAYER"] });
    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe("u1");
    expect(payload.roles).toEqual(["PLAYER"]);
  });

  it("throws on a tampered token", () => {
    const token = signAccessToken({ userId: "u1", roles: ["PLAYER"] });
    expect(() => verifyAccessToken(token + "tampered")).toThrow();
  });
});

describe("refresh tokens", () => {
  it("round-trips userId and jti", () => {
    const token = signRefreshToken("u1", "jti-123");
    const payload = verifyRefreshToken(token);
    expect(payload.userId).toBe("u1");
    expect(payload.jti).toBe("jti-123");
  });

  it("rejects an access token presented as a refresh token", () => {
    const access = signAccessToken({ userId: "u1", roles: ["PLAYER"] });
    expect(() => verifyRefreshToken(access)).toThrow();
  });
});
