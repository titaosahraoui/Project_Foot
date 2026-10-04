CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Cancel any legacy overlapping OPEN availabilities for the same team before creating constraint
UPDATE "team_availabilities" a
SET "status" = 'CANCELLED'
WHERE a."status" = 'OPEN'
  AND EXISTS (
    SELECT 1
    FROM "team_availabilities" b
    WHERE b."teamId" = a."teamId"
      AND b."status" = 'OPEN'
      AND b."id" <> a."id"
      AND b."createdAt" < a."createdAt"
      AND tsrange(b."startAt", b."endAt") && tsrange(a."startAt", a."endAt")
  );

-- Enforce no overlapping OPEN windows per team at the database level
ALTER TABLE "team_availabilities"
ADD CONSTRAINT "team_availabilities_no_overlapping_open"
EXCLUDE USING gist (
  "teamId" WITH =,
  tsrange("startAt", "endAt") WITH &&
)
WHERE ("status" = 'OPEN');
