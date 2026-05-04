-- Decision Engine V2 — first-class persistence tables.
--
-- Replaces the ClientEvent-only approximation we shipped in
-- the previous decisionV2 commit with real tables so:
--   • the Progress screen can paginate decision history,
--   • completion + outcome feedback close the learning loop,
--   • admin dashboards can audit confidence + priority bands.
--
-- All four tables are scoped by `user_id`. Routes enforce
-- ownership before reading/writing; no FK to users so a hard
-- delete elsewhere doesn't cascade through history.

-- ─── decision_contexts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "decision_contexts" (
  "id"                     TEXT      PRIMARY KEY,
  "user_id"                TEXT      NOT NULL,
  "farm_id"                TEXT,
  "garden_id"              TEXT,
  "user_type"              TEXT      NOT NULL,
  "crop_or_plant"          TEXT,
  "growth_stage"           TEXT,
  "weather_condition"      TEXT,
  "temperature"            DOUBLE PRECISION,
  "humidity"               DOUBLE PRECISION,
  "rainfall_probability"   DOUBLE PRECISION,
  "soil_moisture_level"    TEXT,
  "soil_type"              TEXT,
  "satellite_stress_level" TEXT,
  "vegetation_index"       DOUBLE PRECISION,
  "region_pest_risk"       TEXT,
  "region_disease_risk"    TEXT,
  "recent_scan_status"     TEXT,
  "recent_scan_issue_type" TEXT,
  "last_watered_at"        TIMESTAMP,
  "last_inspected_at"      TIMESTAMP,
  "created_at"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_decision_ctx_user_time"
  ON "decision_contexts" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_decision_ctx_farm"
  ON "decision_contexts" ("farm_id");

-- ─── daily_decisions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "daily_decisions" (
  "id"             TEXT      PRIMARY KEY,
  "user_id"        TEXT      NOT NULL,
  "farm_id"        TEXT,
  "garden_id"      TEXT,
  "context_id"     TEXT,
  "primary_action" TEXT      NOT NULL,
  "primary_cta"    TEXT      NOT NULL,
  "reason"         TEXT      NOT NULL,
  "priority"       INTEGER   NOT NULL DEFAULT 8,
  "confidence"     TEXT      NOT NULL DEFAULT 'low',
  "rule_id"        TEXT,
  "source_signals" JSONB,
  "tomorrow_hook"  TEXT,
  "language"       TEXT      NOT NULL DEFAULT 'en',
  "completed"      BOOLEAN   NOT NULL DEFAULT FALSE,
  "completed_at"   TIMESTAMP,
  "created_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_daily_decision_user_time"
  ON "daily_decisions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_daily_decision_user_completed"
  ON "daily_decisions" ("user_id", "completed");
CREATE INDEX IF NOT EXISTS "idx_daily_decision_farm"
  ON "daily_decisions" ("farm_id");

-- ─── action_completions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "action_completions" (
  "id"               TEXT      PRIMARY KEY,
  "user_id"          TEXT      NOT NULL,
  "decision_id"      TEXT      NOT NULL,
  "action_type"      TEXT,
  "completed_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "context_snapshot" JSONB
);

CREATE INDEX IF NOT EXISTS "idx_action_completion_user_time"
  ON "action_completions" ("user_id", "completed_at");
CREATE INDEX IF NOT EXISTS "idx_action_completion_decision"
  ON "action_completions" ("decision_id");

-- ─── outcome_feedback ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "outcome_feedback" (
  "id"          TEXT      PRIMARY KEY,
  "user_id"     TEXT      NOT NULL,
  "decision_id" TEXT      NOT NULL,
  "result"      TEXT      NOT NULL,
  "notes"       TEXT,
  "created_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_outcome_user_time"
  ON "outcome_feedback" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_outcome_decision"
  ON "outcome_feedback" ("decision_id");
