import { describe, expect, it } from "vitest";
import { authUserSchema, registerSchema } from "./auth";
import { playerPositionSchema, updateProfileSchema } from "./user";

const authUser = {
  id: "a3e71937-c162-4b16-a6c1-46272efd45f4",
  email: "player@example.com",
  displayName: "Player One",
  roles: ["PLAYER"],
  skillLevel: "INTERMEDIATE",
  position: "MID",
  lat: 36.7538,
  lng: 3.0588,
  bio: null,
  avatarUrl: "https://example.com/avatar.png",
  createdAt: "2026-08-12T12:00:00.000Z",
} as const;

describe("playerPositionSchema", () => {
  it.each(["GK", "DEF", "MID", "FWD", "FLEX"])(
    "accepts the canonical %s position",
    (position) => {
      expect(playerPositionSchema.parse(position)).toBe(position);
    },
  );

  it("rejects free-form positions", () => {
    expect(playerPositionSchema.safeParse("ST").success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("trims display names before enforcing their bounds", () => {
    expect(updateProfileSchema.parse({ displayName: "  Amina  " })).toEqual({
      displayName: "Amina",
    });
    expect(updateProfileSchema.safeParse({ displayName: "   " }).success).toBe(
      false,
    );
    expect(
      updateProfileSchema.safeParse({ displayName: ` ${"a".repeat(51)} ` })
        .success,
    ).toBe(false);
  });

  it("requires an HTTPS avatar URL", () => {
    expect(
      updateProfileSchema.safeParse({ avatarUrl: "http://example.com/a.png" })
        .success,
    ).toBe(false);
    expect(
      updateProfileSchema.safeParse({ avatarUrl: "https://example.com/a.png" })
        .success,
    ).toBe(true);
  });

  it("requires latitude and longitude to be updated together", () => {
    expect(updateProfileSchema.safeParse({ lat: 36.75 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ lng: 3.05 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ lat: 36.75, lng: 3.05 }).success).toBe(
      true,
    );
  });

  it("enforces coordinate bounds", () => {
    expect(updateProfileSchema.safeParse({ lat: 91, lng: 3.05 }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({ lat: 36.75, lng: 181 }).success).toBe(
      false,
    );
  });

  it("supports explicit null clearing for nullable profile fields", () => {
    expect(
      updateProfileSchema.parse({
        position: null,
        skillLevel: null,
        bio: null,
        avatarUrl: null,
        lat: null,
        lng: null,
      }),
    ).toEqual({
      position: null,
      skillLevel: null,
      bio: null,
      avatarUrl: null,
      lat: null,
      lng: null,
    });
  });
});

describe("canonical auth profile contracts", () => {
  it("applies trimmed display names during registration", () => {
    expect(
      registerSchema.parse({
        email: "player@example.com",
        password: "password123",
        displayName: "  Amina  ",
      }).displayName,
    ).toBe("Amina");
  });

  it("rejects non-canonical AuthUser profile fields", () => {
    expect(authUserSchema.safeParse({ ...authUser, position: "ST" }).success).toBe(
      false,
    );
    expect(
      authUserSchema.safeParse({
        ...authUser,
        avatarUrl: "http://example.com/avatar.png",
      }).success,
    ).toBe(false);
    expect(
      authUserSchema.safeParse({ ...authUser, lat: 36.75, lng: null }).success,
    ).toBe(false);
  });
});
