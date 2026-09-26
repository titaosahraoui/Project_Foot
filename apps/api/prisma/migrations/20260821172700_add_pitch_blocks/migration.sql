-- CreateTable
CREATE TABLE "pitch_blocks" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "pitch_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pitch_blocks_pitchId_startAt_endAt_idx" ON "pitch_blocks"("pitchId", "startAt", "endAt");

-- AddForeignKey
ALTER TABLE "pitch_blocks" ADD CONSTRAINT "pitch_blocks_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
