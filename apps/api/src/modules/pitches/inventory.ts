import type {
  AvailableSlot,
  BlockingRange,
  Money,
  PitchAvailabilityRule,
  PitchBlock,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";

const ALGIERS_OFFSET_MS = 60 * 60 * 1000; // UTC+1 (60 minutes)
const MAX_QUERY_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

export interface ComputeAvailableSlotsParams {
  hourlyRate: Money;
  rules: PitchAvailabilityRule[];
  blocks: PitchBlock[];
  from: Date;
  to: Date;
  durationMinutes: number;
  extraBlocks?: BlockingRange[];
}

/**
 * Given a UTC Date, returns the Algiers local year, month, date, and day of week.
 */
export function getAlgiersLocalDate(utcDate: Date): {
  year: number;
  month: number;
  date: number;
  dayOfWeek: number;
} {
  const localMs = utcDate.getTime() + ALGIERS_OFFSET_MS;
  const d = new Date(localMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    dayOfWeek: d.getUTCDay(),
  };
}

/**
 * Given an Algiers calendar date (year, month, date), returns the UTC timestamp
 * corresponding to midnight (00:00) in Algiers.
 */
export function getAlgiersMidnightUTC(year: number, month: number, date: number): number {
  return Date.UTC(year, month, date, 0, 0, 0) - ALGIERS_OFFSET_MS;
}

/**
 * Computes exact UTC available slots for a pitch within [from, to] for durationMinutes.
 * Translates active recurring rules in Africa/Algiers to UTC, and subtracts active blocks
 * and any extra blocking ranges (e.g. bookings).
 */
export function computeAvailableSlots({
  hourlyRate,
  rules,
  blocks,
  from,
  to,
  durationMinutes,
  extraBlocks = [],
}: ComputeAvailableSlotsParams): AvailableSlot[] {
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new HttpError(400, "Invalid from or to timestamp");
  }
  if (to.getTime() <= from.getTime()) {
    throw new HttpError(400, "to timestamp must be after from timestamp");
  }
  if (to.getTime() - from.getTime() > MAX_QUERY_RANGE_MS) {
    throw new HttpError(400, "Query range cannot exceed 31 days");
  }
  if (durationMinutes < 30 || durationMinutes > 180) {
    throw new HttpError(400, "durationMinutes must be between 30 and 180");
  }

  const activeRules = rules.filter((r) => r.isActive);
  if (activeRules.length === 0) {
    return [];
  }

  // Active blocks: cancelledAt must be null/undefined
  const activeBlocks: BlockingRange[] = blocks
    .filter((b) => !b.cancelledAt)
    .map((b) => ({
      startAt: new Date(b.startAt),
      endAt: new Date(b.endAt),
    }));

  const allBlockers: BlockingRange[] = [...activeBlocks, ...extraBlocks];

  const slots: AvailableSlot[] = [];

  // Determine starting and ending Algiers local calendar days
  const fromLocal = getAlgiersLocalDate(from);
  const toLocal = getAlgiersLocalDate(to);

  // We iterate day by day in Algiers local time
  let currentMidnightUTC = getAlgiersMidnightUTC(
    fromLocal.year,
    fromLocal.month,
    fromLocal.date,
  );
  const endMidnightUTC = getAlgiersMidnightUTC(toLocal.year, toLocal.month, toLocal.date);

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  while (currentMidnightUTC <= endMidnightUTC) {
    const local = getAlgiersLocalDate(new Date(currentMidnightUTC + ALGIERS_OFFSET_MS));
    const dayOfWeek = local.dayOfWeek;

    const dayRules = activeRules.filter((r) => r.dayOfWeek === dayOfWeek);

    for (const rule of dayRules) {
      let slotStartMinute = rule.startMinute;

      while (slotStartMinute + durationMinutes <= rule.endMinute) {
        const slotStartMs = currentMidnightUTC + slotStartMinute * 60 * 1000;
        const slotEndMs = slotStartMs + durationMinutes * 60 * 1000;

        const slotStart = new Date(slotStartMs);
        const slotEnd = new Date(slotEndMs);

        // Check if slot falls within [from, to]
        if (slotStart.getTime() >= from.getTime() && slotEnd.getTime() <= to.getTime()) {
          // Check for overlap with any blocker
          const isBlocked = allBlockers.some(
            (blocker) =>
              blocker.startAt.getTime() < slotEnd.getTime() &&
              blocker.endAt.getTime() > slotStart.getTime(),
          );

          if (!isBlocked) {
            const priceAmountMinor = Math.round(
              (hourlyRate.amountMinor * durationMinutes) / 60,
            );

            slots.push({
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
              price: {
                amountMinor: priceAmountMinor,
                currency: "DZD",
              },
            });
          }
        }

        slotStartMinute += durationMinutes;
      }
    }

    currentMidnightUTC += ONE_DAY_MS;
  }

  // Preserve chronological ordering
  slots.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return slots;
}
