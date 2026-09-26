-- Normalize legacy profile values before enforcing the tightened M03 contracts.
UPDATE "users"
SET "displayName" = CASE
  WHEN LENGTH(BTRIM("displayName")) = 0 THEN 'Player'
  ELSE LEFT(BTRIM("displayName"), 50)
END;

UPDATE "users"
SET "bio" = LEFT("bio", 500)
WHERE "bio" IS NOT NULL AND LENGTH("bio") > 500;

UPDATE "users"
SET "avatarUrl" = NULL
WHERE "avatarUrl" IS NOT NULL
  AND "avatarUrl" !~* '^https://[[:alnum:]][^[:space:]]*$';

UPDATE "users"
SET "lat" = NULL, "lng" = NULL
WHERE ("lat" IS NULL) <> ("lng" IS NULL)
   OR "lat" NOT BETWEEN -90 AND 90
   OR "lng" NOT BETWEEN -180 AND 180;

UPDATE "users"
SET "position" = CASE
  WHEN BTRIM("position") = '' THEN NULL
  WHEN UPPER(BTRIM("position")) = 'GK' THEN 'GK'
  WHEN UPPER(BTRIM("position")) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB') THEN 'DEF'
  WHEN UPPER(BTRIM("position")) IN ('MID', 'CM', 'CAM', 'CDM', 'LM', 'RM') THEN 'MID'
  WHEN UPPER(BTRIM("position")) IN ('FWD', 'ST', 'CF', 'LW', 'RW') THEN 'FWD'
  WHEN UPPER(BTRIM("position")) = 'FLEX' THEN 'FLEX'
  ELSE 'FLEX'
END
WHERE "position" IS NOT NULL;

CREATE TYPE "PlayerPosition" AS ENUM ('GK', 'DEF', 'MID', 'FWD', 'FLEX');

ALTER TABLE "users"
ALTER COLUMN "position" TYPE "PlayerPosition"
USING "position"::"PlayerPosition";
