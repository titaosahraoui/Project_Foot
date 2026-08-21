import { z } from "zod";
import {
  matchFormatSchema,
  type MatchFormat,
  moneySchema,
  type Money,
} from "./domain";

export const pitchSurfaceSchema = z.enum([
  "NATURAL_GRASS",
  "ARTIFICIAL_TURF",
  "INDOOR_PARQUET",
  "CONCRETE",
]);
export type PitchSurface = z.infer<typeof pitchSurfaceSchema>;

/**
 * Deprecated alias of matchFormatSchema during the migration so pitch and match formats cannot diverge.
 */
export const pitchSizeSchema = matchFormatSchema;
export type PitchSize = MatchFormat;

export function timeStringToMinutes(time: string): number {
  const parts = time.split(":");
  const hStr = parts[0];
  const mStr = parts[1];
  if (parts.length !== 2 || hStr === undefined || mStr === undefined) {
    throw new Error(`Invalid time string: ${time}`);
  }
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) {
    throw new Error(`Invalid time string: ${time}`);
  }
  return h * 60 + m;
}

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export const pitchAvailabilityRuleSchema = z.object({
  id: z.string().uuid(),
  pitchId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  startTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/),
  timezone: z.literal("Africa/Algiers").default("Africa/Algiers"),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PitchAvailabilityRule = z.infer<typeof pitchAvailabilityRuleSchema>;

export const setPitchAvailabilityRuleItemSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440).optional(),
    endMinute: z.number().int().min(0).max(1440).optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/).optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/).optional(),
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    const startMinute =
      data.startMinute !== undefined
        ? data.startMinute
        : data.startTime
          ? timeStringToMinutes(data.startTime)
          : undefined;
    const endMinute =
      data.endMinute !== undefined
        ? data.endMinute
        : data.endTime
          ? timeStringToMinutes(data.endTime)
          : undefined;
    return {
      dayOfWeek: data.dayOfWeek,
      startMinute: startMinute!,
      endMinute: endMinute!,
      isActive: data.isActive ?? true,
    };
  })
  .refine((data) => data.startMinute !== undefined && data.endMinute !== undefined, {
    message: "startMinute/startTime and endMinute/endTime are required",
  })
  .refine((data) => data.endMinute > data.startMinute, {
    message: "endMinute must be greater than startMinute",
    path: ["endMinute"],
  })
  .refine((data) => data.endMinute - data.startMinute >= 30, {
    message: "Availability rule must be at least 30 minutes long",
    path: ["endMinute"],
  });
export type SetPitchAvailabilityRuleItemInput = z.input<typeof setPitchAvailabilityRuleItemSchema>;
export type SetPitchAvailabilityRuleItem = z.output<typeof setPitchAvailabilityRuleItemSchema>;

export const setPitchAvailabilityRulesSchema = z.object({
  rules: z.array(setPitchAvailabilityRuleItemSchema),
});
export type SetPitchAvailabilityRulesInput = z.input<typeof setPitchAvailabilityRulesSchema>;
export type SetPitchAvailabilityRulesPayload = z.output<typeof setPitchAvailabilityRulesSchema>;

/**
 * Deprecated PitchSlot schema kept for backwards compatibility until M05-T06.
 */
export const pitchSlotSchema = z.object({
  id: z.string().uuid(),
  pitchId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/),
  isBookable: z.boolean(),
});
export type PitchSlot = z.infer<typeof pitchSlotSchema>;

export const createPitchSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]|24):[0-5]\d$/),
  isBookable: z.boolean().optional().default(true),
});
export type CreatePitchSlotInput = z.infer<typeof createPitchSlotSchema>;

export const createPitchSchema = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    address: z.string().min(5).max(200),
    city: z.string().min(2).max(100),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    surface: pitchSurfaceSchema,
    format: matchFormatSchema.optional(),
    size: pitchSizeSchema.optional(), // deprecated alias
    hourlyRate: moneySchema,
    amenities: z.array(z.string()).optional().default([]),
    photos: z.array(z.string().url()).optional().default([]),
  })
  .refine((data) => data.format !== undefined || data.size !== undefined, {
    message: "Either format or size must be provided",
    path: ["format"],
  });
export type CreatePitchInput = z.infer<typeof createPitchSchema>;

export const updatePitchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  address: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  surface: pitchSurfaceSchema.optional(),
  format: matchFormatSchema.optional(),
  size: pitchSizeSchema.optional(),
  hourlyRate: moneySchema.optional(),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePitchInput = z.infer<typeof updatePitchSchema>;

export const pitchSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  surface: pitchSurfaceSchema,
  format: matchFormatSchema,
  size: pitchSizeSchema, // deprecated alias
  hourlyRate: moneySchema,
  amenities: z.array(z.string()),
  photos: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Pitch = z.infer<typeof pitchSchema>;

export const pitchDetailSchema = pitchSchema.extend({
  availabilityRules: z.array(pitchAvailabilityRuleSchema),
  slots: z.array(pitchSlotSchema).default([]), // deprecated alias
});
export type PitchDetail = z.infer<typeof pitchDetailSchema>;

export const pitchQuerySchema = z.object({
  city: z.string().optional(),
  surface: pitchSurfaceSchema.optional(),
  format: matchFormatSchema.optional(),
  size: pitchSizeSchema.optional(),
  maxPriceMinor: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(), // alias/back-compat for minor units
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().optional().default(10),
});
export type PitchQuery = z.infer<typeof pitchQuerySchema>;

/**
 * Format a DZD Money instance as human-readable standard copy.
 * e.g. amountMinor: 400000 -> "4,000 DZD", amountMinor: 8000 -> "80 DZD".
 * Never uses '$'.
 */
export function formatPitchPrice(hourlyRate: Money): string {
  const major = hourlyRate.amountMinor / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(major);
  return `${formatted} DZD`;
}
