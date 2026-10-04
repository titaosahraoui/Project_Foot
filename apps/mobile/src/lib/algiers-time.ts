/**
 * Algiers Time & Match Window Utilities
 *
 * Algiers (Africa/Algiers) is West Africa Time (WAT), permanently UTC+1.
 * There is no daylight saving time (DST) in Algeria.
 *
 * Conversion rule:
 * Local Algiers time input (YYYY-MM-DD + HH:mm) is converted to UTC once by
 * specifying the +01:00 offset: `${date}T${time}:00+01:00`.
 */

export const ALGIERS_UTC_OFFSET_HOURS = 1;
export const ALGIERS_OFFSET_MS = ALGIERS_UTC_OFFSET_HOURS * 60 * 60 * 1000;
export const MIN_LEAD_TIME_HOURS = 6;
export const MIN_DURATION_MINUTES = 60;
export const MAX_DURATION_MINUTES = 240;

function pad(num: number): string {
  return num.toString().padStart(2, "0");
}

/**
 * Gets the current date and time components in Algiers local time (UTC+1).
 */
export function getAlgiersNow(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
} {
  // Algiers is UTC+1 year-round
  const algiersEpoch = now.getTime() + ALGIERS_OFFSET_MS;
  const d = new Date(algiersEpoch);

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();

  return {
    year,
    month,
    day,
    hours,
    minutes,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    timeStr: `${pad(hours)}:${pad(minutes)}`,
  };
}

/**
 * Converts a local Algiers date (YYYY-MM-DD) and time (HH:mm) into a UTC ISO string.
 * This is the ONE-TIME conversion from user local Algiers input to UTC.
 */
