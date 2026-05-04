-- ML Task Scoring Layer v1 — append-only ledger.
--
-- Every task the smart engine surfaces is recorded along with
-- the input context (crop / stage / weather) and the outcome
-- (completed / skipped / completion time). Drives future ML
-- training when enough data accumulates.
--
-- userId is free-form (no FK) so user deletes don't cascade
-- through training data.

CREATE TABLE IF NOT EXISTS "task_interactions" (
  "id"                       TEXT      PRIMARY KEY,
  "user_id"                  TEXT      NOT NULL,
  "task_title"               TEXT      NOT NULL,
  "category"                 TEXT,
  "crop"                     TEXT,
  "crop_stage"               TEXT,
  "weather_condition"        TEXT,
  "rain_chance"              DOUBLE PRECISION,
  "region"                   TEXT,
  "user_type"                TEXT,
  "score"                    INTEGER,
  "shown_at"                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"             TIMESTAMP,
  "skipped_at"               TIMESTAMP,
  "completion_time_seconds"  INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_task_interaction_user_time"
  ON "task_interactions" ("user_id", "shown_at");

CREATE INDEX IF NOT EXISTS "idx_task_interaction_category_time"
  ON "task_interactions" ("category", "shown_at");

CREATE INDEX IF NOT EXISTS "idx_task_interaction_crop_stage"
  ON "task_interactions" ("crop", "crop_stage");
