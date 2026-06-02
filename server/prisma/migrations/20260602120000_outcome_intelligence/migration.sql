-- Outcome Intelligence Platform — measurement schema.
--
-- Four append-only tables. NO schema mutations of existing tables.
-- userId is free-form (no FK) so user deletes don't cascade.
--
-- task_outcomes           — Did you complete this task? Yes/Partial/No
-- recommendation_outcomes — 3/7/14-day follow-up: Improved/Same/Worse
-- photo_comparisons       — Before/After pairs keyed by scan
-- farm_health_scores      — Daily rolled-up per-farm health score

CREATE TABLE IF NOT EXISTS "task_outcomes" (
  "id"            TEXT      PRIMARY KEY,
  "task_id"       TEXT      NOT NULL,
  "user_id"       TEXT,
  "farm_id"       TEXT,
  "scan_id"       TEXT,
  "recommendation" TEXT,
  -- 'yes' | 'partial' | 'no'
  "completion"    TEXT      NOT NULL,
  "note"          TEXT,
  "captured_at"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_task_outcome_task"
  ON "task_outcomes" ("task_id");

CREATE INDEX IF NOT EXISTS "idx_task_outcome_user_time"
  ON "task_outcomes" ("user_id", "captured_at");

CREATE INDEX IF NOT EXISTS "idx_task_outcome_recommendation"
  ON "task_outcomes" ("recommendation");

CREATE TABLE IF NOT EXISTS "recommendation_outcomes" (
  "id"             TEXT      PRIMARY KEY,
  "scan_id"        TEXT      NOT NULL,
  "task_id"        TEXT,
  "user_id"        TEXT,
  "farm_id"        TEXT,
  "recommendation" TEXT      NOT NULL,
  "crop"           TEXT,
  "region"         TEXT,
  "season"         TEXT,
  -- 'disease' | 'pest' | 'soil' | 'other'
  "category"       TEXT      NOT NULL DEFAULT 'other',
  -- 3 | 7 | 14
  "day_offset"     INTEGER   NOT NULL,
  -- 'improved' | 'same' | 'worse'
  "result"         TEXT      NOT NULL,
  "note"           TEXT,
  "captured_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_rec_outcome_scan"
  ON "recommendation_outcomes" ("scan_id");

CREATE INDEX IF NOT EXISTS "idx_rec_outcome_rec_crop_region"
  ON "recommendation_outcomes" ("recommendation", "crop", "region");

CREATE INDEX IF NOT EXISTS "idx_rec_outcome_category_time"
  ON "recommendation_outcomes" ("category", "captured_at");

CREATE TABLE IF NOT EXISTS "photo_comparisons" (
  "id"             TEXT      PRIMARY KEY,
  "scan_id"        TEXT      NOT NULL,
  "user_id"        TEXT,
  "farm_id"        TEXT,
  "before_url"     TEXT      NOT NULL,
  "after_url"      TEXT,
  "before_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "after_at"       TIMESTAMP,
  "improvement_note" TEXT,
  -- 'better' | 'same' | 'worse' | null while pending
  "verdict"        TEXT
);

CREATE INDEX IF NOT EXISTS "idx_photo_pair_scan"
  ON "photo_comparisons" ("scan_id");

CREATE INDEX IF NOT EXISTS "idx_photo_pair_user_time"
  ON "photo_comparisons" ("user_id", "before_at");

CREATE TABLE IF NOT EXISTS "farm_health_scores" (
  "id"                 TEXT      PRIMARY KEY,
  "farm_id"            TEXT      NOT NULL,
  "user_id"            TEXT,
  "snapshot_date"      DATE      NOT NULL,
  -- 0..100
  "score"              INTEGER   NOT NULL,
  -- 'improving' | 'stable' | 'declining' | 'unknown'
  "trend"              TEXT      NOT NULL DEFAULT 'unknown',
  "scans_in_window"    INTEGER   NOT NULL DEFAULT 0,
  "outcomes_recorded"  INTEGER   NOT NULL DEFAULT 0,
  "improvement_rate_pct" DOUBLE PRECISION,
  "computed_at"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_farm_health_farm_date"
  ON "farm_health_scores" ("farm_id", "snapshot_date");

CREATE INDEX IF NOT EXISTS "idx_farm_health_date"
  ON "farm_health_scores" ("snapshot_date");
