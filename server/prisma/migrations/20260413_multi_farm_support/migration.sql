-- Multi-farm support: allow one farmer to have multiple farm/land records
-- while keeping one active at a time for pilot simplicity.

-- 1. Remove UNIQUE constraint on user_id_direct (was 1:1, now 1:many)
DROP INDEX IF EXISTS "farm_profiles_user_id_direct_key";

-- 2. Add status column to farm_profiles (active | inactive | archived)
ALTER TABLE "farm_profiles" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- 3. Add farm_profile_id to v2_seasons (link season to specific farm)
ALTER TABLE "v2_seasons" ADD COLUMN "farm_profile_id" TEXT;

-- 4. Backfill: link existing seasons to their user's active farm profile
UPDATE "v2_seasons" s
SET "farm_profile_id" = (
  SELECT fp.id FROM "farm_profiles" fp
  WHERE fp."user_id_direct" = s."user_id"
  ORDER BY fp."created_at" DESC
  LIMIT 1
)
WHERE s."farm_profile_id" IS NULL;

-- 5. Add foreign key constraint
ALTER TABLE "v2_seasons"
  ADD CONSTRAINT "v2_seasons_farm_profile_id_fkey"
  FOREIGN KEY ("farm_profile_id") REFERENCES "farm_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Create indexes
CREATE INDEX "idx_farm_profiles_user" ON "farm_profiles"("user_id_direct");
CREATE INDEX "idx_farm_profiles_status" ON "farm_profiles"("status");
CREATE INDEX "idx_v2_seasons_farm_profile" ON "v2_seasons"("farm_profile_id");