export function algiersToUtcIso(dateStr: string, timeStr: string): string {
  const trimmedDate = dateStr.trim();
  const trimmedTime = timeStr.trim();
  // Validates format YYYY-MM-DD and HH:mm
  const isoWithOffset = `${trimmedDate}T${trimmedTime}:00+01:00`;
  const parsed = new Date(isoWithOffset);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid Algiers date or time: ${dateStr} ${timeStr}`);
  }
  return parsed.toISOString();
}

/**
 * Converts a UTC ISO string to an Algiers local Date components.
 */
export function utcToAlgiersComponents(utcIso: string): {
  dateStr: string;
  timeStr: string;
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
} {
  const utcDate = new Date(utcIso);
  if (isNaN(utcDate.getTime())) {
    throw new Error(`Invalid UTC date: ${utcIso}`);
  }
  const algiersEpoch = utcDate.getTime() + ALGIERS_OFFSET_MS;
  const d = new Date(algiersEpoch);

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();

  return {
    year,
    month,
    day,
    hours,
    minutes,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    timeStr: `${pad(hours)}:${pad(minutes)}`,
  };
}

/**
 * Formats a UTC ISO timestamp for display in Algiers local time.
 * E.g. "Mon, Oct 5 · 18:00 (Algiers UTC+1)"
 */
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatAlgiersDateTime(utcIso: string): string {
  const utcDate = new Date(utcIso);
  if (isNaN(utcDate.getTime())) return "Invalid date";

  const algiersEpoch = utcDate.getTime() + ALGIERS_OFFSET_MS;
  const d = new Date(algiersEpoch);

  const dayName = DAY_NAMES[d.getUTCDay()];
  const monthName = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());

  return `${dayName}, ${monthName} ${day} · ${hours}:${minutes}`;
}

/**
 * Formats a time range (start to end) in Algiers local time.
 * E.g. "Mon, Oct 5 · 18:00 – 20:00 (120m)"
 */
export function formatAlgiersTimeRange(
  startUtcIso: string,
  endUtcIso: string,
): string {
  const start = new Date(startUtcIso);
  const end = new Date(endUtcIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return "Invalid time range";
  }

  const startComp = utcToAlgiersComponents(startUtcIso);
  const endComp = utcToAlgiersComponents(endUtcIso);

  const durationMin = Math.round(
    (end.getTime() - start.getTime()) / (60 * 1000),
  );
  const dayName =
    DAY_NAMES[
      new Date(start.getTime() + ALGIERS_OFFSET_MS).getUTCDay()
    ];
  const monthName = MONTH_NAMES[startComp.month - 1];

  return `${dayName}, ${monthName} ${startComp.day} · ${startComp.timeStr} – ${endComp.timeStr} (${durationMin}m)`;
}

/**
 * Returns human-readable countdown/deadline copy for an availability window.
 */
export function getAvailabilityCountdown(
  status: "OPEN" | "MATCHED" | "CANCELLED" | "EXPIRED",
  startUtcIso: string,
  endUtcIso: string,
  expiresAtUtcIso: string,
  now: Date = new Date(),
): {
  headline: string;
  detail: string;
  isExpired: boolean;
} {
  if (status === "MATCHED") {
    return {
      headline: "Match Found",
      detail: "Opponent confirmed for this window",
      isExpired: false,
    };
  }

  if (status === "CANCELLED") {
    return {
      headline: "Window Cancelled",
      detail: "Cancelled by team captain",
      isExpired: true,
    };
  }

  const startMs = new Date(startUtcIso).getTime();
  const endMs = new Date(endUtcIso).getTime();
  const expiresMs = new Date(expiresAtUtcIso).getTime();
  const nowMs = now.getTime();

  if (status === "EXPIRED" || nowMs >= endMs || nowMs >= expiresMs) {
    return {
      headline: "Expired",
      detail: "Window closed without match",
      isExpired: true,
    };
  }

  // Still OPEN
  const msUntilStart = startMs - nowMs;
  if (msUntilStart > 0) {
    const hours = Math.floor(msUntilStart / (60 * 60 * 1000));
    const mins = Math.floor((msUntilStart % (60 * 60 * 1000)) / (60 * 1000));

    let timeStr = "";
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      timeStr = `${days}d ${remHours}h`;
    } else if (hours > 0) {
      timeStr = `${hours}h ${mins}m`;
    } else {
      timeStr = `${mins}m`;
    }

    return {
      headline: `Starts in ${timeStr}`,
      detail: `Closes at kickoff (${formatAlgiersDateTime(startUtcIso)})`,
      isExpired: false,
    };
  }

  // Active during match window
  const msUntilEnd = endMs - nowMs;
  const remMinutes = Math.max(0, Math.floor(msUntilEnd / (60 * 1000)));
  return {
    headline: "Window In Progress",
    detail: `${remMinutes}m remaining until window ends`,
    isExpired: false,
  };
}

/**
 * Validates match availability inputs according to M06 rules.
 */
export function validateAvailabilityInput(
  params: {
    teamId: string;
    isCaptain: boolean;
    dateStr: string; // YYYY-MM-DD in Algiers time
    timeStr: string; // HH:mm in Algiers time
    durationMinutes: number;
    radiusKm: number;
    eloTolerance: number;
    message?: string;
    initialStartUtcIso?: string;
  },
  now: Date = new Date(),
): {
  valid: boolean;
  errors: Record<string, string>;
  startUtcIso?: string;
  endUtcIso?: string;
} {
  const errors: Record<string, string> = {};

  if (!params.teamId) {
    errors.teamId = "Please select a team";
  } else if (!params.isCaptain) {
    errors.teamId = "Only the active team captain can set availability";
  }

  // Date and Time parsing
  let startUtcIso: string | undefined;
  let endUtcIso: string | undefined;

  try {
    startUtcIso = algiersToUtcIso(params.dateStr, params.timeStr);
    const startMs = new Date(startUtcIso).getTime();
    const isUnchangedStart =
      params.initialStartUtcIso && startUtcIso === params.initialStartUtcIso;

    if (isUnchangedStart) {
      if (startMs <= now.getTime()) {
        errors.startAt = "Match window has already started or expired";
      }
    } else {
      const minStartMs = now.getTime() + MIN_LEAD_TIME_HOURS * 60 * 60 * 1000;
      if (startMs < minStartMs) {
        errors.startAt = `Must start at least ${MIN_LEAD_TIME_HOURS} hours in advance (Algiers time)`;
      }
    }

    if (
      params.durationMinutes < MIN_DURATION_MINUTES ||
      params.durationMinutes > MAX_DURATION_MINUTES
    ) {
      errors.durationMinutes = `Duration must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes`;
    } else {
      const endMs = startMs + params.durationMinutes * 60 * 1000;
      endUtcIso = new Date(endMs).toISOString();
    }
  } catch {
    errors.startAt = "Invalid date or time format";
  }

  if (params.radiusKm < 1 || params.radiusKm > 50) {
    errors.radiusKm = "Search radius must be between 1 and 50 km";
  }

  if (params.eloTolerance < 50 || params.eloTolerance > 500) {
    errors.eloTolerance = "Elo tolerance must be between 50 and 500";
  }

  if (params.message && params.message.length > 280) {
    errors.message = "Message must not exceed 280 characters";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    startUtcIso,
    endUtcIso,
  };
}
