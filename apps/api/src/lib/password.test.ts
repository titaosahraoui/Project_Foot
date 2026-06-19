import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a hash that differs from the plaintext", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(hash).not.toBe("s3cret-password");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPassword(hash, "s3cret-password")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });
});
