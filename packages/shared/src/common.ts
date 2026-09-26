import { z } from "zod";

/** A UUID identifier used across all entities. */
export const idSchema = z.string().uuid();
export type Id = z.infer<typeof idSchema>;

/** Standard pagination query params. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** A paginated response envelope. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Geographic coordinates, shared by users, teams, and pitches. */
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/** Stable machine-readable codes returned by the API error boundary. */
export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "STATE_CONFLICT",
  "INVENTORY_CONFLICT",
  "CONDITIONS_VIOLATION",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Canonical response envelope for expected and unexpected API errors. */
export const apiErrorResponseSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  issues: z.array(z.unknown()).optional(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
