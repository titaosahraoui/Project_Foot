import type { AvailabilityStatus } from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";

export interface TimeWindow {
  startAt: Date;
  endAt: Date;
}

export interface AvailabilityWindowItem extends TimeWindow {
  id?: string;
  status: AvailabilityStatus | string;
}

/**
 * Checks whether two time windows strictly overlap.
 * Windows are considered half-open [startAt, endAt), so touching boundaries (adjacent windows) do NOT overlap.
 */
export function hasWindowOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return (
    a.startAt.getTime() < b.endAt.getTime() &&
    a.endAt.getTime() > b.startAt.getTime()
  );
}

/**
 * Asserts that the requested window does not overlap any existing OPEN window for the team.
 * Throws 409 CONFLICT if an overlap is detected.
 */
export function assertNoOpenOverlap(
  candidate: TimeWindow,
  existing: AvailabilityWindowItem[],
  excludeId?: string,
): void {
  for (const item of existing) {
    if (item.id && excludeId && item.id === excludeId) continue;
    if (item.status !== "OPEN") continue;
    if (hasWindowOverlap(candidate, item)) {
      throw new HttpError(
        409,
        "Team already has an open availability overlapping this time window",
      );
    }
  }
}

/**
 * Asserts that the availability can be cancelled.
 * MATCHED availabilities cannot be cancelled through this command.
 */
export function assertCanCancelAvailability(status: AvailabilityStatus): void {
  if (status === "MATCHED") {
    throw new HttpError(409, "Matched availability cannot be cancelled");
  }
}

/**
 * Determines whether an OPEN availability has expired (endAt or expiresAt is in the past).
 */
export function isAvailabilityDue(
  record: {
    status: AvailabilityStatus | string;
    endAt: Date;
    expiresAt: Date;
    startAt?: Date;
  },
  now: Date,
): boolean {
  if (record.status !== "OPEN") return false;
  return (
    record.endAt.getTime() <= now.getTime() ||
    record.expiresAt.getTime() <= now.getTime()
  );
}
