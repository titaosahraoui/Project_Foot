import type {
  CreatePitchInput,
  CreatePitchSlotInput,
  Pitch,
  PitchDetail,
  PitchQuery,
  PitchSlot,
  UpdatePitchInput,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import * as repo from "./pitches.repository";
import type { PitchWithSlots } from "./pitches.repository";

function toPitch(p: PitchWithSlots): Pitch {
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
    size: p.size,
    pricePerHour: p.pricePerHour,
    amenities: p.amenities,
    photos: p.photos,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toPitchDetail(p: PitchWithSlots): PitchDetail {
  return {
    ...toPitch(p),
    slots: p.slots.map((s) => ({
      id: s.id,
      pitchId: s.pitchId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isBookable: s.isBookable,
    })),
  };
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

export async function getPitchSlots(pitchId: string): Promise<PitchSlot[]> {
  const pitch = await repo.findPitchById(pitchId);
  if (!pitch) throw new HttpError(404, "Pitch not found");
  const slots = await repo.findPitchSlots(pitchId);
  return slots.map((s) => ({
    id: s.id,
    pitchId: s.pitchId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    isBookable: s.isBookable,
  }));
}

export async function createPitchSlots(
  userId: string,
  pitchId: string,
  slotsInput: CreatePitchSlotInput[],
): Promise<PitchSlot[]> {
  const pitch = await repo.findPitchById(pitchId);
  if (!pitch) throw new HttpError(404, "Pitch not found");
  if (pitch.ownerId !== userId) {
    throw new HttpError(403, "Only the pitch owner can set slots for this pitch");
  }

  await repo.upsertPitchSlots(pitchId, slotsInput);
  return getPitchSlots(pitchId);
}
