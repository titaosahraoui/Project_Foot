-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'AWAITING_RESULTS', 'CONSENSUS_PENDING', 'VERIFIED', 'DISPUTED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "MatchParticipantRole" AS ENUM ('HOME', 'AWAY');

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeCaptainId" TEXT NOT NULL,
    "awayCaptainId" TEXT NOT NULL,
    "pitchOwnerId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "role" "MatchParticipantRole" NOT NULL DEFAULT 'HOME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_bookingId_key" ON "matches"("bookingId");

-- CreateIndex
CREATE INDEX "matches_homeTeamId_status_idx" ON "matches"("homeTeamId", "status");

-- CreateIndex
CREATE INDEX "matches_awayTeamId_status_idx" ON "matches"("awayTeamId", "status");

-- CreateIndex
CREATE INDEX "matches_pitchOwnerId_status_idx" ON "matches"("pitchOwnerId", "status");

-- CreateIndex
CREATE INDEX "matches_startAt_endAt_idx" ON "matches"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_matchId_teamId_key" ON "match_participants"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "match_participants_teamId_idx" ON "match_participants"("teamId");

-- CreateIndex
CREATE INDEX "match_participants_captainId_idx" ON "match_participants"("captainId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_homeCaptainId_fkey" FOREIGN KEY ("homeCaptainId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_awayCaptainId_fkey" FOREIGN KEY ("awayCaptainId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pitchOwnerId_fkey" FOREIGN KEY ("pitchOwnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
