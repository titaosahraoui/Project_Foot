import { Prisma } from "@prisma/client";
import type {
  CreatePitchInput,
  PitchQuery,
  SetPitchAvailabilityRuleItem,
  UpdatePitchInput,
} from "@footconnect/shared";
import { prisma } from "../../lib/prisma";

const pitchInclude = {
  availabilityRules: {
    orderBy: [{ dayOfWeek: "asc" as const }, { startMinute: "asc" as const }],
  },
  blocks: {
    where: { cancelledAt: null },
    orderBy: { startAt: "asc" as const },
  },
} satisfies Prisma.PitchInclude;

export type PitchWithRulesAndBlocks = Prisma.PitchGetPayload<{ include: typeof pitchInclude }>;

export function createPitch(ownerId: string, data: CreatePitchInput): Promise<PitchWithRulesAndBlocks> {
  const format = (data.format ?? data.size)!;
  return prisma.pitch.create({
    data: {
      ownerId,
      name: data.name,
      description: data.description ?? null,
      address: data.address,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
      surface: data.surface,
      size: format,
      priceAmountMinor: data.hourlyRate.amountMinor,
      currency: data.hourlyRate.currency,
      amenities: data.amenities ?? [],
      photos: data.photos ?? [],
    },
    include: pitchInclude,
  });
}

export function findPitchById(id: string): Promise<PitchWithRulesAndBlocks | null> {
  return prisma.pitch.findUnique({
    where: { id },
    include: pitchInclude,
  });
}

export function findMyPitches(ownerId: string): Promise<PitchWithRulesAndBlocks[]> {
  return prisma.pitch.findMany({
    where: { ownerId },
    include: pitchInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function findPitches(query: PitchQuery): Promise<PitchWithRulesAndBlocks[]> {
  const where: Prisma.PitchWhereInput = {
    isActive: true,
  };

  if (query.city) {
    where.city = { contains: query.city, mode: "insensitive" };
  }
  if (query.surface) {
    where.surface = query.surface;
  }
  const format = query.format ?? query.size;
  if (format) {
    where.size = format;
  }
  const maxPriceMinor = query.maxPriceMinor ?? query.maxPrice;
  if (maxPriceMinor !== undefined) {
    where.priceAmountMinor = { lte: maxPriceMinor };
  }

  const pitches = await prisma.pitch.findMany({
    where,
    include: pitchInclude,
    orderBy: { createdAt: "desc" },
  });

  // If lat/lng provided, filter by radius using Haversine formula
  if (query.lat !== undefined && query.lng !== undefined && query.radiusKm) {
    const lat1 = query.lat;
    const lng1 = query.lng;
    const radius = query.radiusKm;

    return pitches.filter((p) => {
      const dLat = ((p.lat - lat1) * Math.PI) / 180;
      const dLng = ((p.lng - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((p.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = 6371 * c;
      return distanceKm <= radius;
    });
  }

  return pitches;
}

export function updatePitch(id: string, data: UpdatePitchInput): Promise<PitchWithRulesAndBlocks> {
  const format = data.format ?? data.size;
  return prisma.pitch.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
      ...(data.surface !== undefined && { surface: data.surface }),
      ...(format !== undefined && { size: format }),
      ...(data.hourlyRate !== undefined && {
        priceAmountMinor: data.hourlyRate.amountMinor,
        currency: data.hourlyRate.currency,
      }),
      ...(data.amenities !== undefined && { amenities: data.amenities }),
      ...(data.photos !== undefined && { photos: data.photos }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: pitchInclude,
  });
}

export function findAvailabilityRules(pitchId: string) {
  return prisma.pitchAvailabilityRule.findMany({
    where: { pitchId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });
}

export async function replaceAvailabilityRules(
  pitchId: string,
  rules: SetPitchAvailabilityRuleItem[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.pitchAvailabilityRule.deleteMany({ where: { pitchId } });
    if (rules.length > 0) {
      await tx.pitchAvailabilityRule.createMany({
        data: rules.map((r) => ({
          pitchId,
          dayOfWeek: r.dayOfWeek,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
          timezone: "Africa/Algiers",
          isActive: r.isActive,
        })),
      });
    }
    return tx.pitchAvailabilityRule.findMany({
      where: { pitchId },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    });
  });
}

export function createPitchBlock(
  pitchId: string,
  data: { startAt: Date; endAt: Date; reason?: string | null; createdById: string },
) {
  return prisma.pitchBlock.create({
    data: {
      pitchId,
      startAt: data.startAt,
      endAt: data.endAt,
      reason: data.reason ?? null,
      createdById: data.createdById,
    },
  });
}

export function findPitchBlockById(id: string) {
  return prisma.pitchBlock.findUnique({ where: { id } });
}

export function cancelPitchBlock(id: string) {
  return prisma.pitchBlock.update({
    where: { id },
    data: { cancelledAt: new Date() },
  });
}

export function findActivePitchBlocks(pitchId: string, from: Date, to: Date) {
  return prisma.pitchBlock.findMany({
    where: {
      pitchId,
      cancelledAt: null,
      startAt: { lt: to },
      endAt: { gt: from },
    },
    orderBy: { startAt: "asc" },
  });
}
