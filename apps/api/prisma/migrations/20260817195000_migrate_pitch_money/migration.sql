-- AlterTable: Add priceAmountMinor and currency to pitches, populate from pricePerHour, then drop pricePerHour
ALTER TABLE "pitches" ADD COLUMN "priceAmountMinor" INTEGER;
ALTER TABLE "pitches" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'DZD';

-- Migrate existing float values X to round(X * 100)
UPDATE "pitches"
SET "priceAmountMinor" = ROUND("pricePerHour" * 100)::INTEGER;

ALTER TABLE "pitches" ALTER COLUMN "priceAmountMinor" SET NOT NULL;
ALTER TABLE "pitches" DROP COLUMN "pricePerHour";
