-- Add normalizedAreaSqm column to FarmProfile and the two legacy
-- farm-shaped tables that mirror the same shape. Backfill from
-- existing landSizeHectares (× 10000) so historical rows aren't
-- left null. New writes will populate it directly via service code.
--
-- Also add notification preference columns to Farmer (P2.7) so the
-- adapter's literacyMode + per-channel toggles can survive restarts.

-- ─── FarmProfile (canonical) ──────────────────────────────────
ALTER TABLE "farm_profiles"
  ADD COLUMN IF NOT EXISTS "normalized_area_sqm" DOUBLE PRECISION;

UPDATE "farm_profiles"
   SET "normalized_area_sqm" = "land_size_hectares" * 10000
 WHERE "normalized_area_sqm" IS NULL
   AND "land_size_hectares"  IS NOT NULL;

-- ─── Legacy farm shapes (best-effort columns; ignore if absent) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_name = 'farms' AND table_schema = current_schema()) THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'farms'
                      AND column_name = 'normalized_area_sqm') THEN
      EXECUTE 'ALTER TABLE "farms" ADD COLUMN "normalized_area_sqm" DOUBLE PRECISION';
      EXECUTE 'UPDATE "farms" SET "normalized_area_sqm" = "land_size_hectares" * 10000 '
           || 'WHERE "land_size_hectares" IS NOT NULL';
    END IF;
  END IF;
END$$;

-- ─── Notification preferences on Farmer (P2.7) ───────────────
ALTER TABLE "farmers"
  ADD COLUMN IF NOT EXISTS "receive_sms"           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "receive_whatsapp"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "receive_voice_alerts"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "literacy_mode"         TEXT    NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS "preferred_reminder_time" TEXT  NOT NULL DEFAULT 'morning';
