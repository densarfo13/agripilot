-- Data Moat §1 — privacy-safe global insight aggregates.
-- One row per (region × cropOrPlant × setup × condition) with
-- monotonic counter columns. Clients batch-ship deltas via
-- POST /api/insights/batch; service.js upserts and increments.
-- NO per-user data is stored in this table.

CREATE TABLE IF NOT EXISTS "insight_aggregates" (
  "id"             TEXT      PRIMARY KEY,
  "region"         TEXT      NOT NULL,
  "crop_or_plant"  TEXT      NOT NULL,
  "setup"          TEXT,
  "condition"      TEXT      NOT NULL,
  "shown"          INTEGER   NOT NULL DEFAULT 0,
  "completed"      INTEGER   NOT NULL DEFAULT 0,
  "success"        INTEGER   NOT NULL DEFAULT 0,
  "failure"        INTEGER   NOT NULL DEFAULT 0,
  "last_updated"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique key for upserts. NULL setup is allowed (crop-only rows);
-- Postgres treats NULLs as distinct in UNIQUE constraints by
-- default, so we use NULLS NOT DISTINCT to make the upsert
-- idempotent for the crop-only case.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_insight_aggregate_key"
  ON "insight_aggregates" ("region", "crop_or_plant", "setup", "condition")
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS "idx_insight_region"
  ON "insight_aggregates" ("region");
CREATE INDEX IF NOT EXISTS "idx_insight_crop"
  ON "insight_aggregates" ("crop_or_plant");
CREATE INDEX IF NOT EXISTS "idx_insight_condition"
  ON "insight_aggregates" ("condition");

-- Counter floor: counters must never be negative. A trigger
-- reflects the spec's "validate numbers >= 0" rule even if a
-- buggy client tries to push a negative delta.
CREATE OR REPLACE FUNCTION clamp_insight_counters_nonneg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shown     < 0 THEN NEW.shown     := 0; END IF;
  IF NEW.completed < 0 THEN NEW.completed := 0; END IF;
  IF NEW.success   < 0 THEN NEW.success   := 0; END IF;
  IF NEW.failure   < 0 THEN NEW.failure   := 0; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clamp_insight_counters ON "insight_aggregates";
CREATE TRIGGER trg_clamp_insight_counters
  BEFORE INSERT OR UPDATE ON "insight_aggregates"
  FOR EACH ROW EXECUTE FUNCTION clamp_insight_counters_nonneg();
