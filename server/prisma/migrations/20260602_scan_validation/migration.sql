-- Scan Pilot Validation — admin measurement framework.
--
-- Three append-only tables:
--   scan_validations  — every analyzed image + the model's
--                       predictions + the human-labelled ground truth
--   scan_feedbacks    — farmer ✓/✗ confirmations on the result
--   scan_accuracies   — rolled-up daily accuracy snapshots so the
--                       dashboard doesn't recompute over the full
--                       validation set on every request
--
-- userId is free-form (no FK) so user deletes don't cascade
-- through measurement data — same convention as scan_training_events
-- + task_interactions.
--
-- All `CREATE TABLE IF NOT EXISTS` so the migration is safe to
-- re-apply on a baselined schema.

CREATE TABLE IF NOT EXISTS "scan_validations" (
  "id"                  TEXT      PRIMARY KEY,
  "scan_id"             TEXT      NOT NULL,
  "user_id"             TEXT,
  "image_url"           TEXT,

  -- Model predictions captured at analyze time.
  "predicted_plant"     TEXT,
  "predicted_disease"   TEXT,
  "predicted_pest"      TEXT,
  "confidence_pct"      INTEGER,
  "consensus_mode"      TEXT,
  "latency_ms"          INTEGER,

  -- Human ground-truth label (set later via the lab page).
  "actual_plant"        TEXT,
  "actual_disease"      TEXT,
  "actual_pest"         TEXT,
  "labeled_by"          TEXT,
  "labeled_at"          TIMESTAMP,

  -- Roll-up outcome: 'correct' | 'partial' | 'incorrect' | 'unknown'
  -- Derived when both predicted + actual are present; until then 'unknown'.
  "result"              TEXT      NOT NULL DEFAULT 'unknown',

  -- Source tag — 'scan_lab' for admin-uploaded validation runs;
  -- 'farmer_scan' when promoted from a real scan with feedback.
  "source"              TEXT      NOT NULL DEFAULT 'scan_lab',

  -- Free-form notes the lab operator captured.
  "notes"               TEXT,

  "created_at"          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_scan_validation_scan"
  ON "scan_validations" ("scan_id");

CREATE INDEX IF NOT EXISTS "idx_scan_validation_result_time"
  ON "scan_validations" ("result", "created_at");

CREATE INDEX IF NOT EXISTS "idx_scan_validation_plant_pred"
  ON "scan_validations" ("predicted_plant");

CREATE INDEX IF NOT EXISTS "idx_scan_validation_disease_pred"
  ON "scan_validations" ("predicted_disease");

-- Per-scan farmer feedback. Multiple rows per scan are allowed so
-- the user can update their answer.
CREATE TABLE IF NOT EXISTS "scan_feedbacks" (
  "id"               TEXT      PRIMARY KEY,
  "scan_id"          TEXT      NOT NULL,
  "user_id"          TEXT,
  -- One of: 'correct' | 'incorrect' | 'partial'
  "feedback"         TEXT      NOT NULL,
  -- When 'incorrect', the user's correction.
  "corrected_plant"  TEXT,
  "corrected_disease" TEXT,
  "corrected_pest"   TEXT,
  -- Source tag: 'scan_lab' | 'result_card' | 'follow_up'
  "source"           TEXT      NOT NULL DEFAULT 'scan_lab',
  "created_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_scan_feedback_scan"
  ON "scan_feedbacks" ("scan_id");

CREATE INDEX IF NOT EXISTS "idx_scan_feedback_user_time"
  ON "scan_feedbacks" ("user_id", "created_at");

-- Daily accuracy snapshots. The dashboard reads the most-recent
-- row; the rollup job updates / inserts once per day. Pure
-- aggregate — never carries PII.
CREATE TABLE IF NOT EXISTS "scan_accuracies" (
  "id"                       TEXT      PRIMARY KEY,
  "snapshot_date"            DATE      NOT NULL UNIQUE,
  "total_validations"        INTEGER   NOT NULL DEFAULT 0,
  "labeled_count"            INTEGER   NOT NULL DEFAULT 0,
  "plant_correct_count"      INTEGER   NOT NULL DEFAULT 0,
  "disease_correct_count"    INTEGER   NOT NULL DEFAULT 0,
  "pest_correct_count"       INTEGER   NOT NULL DEFAULT 0,
  "unknown_count"            INTEGER   NOT NULL DEFAULT 0,
  "false_positive_count"     INTEGER   NOT NULL DEFAULT 0,
  "average_confidence_pct"   DOUBLE PRECISION,
  "confidence_inflation_pct" DOUBLE PRECISION,
  "computed_at"              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_scan_accuracy_date"
  ON "scan_accuracies" ("snapshot_date");
