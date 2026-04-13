-- Multi-active farms: allow multiple farms active simultaneously.
-- Add isDefault flag so one farm can be the convenient default.

-- 1. Add is_default column (false for all existing records)
ALTER TABLE "farm_profiles" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: mark each user's current active farm as default
-- (pick the most recently created active farm per user)
UPDATE "farm_profiles" fp
SET "is_default" = true
WHERE fp.id = (
  SELECT fp2.id FROM "farm_profiles" fp2
  WHERE fp2."user_id_direct" = fp."user_id_direct"
    AND fp2."status" = 'active'
  ORDER BY fp2."created_at" DESC
  LIMIT 1
)
AND fp."status" = 'active';

-- 3. Reactivate inactive (non-archived) farms so multiple can be active
-- Only reactivate 'inactive' — leave 'archived' alone
UPDATE "farm_profiles"
SET "status" = 'active'
WHERE "status" = 'inactive';

-- 4. Create index for default farm lookups
CREATE INDEX "idx_farm_profiles_default" ON "farm_profiles"("user_id_direct", "is_default");
