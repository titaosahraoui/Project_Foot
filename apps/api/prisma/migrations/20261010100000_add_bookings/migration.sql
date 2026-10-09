-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_OWNER_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'CANCELLED_BY_TEAM', 'CANCELLED_BY_OWNER', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfflinePaymentStatus" AS ENUM ('UNPAID', 'PAID_AT_VENUE', 'WAIVED');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "organizerUserId" TEXT NOT NULL,
    "challengerTeamId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "priceAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_OWNER_CONFIRMATION',
    "paymentStatus" "OfflinePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "ownerResponseDeadline" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_pitchId_status_idx" ON "bookings"("pitchId", "status");

-- CreateIndex
CREATE INDEX "bookings_challengeId_idx" ON "bookings"("challengeId");

-- CreateIndex
CREATE INDEX "bookings_organizerUserId_status_idx" ON "bookings"("organizerUserId", "status");

-- CreateIndex
CREATE INDEX "bookings_challengerTeamId_status_idx" ON "bookings"("challengerTeamId", "status");

-- CreateIndex
CREATE INDEX "bookings_opponentTeamId_status_idx" ON "bookings"("opponentTeamId", "status");

-- CreateIndex
CREATE INDEX "bookings_status_ownerResponseDeadline_idx" ON "bookings"("status", "ownerResponseDeadline");

-- CreateIndex
CREATE INDEX "bookings_pitchId_startAt_endAt_idx" ON "bookings"("pitchId", "startAt", "endAt");

-- Partial unique index on challengeId for blocking statuses PENDING_OWNER_CONFIRMATION and CONFIRMED
CREATE UNIQUE INDEX "bookings_active_challenge_unique"
ON "bookings"("challengeId")
WHERE "status" IN ('PENDING_OWNER_CONFIRMATION', 'CONFIRMED');

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "match_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_challengerTeamId_fkey" FOREIGN KEY ("challengerTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data-integrity guards mirroring @footconnect/shared booking contracts
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_different_teams_check" CHECK ("challengerTeamId" <> "opponentTeamId"),
    ADD CONSTRAINT "bookings_window_check" CHECK ("endAt" > "startAt"),
    ADD CONSTRAINT "bookings_price_amount_minor_check" CHECK ("priceAmountMinor" >= 0);
