-- Add location_label column to farm_profiles for cached reverse-geocoded location text.
-- Coordinates (latitude/longitude) are preserved — this is a display-only enhancement.

ALTER TABLE "farm_profiles" ADD COLUMN "location_label" TEXT;

-- Backfill: use existing location_name as location_label where available
UPDATE "farm_profiles"
SET "location_label" = "location_name"
WHERE "location_name" IS NOT NULL AND "location_name" != '';
