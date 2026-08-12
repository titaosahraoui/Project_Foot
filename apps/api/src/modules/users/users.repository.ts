import type { UpdateProfileInput } from "@footconnect/shared";
import { prisma } from "../../lib/prisma";

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function updateProfile(id: string, data: UpdateProfileInput) {
  return prisma.user.update({ where: { id }, data });
}
