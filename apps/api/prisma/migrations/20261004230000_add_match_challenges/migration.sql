-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "match_challenges" (
    "id" TEXT NOT NULL,
    "challengerTeamId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "challengerAvailabilityId" TEXT NOT NULL,
    "opponentAvailabilityId" TEXT NOT NULL,
    "organizerUserId" TEXT NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL,
    "responseDeadline" TIMESTAMP(3) NOT NULL,
    "bookingDeadline" TIMESTAMP(3),
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(280),
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_challenges_challengerTeamId_status_idx" ON "match_challenges"("challengerTeamId", "status");

-- CreateIndex
CREATE INDEX "match_challenges_opponentTeamId_status_idx" ON "match_challenges"("opponentTeamId", "status");

-- CreateIndex
CREATE INDEX "match_challenges_challengerAvailabilityId_idx" ON "match_challenges"("challengerAvailabilityId");

-- CreateIndex
CREATE INDEX "match_challenges_opponentAvailabilityId_idx" ON "match_challenges"("opponentAvailabilityId");

-- CreateIndex
CREATE INDEX "match_challenges_organizerUserId_idx" ON "match_challenges"("organizerUserId");

-- CreateIndex
CREATE INDEX "match_challenges_status_responseDeadline_idx" ON "match_challenges"("status", "responseDeadline");

-- CreateIndex
CREATE INDEX "match_challenges_status_bookingDeadline_idx" ON "match_challenges"("status", "bookingDeadline");

-- Partial unique index: one active PENDING challenge per ordered availability pair
CREATE UNIQUE INDEX "match_challenges_pending_pair_unique" 
ON "match_challenges"("challengerAvailabilityId", "opponentAvailabilityId") 
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "match_challenges" ADD CONSTRAINT "match_challenges_challengerTeamId_fkey" FOREIGN KEY ("challengerTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_challenges" ADD CONSTRAINT "match_challenges_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_challenges" ADD CONSTRAINT "match_challenges_challengerAvailabilityId_fkey" FOREIGN KEY ("challengerAvailabilityId") REFERENCES "team_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_challenges" ADD CONSTRAINT "match_challenges_opponentAvailabilityId_fkey" FOREIGN KEY ("opponentAvailabilityId") REFERENCES "team_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_challenges" ADD CONSTRAINT "match_challenges_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-integrity guards mirroring @footconnect/shared matchmaking contracts.
ALTER TABLE "match_challenges"
    ADD CONSTRAINT "match_challenges_different_teams_check" CHECK ("challengerTeamId" <> "opponentTeamId"),
    ADD CONSTRAINT "match_challenges_window_check" CHECK ("endAt" > "startAt"),
    ADD CONSTRAINT "match_challenges_radius_check" CHECK ("radiusKm" BETWEEN 1 AND 50),
    ADD CONSTRAINT "match_challenges_origin_lat_check" CHECK ("originLat" BETWEEN -90 AND 90),
    ADD CONSTRAINT "match_challenges_origin_lng_check" CHECK ("originLng" BETWEEN -180 AND 180);
