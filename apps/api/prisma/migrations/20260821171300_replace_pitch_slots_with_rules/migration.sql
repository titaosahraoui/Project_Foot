-- CreateTable: pitch_availability_rules
CREATE TABLE "pitch_availability_rules" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Algiers',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitch_availability_rules_pkey" PRIMARY KEY ("id")
);

-- Migrate existing data from pitch_slots if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pitch_slots') THEN
    INSERT INTO "pitch_availability_rules" ("id", "pitchId", "dayOfWeek", "startMinute", "endMinute", "timezone", "isActive", "createdAt", "updatedAt")
    SELECT
      "id",
      "pitchId",
      "dayOfWeek",
      (CAST(SUBSTRING("startTime", 1, 2) AS INTEGER) * 60 + CAST(SUBSTRING("startTime", 4, 2) AS INTEGER)),
      (CAST(SUBSTRING("endTime", 1, 2) AS INTEGER) * 60 + CAST(SUBSTRING("endTime", 4, 2) AS INTEGER)),
      'Africa/Algiers',
      "isBookable",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "pitch_slots";

    DROP TABLE "pitch_slots";
  END IF;
END $$;

-- CreateIndex
CREATE INDEX "pitch_availability_rules_pitchId_dayOfWeek_idx" ON "pitch_availability_rules"("pitchId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "pitch_availability_rules" ADD CONSTRAINT "pitch_availability_rules_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
