import {
  CreatePitchInput,
  CreatePitchSlotInput,
  minutesToTimeString,
  Pitch,
  PitchAvailabilityRule,
  PitchDetail,
  PitchQuery,
  PitchSlot,
  SetPitchAvailabilityRuleItem,
  timeStringToMinutes,
  UpdatePitchInput,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import * as repo from "./pitches.repository";
import type { PitchWithRules } from "./pitches.repository";

function toAvailabilityRule(r: {
  id: string;
  pitchId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PitchAvailabilityRule {
  return {
    id: r.id,
    pitchId: r.pitchId,
    dayOfWeek: r.dayOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    startTime: minutesToTimeString(r.startMinute),
    endTime: minutesToTimeString(r.endMinute),
    timezone: "Africa/Algiers",
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toPitch(p: PitchWithRules): Pitch {
  return {
    id: p.id,
    ownerId: p.ownerId,
    name: p.name,
    description: p.description,
    address: p.address,
    city: p.city,
    lat: p.lat,
    lng: p.lng,
    surface: p.surface,
    format: p.size,
    size: p.size,
    hourlyRate: {
      amountMinor: p.priceAmountMinor,
      currency: "DZD",
    },
    amenities: p.amenities,
    photos: p.photos,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toPitchDetail(p: PitchWithRules): PitchDetail {
  const rules = p.availabilityRules.map(toAvailabilityRule);
  return {
    ...toPitch(p),
    availabilityRules: rules,
    slots: rules.map((r) => ({
      id: r.id,
      pitchId: r.pitchId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      isBookable: r.isActive,
    })),
  };
}

export function validateAvailabilityRules(rules: SetPitchAvailabilityRuleItem[]): void {
  // 1. Validate each rule individually (min 30 min, start < end, 0..1440)
  for (const rule of rules) {
    if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
      throw new HttpError(400, "dayOfWeek must be between 0 and 6");
    }
    if (rule.startMinute < 0 || rule.startMinute > 1440) {
      throw new HttpError(400, "startMinute must be between 0 and 1440");
    }
    if (rule.endMinute < 0 || rule.endMinute > 1440) {
      throw new HttpError(400, "endMinute must be between 0 and 1440");
    }
    if (rule.endMinute <= rule.startMinute) {
      throw new HttpError(400, "endMinute must be greater than startMinute");
    }
    if (rule.endMinute - rule.startMinute < 30) {
      throw new HttpError(400, "Availability rules must be at least 30 minutes long");
    }
  }

  // 2. Group active rules by dayOfWeek and check for overlaps
  const activeRulesByDay = new Map<number, SetPitchAvailabilityRuleItem[]>();
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const dayRules = activeRulesByDay.get(rule.dayOfWeek) ?? [];
    dayRules.push(rule);
    activeRulesByDay.set(rule.dayOfWeek, dayRules);
  }

  for (const [day, dayRules] of activeRulesByDay.entries()) {
    dayRules.sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 0; i < dayRules.length - 1; i++) {
      const current = dayRules[i];
      const next = dayRules[i + 1];
      if (current !== undefined && next !== undefined && current.endMinute > next.startMinute) {
        throw new HttpError(
          400,
          `Overlapping active availability rules on day ${day}: (${minutesToTimeString(current.startMinute)}-${minutesToTimeString(current.endMinute)}) overlaps with (${minutesToTimeString(next.startMinute)}-${minutesToTimeString(next.endMinute)})`,
        );
      }
    }
  }
}

export async function createPitch(userId: string, input: CreatePitchInput): Promise<PitchDetail> {
  const pitch = await repo.createPitch(userId, input);
  return toPitchDetail(pitch);
}

export async function getPitch(id: string): Promise<PitchDetail> {
  const pitch = await repo.findPitchById(id);
  if (!pitch) throw new HttpError(404, "Pitch not found");
  return toPitchDetail(pitch);
}

export async function getMyPitches(userId: string): Promise<Pitch[]> {
  const pitches = await repo.findMyPitches(userId);
  return pitches.map(toPitch);
}

export async function searchPitches(query: PitchQuery): Promise<Pitch[]> {
  const pitches = await repo.findPitches(query);
  return pitches.map(toPitch);
}

export async function updatePitch(
  userId: string,
  id: string,
  input: UpdatePitchInput,
): Promise<PitchDetail> {
  const pitch = await repo.findPitchById(id);
  if (!pitch) throw new HttpError(404, "Pitch not found");
  if (pitch.ownerId !== userId) {
    throw new HttpError(403, "Only the pitch owner can edit this pitch");
  }
  const updated = await repo.updatePitch(id, input);
  return toPitchDetail(updated);
}

export async function getAvailabilityRules(pitchId: string): Promise<PitchAvailabilityRule[]> {
  const pitch = await repo.findPitchById(pitchId);
  if (!pitch) throw new HttpError(404, "Pitch not found");
  const rules = await repo.findAvailabilityRules(pitchId);
  return rules.map(toAvailabilityRule);
}

export async function setAvailabilityRules(
  userId: string,
  pitchId: string,
  rulesInput: SetPitchAvailabilityRuleItem[],
): Promise<PitchAvailabilityRule[]> {
  const pitch = await repo.findPitchById(pitchId);
  if (!pitch) throw new HttpError(404, "Pitch not found");
  if (pitch.ownerId !== userId) {
    throw new HttpError(403, "Only the pitch owner can set availability rules for this pitch");
  }

  validateAvailabilityRules(rulesInput);

  const updated = await repo.replaceAvailabilityRules(pitchId, rulesInput);
  return updated.map(toAvailabilityRule);
}

// Deprecated compatibility methods for older clients
export async function getPitchSlots(pitchId: string): Promise<PitchSlot[]> {
  const rules = await getAvailabilityRules(pitchId);
  return rules.map((r) => ({
    id: r.id,
    pitchId: r.pitchId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    isBookable: r.isActive,
  }));
}

export async function createPitchSlots(
  userId: string,
  pitchId: string,
  slotsInput: CreatePitchSlotInput[],
): Promise<PitchSlot[]> {
  const rulesInput: SetPitchAvailabilityRuleItem[] = slotsInput.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startMinute: timeStringToMinutes(s.startTime),
    endMinute: timeStringToMinutes(s.endTime),
    isActive: s.isBookable ?? true,
  }));
  await setAvailabilityRules(userId, pitchId, rulesInput);
  return getPitchSlots(pitchId);
}
