-- CreateEnum
CREATE TYPE "PitchSurface" AS ENUM ('NATURAL_GRASS', 'ARTIFICIAL_TURF', 'INDOOR_PARQUET', 'CONCRETE');

-- CreateEnum
CREATE TYPE "PitchSize" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateTable
CREATE TABLE "pitches" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "surface" "PitchSurface" NOT NULL,
    "size" "PitchSize" NOT NULL,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pitches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_slots" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBookable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pitch_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pitch_slots_pitchId_dayOfWeek_startTime_key" ON "pitch_slots"("pitchId", "dayOfWeek", "startTime");

-- AddForeignKey
ALTER TABLE "pitches" ADD CONSTRAINT "pitches_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_slots" ADD CONSTRAINT "pitch_slots_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
