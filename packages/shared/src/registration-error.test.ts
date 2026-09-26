import { describe, expect, it } from "vitest";
import { getRegistrationErrorMessage } from "./registration-error";

describe("getRegistrationErrorMessage", () => {
  it("identifies an existing email", () => {
    expect(getRegistrationErrorMessage({ status: 409 })).toBe(
      "An account already exists with this email.",
    );
  });

  it("identifies rejected registration details", () => {
    expect(getRegistrationErrorMessage({ status: 400 })).toBe(
      "Check your name, email, and password, then try again.",
    );
  });

  it("explains how to fix an unreachable API", () => {
    expect(
      getRegistrationErrorMessage(
        new TypeError("Failed to fetch"),
        "http://localhost:4000",
      ),
    ).toBe(
      "Could not reach FootConnect at http://localhost:4000. Check that the API is running and this device can reach that address.",
    );
  });

  it("does not mislabel unknown server failures as duplicate emails", () => {
    expect(getRegistrationErrorMessage(new Error("boom"))).toBe(
      "Could not create your account. Please try again.",
    );
  });
});
