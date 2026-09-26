export const ALGIERS_TIMEZONE = "Africa/Algiers";

/**
 * Format match format enum into canonical display tag: "5v5", "7v7", "11v11".
 */
export function formatPitchFormat(format: string): string {
  switch (format) {
    case "FIVE_A_SIDE":
    case "5v5":
      return "5v5";
    case "SEVEN_A_SIDE":
    case "7v7":
      return "7v7";
    case "ELEVEN_A_SIDE":
    case "11v11":
      return "11v11";
    default:
      return format.replace(/_/g, " ");
  }
}

/**
 * Format pitch surface into human-friendly label: "Turf", "Natural Grass", etc.
 */
export function formatPitchSurface(surface: string): string {
  switch (surface) {
    case "ARTIFICIAL_TURF":
      return "Turf";
    case "NATURAL_GRASS":
      return "Natural Grass";
    case "INDOOR_PARQUET":
      return "Indoor";
    case "CONCRETE":
      return "Concrete";
    default:
      return surface.replace(/_/g, " ");
  }
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
 * Format a Date or ISO string into local Algiers date ("Mon, Oct 19").
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
 * Calculate UTC ISO boundaries (from, to) for a single calendar day in Africa/Algiers.
 * Africa/Algiers is UTC+1 (offset +1 hour, 3,600,000 ms, no daylight saving time).
 */
export function getAlgiersDayBoundariesUtc(date: Date): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ALGIERS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "2026");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  // Algiers local midnight in UTC: UTC(year, month - 1, day, 0, 0, 0) - 1 hour
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - 3600000;
  // Algiers local next midnight in UTC: UTC(year, month - 1, day + 1, 0, 0, 0) - 1 hour
  const endUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0) - 3600000;

  return {
    from: new Date(startUtcMs).toISOString(),
    to: new Date(endUtcMs).toISOString(),
  };
}

export interface DayOption {
  date: Date;
  dateKey: string; // YYYY-MM-DD in Algiers
  dayLabel: string; // "Today", "Tomorrow", "Wed", etc.
  dateLabel: string; // "Oct 19"
}

/**
 * Generate a sequence of upcoming days in Africa/Algiers timezone for the date selector.
 */
export function getUpcomingDays(count = 7, referenceDate = new Date()): DayOption[] {
  const options: DayOption[] = [];

  for (let i = 0; i < count; i++) {
    const target = new Date(referenceDate.getTime() + i * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ALGIERS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(target);

    const year = parts.find((p) => p.type === "year")?.value ?? "2026";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const dateKey = `${year}-${month}-${day}`;

    let dayLabel: string;
    if (i === 0) {
      dayLabel = "Today";
    } else if (i === 1) {
      dayLabel = "Tomorrow";
    } else {
      dayLabel = target.toLocaleDateString("en-US", {
        timeZone: ALGIERS_TIMEZONE,
        weekday: "short",
      });
    }

    const dateLabel = target.toLocaleDateString("en-US", {
      timeZone: ALGIERS_TIMEZONE,
      month: "short",
      day: "numeric",
    });

    options.push({
      date: target,
      dateKey,
      dayLabel,
      dateLabel,
    });
  }

  return options;
}
