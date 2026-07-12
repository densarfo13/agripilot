-- Provisional plant confirmation (P2/P3). One durable row per scan (scanId UNIQUE
-- → idempotent). Written at scan time with provider candidates + gated health;
-- updated on farmer confirmation. Additive, fully nullable → zero-lock migration.
CREATE TABLE IF NOT EXISTS "scan_plant_identifications" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "user_id" TEXT,
    "image_url" TEXT,
    "identification_state" TEXT,
    "candidates" JSONB,
    "scan_health_state" TEXT,
    "scan_health_result" JSONB,
    "correlation_id" TEXT,
    "provider_version" TEXT,
    "confirmed_taxon_id" TEXT,
    "confirmed_common_name" TEXT,
    "confirmed_scientific" TEXT,
    "confirmed_confidence" DOUBLE PRECISION,
    "confirmation_source" TEXT,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "health_state" TEXT,
    "health_conditions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scan_plant_identifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "scan_plant_identifications_scan_id_key" ON "scan_plant_identifications"("scan_id");
CREATE INDEX IF NOT EXISTS "idx_scan_plant_ident_user" ON "scan_plant_identifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_scan_plant_ident_confirmed" ON "scan_plant_identifications"("confirmed_at");
