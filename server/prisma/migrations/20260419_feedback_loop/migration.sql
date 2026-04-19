-- Feedback loop: action log + harvest outcome + cycle risk band.
--
-- Adds:
--   farmer_action_logs   append-only ledger of farmer actions
--   harvest_outcomes     durable per-cycle harvest record for the
--                        future recommendation tuner
--   v2_crop_cycles.risk_band  action-driven risk band persisted on
--                        the cycle so the Today engine can honour
--                        immediate feedback without recomputing.

-- ─── farmer_action_logs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "farmer_action_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "farm_profile_id" TEXT,
  "crop_cycle_id" TEXT,
  "user_id" TEXT,
  "action_type" TEXT NOT NULL,        -- task_completed | task_skipped | issue_reported | harvest_reported
  "subject_type" TEXT,                -- task | issue | harvest
  "subject_id" TEXT,
  "details" JSONB,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "farmer_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_action_log_farm"  ON "farmer_action_logs" ("farm_profile_id");
CREATE INDEX IF NOT EXISTS "idx_action_log_cycle" ON "farmer_action_logs" ("crop_cycle_id");
CREATE INDEX IF NOT EXISTS "idx_action_log_type"  ON "farmer_action_logs" ("action_type");
CREATE INDEX IF NOT EXISTS "idx_action_log_time"  ON "farmer_action_logs" ("occurred_at");

-- ─── harvest_outcomes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "harvest_outcomes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "farm_profile_id" TEXT,
  "crop_cycle_id" TEXT NOT NULL,
  "crop_key" TEXT,
  "actual_yield_kg" DOUBLE PRECISION,
  "yield_unit" TEXT NOT NULL DEFAULT 'kg',
  "quality_band" TEXT,                 -- poor | fair | good | excellent
  "completed_tasks_count" INTEGER,
  "skipped_tasks_count" INTEGER,
  "overdue_tasks_count" INTEGER,
  "issue_count" INTEGER,
  "notes" TEXT,
  "reported_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "harvest_outcomes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "harvest_outcomes_crop_cycle_id_key" UNIQUE ("crop_cycle_id")
);

CREATE INDEX IF NOT EXISTS "idx_harvest_outcome_farm"    ON "harvest_outcomes" ("farm_profile_id");
CREATE INDEX IF NOT EXISTS "idx_harvest_outcome_crop"    ON "harvest_outcomes" ("crop_key");
CREATE INDEX IF NOT EXISTS "idx_harvest_outcome_quality" ON "harvest_outcomes" ("quality_band");

-- ─── v2_crop_cycles.risk_band ──────────────────────────────
-- Nullable so existing rows stay valid; the feedback service
-- writes this on every meaningful action.
ALTER TABLE "v2_crop_cycles"
  ADD COLUMN IF NOT EXISTS "risk_band" TEXT;

CREATE INDEX IF NOT EXISTS "idx_v2_crop_cycle_risk_band"
  ON "v2_crop_cycles" ("risk_band");
