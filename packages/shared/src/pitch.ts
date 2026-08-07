import { z } from "zod";

export const pitchSurfaceSchema = z.enum([
  "NATURAL_GRASS",
  "ARTIFICIAL_TURF",
  "INDOOR_PARQUET",
  "CONCRETE",
]);
export type PitchSurface = z.infer<typeof pitchSurfaceSchema>;

export const pitchSizeSchema = z.enum([
  "FIVE_A_SIDE",
  "SEVEN_A_SIDE",
  "ELEVEN_A_SIDE",
]);
export type PitchSize = z.infer<typeof pitchSizeSchema>;

export const createPitchSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  surface: pitchSurfaceSchema,
  size: pitchSizeSchema,
  pricePerHour: z.number().min(0),
  amenities: z.array(z.string()).optional().default([]),
  photos: z.array(z.string().url()).optional().default([]),
});
export type CreatePitchInput = z.infer<typeof createPitchSchema>;

export const updatePitchSchema = createPitchSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdatePitchInput = z.infer<typeof updatePitchSchema>;

export const pitchSlotSchema = z.object({
  id: z.string().uuid(),
  pitchId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isBookable: z.boolean(),
});
export type PitchSlot = z.infer<typeof pitchSlotSchema>;

export const createPitchSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isBookable: z.boolean().optional().default(true),
});
export type CreatePitchSlotInput = z.infer<typeof createPitchSlotSchema>;

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
  size: pitchSizeSchema,
  pricePerHour: z.number(),
  amenities: z.array(z.string()),
  photos: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Pitch = z.infer<typeof pitchSchema>;

export const pitchDetailSchema = pitchSchema.extend({
  slots: z.array(pitchSlotSchema),
});
export type PitchDetail = z.infer<typeof pitchDetailSchema>;

export const pitchQuerySchema = z.object({
  city: z.string().optional(),
  surface: pitchSurfaceSchema.optional(),
  size: pitchSizeSchema.optional(),
  maxPrice: z.coerce.number().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().optional().default(10),
});
export type PitchQuery = z.infer<typeof pitchQuerySchema>;
