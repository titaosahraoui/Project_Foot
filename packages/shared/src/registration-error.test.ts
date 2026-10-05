import { describe, expect, it } from "vitest";
import {
  getLoginErrorMessage,
  getRegistrationErrorMessage,
} from "./registration-error";

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

describe("getLoginErrorMessage", () => {
  it("identifies invalid credentials on 401", () => {
    expect(getLoginErrorMessage({ status: 401 })).toBe(
      "Invalid email or password.",
    );
  });

  it("identifies rejected input details on 400", () => {
    expect(getLoginErrorMessage({ status: 400 })).toBe(
      "Check your email and password, then try again.",
    );
  });

  it("identifies rate limiting on 429", () => {
    expect(getLoginErrorMessage({ status: 429 })).toBe(
      "Too many sign-in attempts. Please try again later.",
    );
  });

  it("identifies server errors on 500", () => {
    expect(getLoginErrorMessage({ status: 500 })).toBe(
      "FootConnect server error. Please try again in a moment.",
    );
  });

  it("explains how to fix an unreachable API when TypeError is thrown", () => {
    expect(
      getLoginErrorMessage(
        new TypeError("Network request failed"),
        "http://192.168.100.116:4000",
      ),
    ).toBe(
      "Could not reach FootConnect at http://192.168.100.116:4000. Check that the API is running and this device can reach that address.",
    );
  });

  it("explains how to fix an unreachable API when fetch fails with generic Error message", () => {
    expect(
      getLoginErrorMessage(
        new Error("Failed to fetch"),
        "http://localhost:4000",
      ),
    ).toBe(
      "Could not reach FootConnect at http://localhost:4000. Check that the API is running and this device can reach that address.",
    );
  });

  it("falls back gracefully when baseUrl is not provided", () => {
    expect(getLoginErrorMessage(new Error("Network request failed"))).toBe(
      "Could not sign in. Please try again.",
    );
  });
});

