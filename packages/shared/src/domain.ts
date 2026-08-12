import { z } from "zod";
import { coordinatesSchema } from "./common";

export const matchFormatSchema = z.enum([
  "FIVE_A_SIDE",
  "SEVEN_A_SIDE",
  "ELEVEN_A_SIDE",
]);
export type MatchFormat = z.infer<typeof matchFormatSchema>;

export const currencyCodeSchema = z.literal("DZD");
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative().safe(),
  currency: currencyCodeSchema,
});
export type Money = z.infer<typeof moneySchema>;

export const utcDateTimeSchema = z.string().datetime({ offset: true });
export type UtcDateTime = z.infer<typeof utcDateTimeSchema>;

export const geoPointSchema = coordinatesSchema;
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const idempotencyKeySchema = z.string().regex(/^[\x21-\x7e]{8,128}$/);
export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;
