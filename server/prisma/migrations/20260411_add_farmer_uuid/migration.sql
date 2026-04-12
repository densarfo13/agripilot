-- Add persistent farmerUuid to farm_profiles.
-- Generated once on first profile creation, never regenerated on update.

-- 1. Add column (nullable first to handle existing rows)
ALTER TABLE "farm_profiles" ADD COLUMN "farmer_uuid" TEXT;

-- 2. Backfill existing rows with unique FRM-XXXXXXXXXXXX values
-- Uses md5 of the existing id to generate deterministic but unique values.
UPDATE "farm_profiles"
SET "farmer_uuid" = 'FRM-' || UPPER(SUBSTRING(md5(id::text) FROM 1 FOR 12))
WHERE "farmer_uuid" IS NULL;

-- 3. Make NOT NULL + UNIQUE after backfill
ALTER TABLE "farm_profiles" ALTER COLUMN "farmer_uuid" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "farm_profiles_farmer_uuid_key" ON "farm_profiles" ("farmer_uuid");
