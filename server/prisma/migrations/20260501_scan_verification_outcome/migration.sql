-- High-confidence ML scan layer (spec §6) — extend
-- scan_training_events with verification answers + eventual
-- outcome columns for future training + evaluation.

ALTER TABLE "scan_training_events"
  ADD COLUMN IF NOT EXISTS "verification_answers"   JSONB,
  ADD COLUMN IF NOT EXISTS "verification_downgrade" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "outcome"                TEXT,
  ADD COLUMN IF NOT EXISTS "outcome_note"           TEXT;

CREATE INDEX IF NOT EXISTS "idx_scan_train_outcome"
  ON "scan_training_events" ("outcome");
