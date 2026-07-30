-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'PITCH_OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "roles" "UserRole"[] DEFAULT ARRAY['PLAYER']::"UserRole"[],
    "skillLevel" "SkillLevel",
    "position" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
