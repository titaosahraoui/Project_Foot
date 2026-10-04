-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('OPEN', 'MATCHED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "team_availabilities" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 10,
    "eloTolerance" INTEGER NOT NULL DEFAULT 150,
    "message" VARCHAR(280),
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "matchedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_availabilities_teamId_status_idx" ON "team_availabilities"("teamId", "status");

-- CreateIndex
CREATE INDEX "team_availabilities_status_startAt_endAt_idx" ON "team_availabilities"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "team_availabilities_status_expiresAt_idx" ON "team_availabilities"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "team_availabilities" ADD CONSTRAINT "team_availabilities_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-integrity guards mirroring @footconnect/shared matchmaking contracts.
-- Clock-relative rules (six-hour lead time, 60-240 minute duration) stay in
-- the application layer; the database guarantees only invariant ranges.
ALTER TABLE "team_availabilities"
    ADD CONSTRAINT "team_availabilities_window_check" CHECK ("endAt" > "startAt"),
    ADD CONSTRAINT "team_availabilities_radius_check" CHECK ("radiusKm" BETWEEN 1 AND 50),
    ADD CONSTRAINT "team_availabilities_elo_tolerance_check" CHECK ("eloTolerance" BETWEEN 50 AND 500),
    ADD CONSTRAINT "team_availabilities_origin_lat_check" CHECK ("originLat" BETWEEN -90 AND 90),
    ADD CONSTRAINT "team_availabilities_origin_lng_check" CHECK ("originLng" BETWEEN -180 AND 180);
