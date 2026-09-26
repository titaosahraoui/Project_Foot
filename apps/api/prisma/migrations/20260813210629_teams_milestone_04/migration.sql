-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "team_ratings" (
    "teamId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_ratings_pkey" PRIMARY KEY ("teamId")
);

-- Data migration: migrate existing team ratings
INSERT INTO "team_ratings" ("teamId", "rating", "matchesPlayed", "wins", "draws", "losses", "createdAt", "updatedAt")
SELECT "id", "skillRating", ("wins" + "losses"), "wins", 0, "losses", "createdAt", "updatedAt"
FROM "teams"
ON CONFLICT ("teamId") DO NOTHING;

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "losses",
DROP COLUMN "skillRating",
DROP COLUMN "wins",
ADD COLUMN     "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "team_lineups" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "formationCode" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_lineup_slots" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "team_lineup_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_lineups_teamId_format_key" ON "team_lineups"("teamId", "format");

-- CreateIndex
CREATE UNIQUE INDEX "team_lineup_slots_lineupId_sortOrder_key" ON "team_lineup_slots"("lineupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "team_lineup_slots_lineupId_userId_key" ON "team_lineup_slots"("lineupId", "userId");

-- AddForeignKey
ALTER TABLE "team_ratings" ADD CONSTRAINT "team_ratings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_lineups" ADD CONSTRAINT "team_lineups_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_lineup_slots" ADD CONSTRAINT "team_lineup_slots_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "team_lineups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
