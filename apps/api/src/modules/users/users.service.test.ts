import type { User } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { toAuthUser } from "./users.service";

const user: User = {
  id: "a3e71937-c162-4b16-a6c1-46272efd45f4",
  email: "player@example.com",
  passwordHash: "not-public",
  displayName: "Player One",
  roles: ["PLAYER"],
  skillLevel: "INTERMEDIATE",
  position: "MID",
  lat: 36.7538,
  lng: 3.0588,
  bio: null,
  avatarUrl: "https://example.com/avatar.png",
  createdAt: new Date("2026-08-12T12:00:00.000Z"),
  updatedAt: new Date("2026-08-12T12:00:00.000Z"),
};

describe("toAuthUser", () => {
  it("rejects a persisted free-form position at the public response boundary", () => {
    expect(() => toAuthUser({ ...user, position: "ST" })).toThrow();
  });
});
