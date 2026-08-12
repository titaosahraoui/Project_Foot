import { describe, expect, it } from "vitest";
import {
  coordinatesSchema,
  currencyCodeSchema,
  geoPointSchema,
  idempotencyKeySchema,
  matchFormatSchema,
  moneySchema,
  utcDateTimeSchema,
} from "./index";

describe("matchFormatSchema", () => {
  it.each(["FIVE_A_SIDE", "SEVEN_A_SIDE", "ELEVEN_A_SIDE"])(
    "accepts the canonical format %s",
    (format) => {
      expect(matchFormatSchema.parse(format)).toBe(format);
    },
  );

  it("rejects unsupported formats", () => {
    expect(matchFormatSchema.safeParse("NINE_A_SIDE").success).toBe(false);
  });
});

describe("currencyCodeSchema", () => {
  it("accepts DZD", () => {
    expect(currencyCodeSchema.parse("DZD")).toBe("DZD");
  });

  it("rejects other currencies", () => {
    expect(currencyCodeSchema.safeParse("EUR").success).toBe(false);
  });
});

describe("moneySchema", () => {
  it("accepts a safe non-negative integer amount in DZD", () => {
    expect(moneySchema.parse({ amountMinor: 5000, currency: "DZD" })).toEqual({
      amountMinor: 5000,
      currency: "DZD",
    });
  });

  it.each([-1, 12.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid minor-unit amount %s",
    (amountMinor) => {
      expect(
        moneySchema.safeParse({ amountMinor, currency: "DZD" }).success,
      ).toBe(false);
    },
  );

  it("rejects money in a non-DZD currency", () => {
    expect(
      moneySchema.safeParse({ amountMinor: 5000, currency: "USD" }).success,
    ).toBe(false);
  });
});

describe("utcDateTimeSchema", () => {
  it.each(["2026-08-11T18:00:00Z", "2026-08-11T19:00:00+01:00"])(
    "accepts and preserves an ISO 8601 timestamp with timezone: %s",
    (timestamp) => {
      expect(utcDateTimeSchema.parse(timestamp)).toBe(timestamp);
    },
  );

  it("rejects a timestamp without an explicit timezone", () => {
    expect(utcDateTimeSchema.safeParse("2026-08-11T18:00:00").success).toBe(
      false,
    );
  });
});

describe("geoPointSchema", () => {
  it("reuses and accepts the shared coordinates contract", () => {
    expect(geoPointSchema).toBe(coordinatesSchema);
    expect(geoPointSchema.parse({ lat: 36.7538, lng: 3.0588 })).toEqual({
      lat: 36.7538,
      lng: 3.0588,
    });
  });

  it.each([
    { lat: 91, lng: 3.0588 },
    { lat: 36.7538, lng: 181 },
  ])("rejects out-of-range coordinates: $lat, $lng", (coordinates) => {
    expect(geoPointSchema.safeParse(coordinates).success).toBe(false);
  });
});

describe("idempotencyKeySchema", () => {
  it.each(["match-01", "challenge:algiers:captain-01"])(
    "accepts a visible ASCII key: %s",
    (key) => {
      expect(idempotencyKeySchema.parse(key)).toBe(key);
    },
  );

  it.each(["short", "contains space", "clé-match", "a".repeat(129)])(
    "rejects an invalid idempotency key",
    (key) => {
      expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
    },
  );
});
