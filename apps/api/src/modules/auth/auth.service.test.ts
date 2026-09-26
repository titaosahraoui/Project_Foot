import { beforeEach, describe, expect, it, vi } from "vitest";
import { signRefreshToken } from "../../lib/jwt";
import * as repo from "./auth.repository";
import { logout } from "./auth.service";

vi.mock("./auth.repository", () => ({
  revokeRefreshSession: vi.fn(),
}));

describe("logout", () => {
  beforeEach(() => {
    vi.mocked(repo.revokeRefreshSession).mockReset();
  });

  it("propagates a refresh-session revocation failure for a valid token", async () => {
    const failure = new Error("database unavailable");
    vi.mocked(repo.revokeRefreshSession).mockRejectedValue(failure);

    await expect(logout(signRefreshToken("user-1", "session-1"))).rejects.toBe(failure);
  });

  it("keeps invalid refresh tokens idempotent", async () => {
    await expect(logout("not-a-token")).resolves.toBeUndefined();
  });
});
