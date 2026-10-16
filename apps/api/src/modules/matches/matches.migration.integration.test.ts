import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";

describe("matches migration and schema (integration)", () => {
  it("creates the MatchStatus and MatchParticipantRole Postgres enums", async () => {
    const rows = await prisma.$queryRaw<{ type: string; label: string }[]>`
      SELECT t.typname AS type, e.enumlabel AS label
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('MatchStatus', 'MatchParticipantRole')
      ORDER BY t.typname, e.enumsortorder;
    `;

    const byType = (type: string) =>
      rows.filter((r) => r.type === type).map((r) => r.label);

    expect(byType("MatchStatus")).toEqual([
      "SCHEDULED",
      "AWAITING_RESULTS",
      "CONSENSUS_PENDING",
      "VERIFIED",
      "DISPUTED",
      "CANCELLED",
      "NO_SHOW",
    ]);

    expect(byType("MatchParticipantRole")).toEqual(["HOME", "AWAY"]);
  });

  it("creates matches table with required columns, types, and constraints", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'matches'
      ORDER BY ordinal_position;
    `;

    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("bookingId");
    expect(columnNames).toContain("homeTeamId");
    expect(columnNames).toContain("awayTeamId");
    expect(columnNames).toContain("homeCaptainId");
    expect(columnNames).toContain("awayCaptainId");
    expect(columnNames).toContain("pitchOwnerId");
    expect(columnNames).toContain("startAt");
    expect(columnNames).toContain("endAt");
    expect(columnNames).toContain("format");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("createdAt");
    expect(columnNames).toContain("updatedAt");

    // Check unique constraint on bookingId
    const uniqueIndexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'matches' AND indexdef LIKE '%bookingId%';
    `;
    expect(uniqueIndexes.some((i) => i.indexdef.includes("UNIQUE"))).toBe(true);
  });

  it("creates match_participants table with required columns and constraints", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'match_participants'
      ORDER BY ordinal_position;
    `;

    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("matchId");
    expect(columnNames).toContain("teamId");
    expect(columnNames).toContain("captainId");
    expect(columnNames).toContain("role");
    expect(columnNames).toContain("createdAt");

    // Check unique constraint on (matchId, teamId)
    const uniqueIndexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'match_participants' AND indexdef LIKE '%matchId%' AND indexdef LIKE '%teamId%';
    `;
    expect(uniqueIndexes.some((i) => i.indexdef.includes("UNIQUE"))).toBe(true);
  });

  it("creates match_lineup_snapshots table with required columns and constraints", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'match_lineup_snapshots'
      ORDER BY ordinal_position;
    `;

    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("matchId");
    expect(columnNames).toContain("teamId");
    expect(columnNames).toContain("formationCode");
    expect(columnNames).toContain("submittedById");
    expect(columnNames).toContain("submittedAt");
    expect(columnNames).toContain("version");
    expect(columnNames).toContain("isCurrent");
    expect(columnNames).toContain("replacedAt");
    expect(columnNames).toContain("replacedById");
    expect(columnNames).toContain("replacementReason");

    // Check unique constraint on (matchId, teamId, version)
    const versionIndexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'match_lineup_snapshots' AND indexdef LIKE '%matchId%' AND indexdef LIKE '%teamId%' AND indexdef LIKE '%version%';
    `;
    expect(versionIndexes.some((i) => i.indexdef.includes("UNIQUE"))).toBe(true);

    // Check partial unique index for current snapshot: match_lineup_snapshots_current_unique
    const currentUniqueIndexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'match_lineup_snapshots' AND indexname = 'match_lineup_snapshots_current_unique';
    `;
    expect(currentUniqueIndexes.length).toBe(1);
    expect(currentUniqueIndexes[0]?.indexdef).toContain("isCurrent");
  });

  it("creates match_lineup_players table with required columns and constraints", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'match_lineup_players'
      ORDER BY ordinal_position;
    `;

    const columnNames = columns.map((c) => c.column_name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("snapshotId");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("displayName");
    expect(columnNames).toContain("avatarUrl");
    expect(columnNames).toContain("primaryPosition");
    expect(columnNames).toContain("positionCode");
    expect(columnNames).toContain("sortOrder");

    // Check unique constraint on (snapshotId, userId)
    const userIndexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'match_lineup_players' AND indexdef LIKE '%snapshotId%' AND indexdef LIKE '%userId%';
    `;
    expect(userIndexes.some((i) => i.indexdef.includes("UNIQUE"))).toBe(true);

    // Check unique constraint on (snapshotId, sortOrder)
    const sortOrderIndexes = await prisma.$queryRaw<
      { indexname: string; indexdef: string }[]
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'match_lineup_players' AND indexdef LIKE '%snapshotId%' AND indexdef LIKE '%sortOrder%';
    `;
    expect(sortOrderIndexes.some((i) => i.indexdef.includes("UNIQUE"))).toBe(true);
  });
});
