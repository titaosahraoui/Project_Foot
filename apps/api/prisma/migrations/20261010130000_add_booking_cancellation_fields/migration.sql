-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "cancelledByUserId" TEXT,
ADD COLUMN "responsibleTeamId" TEXT,
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "isLateCancellation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "bookings_responsibleTeamId_idx" ON "bookings"("responsibleTeamId");

-- CreateIndex
CREATE INDEX "bookings_cancelledByUserId_idx" ON "bookings"("cancelledByUserId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_responsibleTeamId_fkey" FOREIGN KEY ("responsibleTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
