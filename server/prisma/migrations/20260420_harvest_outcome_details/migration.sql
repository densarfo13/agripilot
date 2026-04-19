-- Post-harvest flow upgrade: farmer-captured issues[], farmer-reported
-- harvest date, and a persisted outcome class so future aggregations
-- don't need to re-derive it.

ALTER TABLE "harvest_outcomes"
  ADD COLUMN IF NOT EXISTS "issue_tags"    JSONB,
  ADD COLUMN IF NOT EXISTS "harvested_at"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "outcome_class" TEXT;

CREATE INDEX IF NOT EXISTS "idx_harvest_outcome_class"
  ON "harvest_outcomes" ("outcome_class");
