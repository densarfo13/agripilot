-- Advanced ML scan layer spec §10 — append-only training-data
-- ledger. Every scan + the user / expert feedback applied to it
-- lands here. Drives V2 custom model training when enough
-- volume accumulates. Indexed for cohort sampling (crop +
-- country + region) and recency cuts.

CREATE TABLE IF NOT EXISTS "scan_training_events" (
  "id"               TEXT      PRIMARY KEY,
  "scan_id"          TEXT      NOT NULL,
  "user_id"          TEXT,
  "image_url"        TEXT,
  "crop_name"        TEXT,
  "plant_name"       TEXT,
  "country"          TEXT,
  "region"           TEXT,
  "weather_summary"  JSONB,
  "predicted_issue"  TEXT,
  "confidence"       TEXT,
  "user_feedback"    TEXT,
  "corrected_issue"  TEXT,
  "expert_label"     TEXT,
  "created_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_scan_train_scan"
  ON "scan_training_events" ("scan_id");
CREATE INDEX IF NOT EXISTS "idx_scan_train_crop"
  ON "scan_training_events" ("crop_name");
CREATE INDEX IF NOT EXISTS "idx_scan_train_country_region"
  ON "scan_training_events" ("country", "region");
CREATE INDEX IF NOT EXISTS "idx_scan_train_issue_time"
  ON "scan_training_events" ("predicted_issue", "created_at");
CREATE INDEX IF NOT EXISTS "idx_scan_train_feedback"
  ON "scan_training_events" ("user_feedback");
CREATE INDEX IF NOT EXISTS "idx_scan_train_created"
  ON "scan_training_events" ("created_at");
