-- Adaptive crop usage tracking
-- Stores normalized crop selections per country/region for learned suggestions

CREATE TABLE IF NOT EXISTS "crop_usage" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "crop_code"    TEXT NOT NULL,
    "crop_name"    TEXT NOT NULL,
    "country"      TEXT,
    "region"       TEXT,
    "use_count"    INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one row per crop+country combination
CREATE UNIQUE INDEX IF NOT EXISTS "uq_crop_usage_code_country" ON "crop_usage"("crop_code", "country");

-- Query indexes
CREATE INDEX IF NOT EXISTS "idx_crop_usage_country" ON "crop_usage"("country");
CREATE INDEX IF NOT EXISTS "idx_crop_usage_count" ON "crop_usage"("use_count");

-- Seed from existing farm_profiles: populate crop_usage from real farmer data
INSERT INTO "crop_usage" ("id", "crop_code", "crop_name", "country", "use_count", "last_used_at")
SELECT
    gen_random_uuid()::text,
    "crop",
    "crop",
    "country",
    COUNT(*)::integer,
    MAX("updated_at")
FROM "farm_profiles"
WHERE "crop" IS NOT NULL AND "crop" != ''
GROUP BY "crop", "country"
ON CONFLICT ("crop_code", "country") DO UPDATE
SET "use_count" = EXCLUDED."use_count",
    "last_used_at" = EXCLUDED."last_used_at";
