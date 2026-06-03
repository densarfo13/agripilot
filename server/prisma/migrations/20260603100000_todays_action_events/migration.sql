-- Today's Action funnel — append-only event log for the 5-step
-- KPI funnel (Shown / Started / Completed / OutcomeRecorded /
-- FollowUpCompleted).
--
-- NO PII — userId is free-form (no FK). One table; no joins
-- needed because the funnel is a pure groupby on `kind`.

CREATE TABLE IF NOT EXISTS "todays_action_events" (
  "id"             TEXT      PRIMARY KEY,
  "user_id"        TEXT,
  "action_id"      TEXT,
  "task_id"        TEXT,
  "scan_id"        TEXT,
  -- 'shown' | 'started' | 'completed' | 'outcome_recorded' | 'follow_up_completed'
  "kind"           TEXT      NOT NULL,
  -- 'better' | 'same' | 'worse' (only set when kind='outcome_recorded')
  "outcome"        TEXT,
  -- Free-form structured payload (priority/category/etc.) for
  -- post-hoc analysis; never carries PII.
  "metadata"       JSONB,
  "captured_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_todays_action_kind_time"
  ON "todays_action_events" ("kind", "captured_at");

CREATE INDEX IF NOT EXISTS "idx_todays_action_user_time"
  ON "todays_action_events" ("user_id", "captured_at");

CREATE INDEX IF NOT EXISTS "idx_todays_action_action_id"
  ON "todays_action_events" ("action_id");
