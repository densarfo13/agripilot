-- Migration: client_events + risk_snapshots
--
-- Pairs with the data-foundation v2 ingest layer at
-- server/src/modules/ingest/. Both tables are append-only;
-- cleanup is handled by the maintenance helpers
-- (server/src/modules/ingest/maintenance.js).
--
-- Idempotent: every CREATE uses IF NOT EXISTS so a partially-
-- applied migration can be safely re-run by Railway's
-- prisma-deploy-with-baseline script.

-- ─── client_events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "client_events" (
  "id"          TEXT          PRIMARY KEY,
  "farmer_id"   TEXT,
  "farm_id"     TEXT,
  "type"        TEXT          NOT NULL,
  "payload"     JSONB,
  "created_at"  TIMESTAMP(3)  NOT NULL,
  "received_at" TIMESTAMP(3)  NOT NULL DEFAULT NOW(),
  "app_version" TEXT,
  "offline"     BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS "idx_client_events_type"
  ON "client_events" ("type");

CREATE INDEX IF NOT EXISTS "idx_client_events_created_at"
  ON "client_events" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_client_events_farm"
  ON "client_events" ("farm_id");

CREATE INDEX IF NOT EXISTS "idx_client_events_farmer_time"
  ON "client_events" ("farmer_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_client_events_type_time"
  ON "client_events" ("type", "created_at");

-- ─── risk_snapshots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "risk_snapshots" (
  "id"          TEXT          PRIMARY KEY,
  "farm_id"     TEXT          NOT NULL,
  "risk_type"   TEXT          NOT NULL,
  "risk_level"  TEXT          NOT NULL,
  "score"       DOUBLE PRECISION,
  "reasons"     JSONB,
  "region"      TEXT,
  "country"     TEXT,
  "district"    TEXT,
  "cluster_id"  TEXT,
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_risk_farm_time"
  ON "risk_snapshots" ("farm_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_risk_region_time"
  ON "risk_snapshots" ("region", "created_at");

CREATE INDEX IF NOT EXISTS "idx_risk_level"
  ON "risk_snapshots" ("risk_level");

CREATE INDEX IF NOT EXISTS "idx_risk_type_level"
  ON "risk_snapshots" ("risk_type", "risk_level");
