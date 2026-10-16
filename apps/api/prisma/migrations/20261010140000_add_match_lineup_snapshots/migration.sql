-- CreateTable
CREATE TABLE "match_lineup_snapshots" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "formationCode" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "replacedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "replacementReason" TEXT,

    CONSTRAINT "match_lineup_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_lineup_players" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "primaryPosition" "PlayerPosition",
    "positionCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "match_lineup_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_lineup_snapshots_matchId_teamId_version_key" ON "match_lineup_snapshots"("matchId", "teamId", "version");

-- CreateIndex (Partial unique index enforcing at most one current snapshot per match/team)
CREATE UNIQUE INDEX "match_lineup_snapshots_current_unique" ON "match_lineup_snapshots"("matchId", "teamId") WHERE "isCurrent" = true;

-- CreateIndex
CREATE INDEX "match_lineup_snapshots_matchId_teamId_idx" ON "match_lineup_snapshots"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "match_lineup_snapshots_submittedById_idx" ON "match_lineup_snapshots"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineup_players_snapshotId_userId_key" ON "match_lineup_players"("snapshotId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineup_players_snapshotId_sortOrder_key" ON "match_lineup_players"("snapshotId", "sortOrder");

-- CreateIndex
CREATE INDEX "match_lineup_players_snapshotId_idx" ON "match_lineup_players"("snapshotId");

-- CreateIndex
CREATE INDEX "match_lineup_players_userId_idx" ON "match_lineup_players"("userId");

-- AddForeignKey
ALTER TABLE "match_lineup_snapshots" ADD CONSTRAINT "match_lineup_snapshots_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_snapshots" ADD CONSTRAINT "match_lineup_snapshots_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_snapshots" ADD CONSTRAINT "match_lineup_snapshots_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_snapshots" ADD CONSTRAINT "match_lineup_snapshots_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_players" ADD CONSTRAINT "match_lineup_players_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "match_lineup_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_players" ADD CONSTRAINT "match_lineup_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
