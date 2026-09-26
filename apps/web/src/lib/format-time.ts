import {
  minutesToTimeString as sharedMinutesToTimeString,
  timeStringToMinutes as sharedTimeStringToMinutes,
} from "@footconnect/shared";

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const ALGIERS_TIMEZONE = "Africa/Algiers";

export function minutesToTimeString(minutes: number): string {
  return sharedMinutesToTimeString(minutes);
}

export function timeStringToMinutes(time: string): number {
  return sharedTimeStringToMinutes(time);
}

export function formatTimeRange(startMinute: number, endMinute: number): string {
  return `${minutesToTimeString(startMinute)} – ${minutesToTimeString(endMinute)}`;
}

/**
 * Format a Date or ISO string into local Algiers 24h time ("HH:mm").
 */
export function formatAlgiersTime(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  return d.toLocaleTimeString("en-GB", {
    timeZone: ALGIERS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format a Date or ISO string into local Algiers date ("Sun, Aug 23").
 */
export function formatAlgiersDate(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  return d.toLocaleDateString("en-US", {
    timeZone: ALGIERS_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a Date or ISO string into local Algiers date and time ("Sun, Aug 23, 18:00").
 */
export function formatAlgiersDateTime(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  return `${formatAlgiersDate(d)}, ${formatAlgiersTime(d)}`;
}

/**
 * Extract the day of week (0 = Sunday, 6 = Saturday) in the Africa/Algiers timezone.
 */
export function getAlgiersDayOfWeek(dateOrIso: Date | string): number {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  const dayStr = d.toLocaleDateString("en-US", {
    timeZone: ALGIERS_TIMEZONE,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[dayStr] ?? 0;
}

/**
 * Convert local Algiers date string (YYYY-MM-DD) and time string (HH:mm) into a UTC ISO string.
 * Africa/Algiers is fixed UTC+1 (offset +01:00).
 */
export function algiersLocalToUtcIso(dateStr: string, timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = (hours ?? "00").padStart(2, "0");
  const m = (minutes ?? "00").padStart(2, "0");
  return new Date(`${dateStr}T${h}:${m}:00+01:00`).toISOString();
}

/**
 * Convert a UTC ISO string back into local Algiers date and time components.
 */
export function utcIsoToAlgiersLocal(isoString: string): { dateStr: string; timeStr: string } {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ALGIERS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}`,
  };
}

export interface WeekDayInfo {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // "Sun", "Mon", etc.
  dateLabel: string; // "Aug 23"
  fullLabel: string; // "Sunday, Aug 23"
}

export interface WeekBoundaries {
  from: string; // UTC ISO string (start of Sunday 00:00:00 in Algiers)
  to: string; // UTC ISO string (end of Saturday 23:59:59.999 in Algiers)
  weekLabel: string; // "Aug 23 – Aug 29, 2026"
  days: WeekDayInfo[];
}

/**
 * Calculate the week boundaries in Africa/Algiers timezone for a given week offset.
 * Week runs Sunday (0) to Saturday (6).
 */
export function getWeekBoundaries(referenceDate?: Date, weekOffset = 0): WeekBoundaries {
  const now = referenceDate ?? new Date();

  // Get current year, month, day in Algiers
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ALGIERS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "2026");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  const currentDayOfWeek = getAlgiersDayOfWeek(now);

  // Reference date at midnight Algiers time
  const currentMidnightAlgiers = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  // Shift to Sunday of this week:
  const sundayMs =
    currentMidnightAlgiers.getTime() +
    (-currentDayOfWeek + weekOffset * 7) * 24 * 60 * 60 * 1000;

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(sundayMs + i * 24 * 60 * 60 * 1000);
    const y = dayDate.getUTCFullYear();
    const m = String(dayDate.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(dayDate.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${dStr}`;

    const labelDate = new Date(`${dateStr}T12:00:00+01:00`);
    days.push({
      dayOfWeek: i,
      dateStr,
      dayLabel: SHORT_DAYS[i] ?? "",
      dateLabel: labelDate.toLocaleDateString("en-US", {
        timeZone: ALGIERS_TIMEZONE,
        month: "short",
        day: "numeric",
      }),
      fullLabel: labelDate.toLocaleDateString("en-US", {
        timeZone: ALGIERS_TIMEZONE,
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    });
  }

  const firstDay = days[0]!;
  const lastDay = days[6]!;

  const from = algiersLocalToUtcIso(firstDay.dateStr, "00:00");
  const to = new Date(`${lastDay.dateStr}T23:59:59.999+01:00`).toISOString();

  const weekLabel = `${firstDay.dateLabel} – ${lastDay.dateLabel}, ${firstDay.dateStr.slice(0, 4)}`;

  return {
    from,
    to,
    weekLabel,
    days,
  };
}
