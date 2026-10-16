-- Create btree_gist extension if it doesn't already exist
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Ensure startAt and endAt are TIMESTAMPTZ(3) so tstzrange operates correctly
ALTER TABLE "bookings"
  ALTER COLUMN "startAt" TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "endAt" TYPE TIMESTAMPTZ(3);

-- PostgreSQL exclusion constraint preventing overlapping blocking bookings on the same pitch.
-- Uses half-open interval '[)' so adjacent slots (e.g. 18:00-19:30 and 19:30-21:00) can coexist.
-- Only enforced for PENDING_OWNER_CONFIRMATION and CONFIRMED bookings.
ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_pitch_time_exclusion"
EXCLUDE USING gist (
  "pitchId" WITH =,
  tstzrange("startAt", "endAt", '[)') WITH &&
)
WHERE ("status" IN ('PENDING_OWNER_CONFIRMATION', 'CONFIRMED'));
