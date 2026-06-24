-- SCAN_OBSERVABILITY_V1 — one durable row per scan.
-- scan_id is UNIQUE so there are NO duplicate rows (unlike the legacy
-- scan_training_events). Append/upsert only; user_id is free-form (no
-- FK), matching the ML-table convention. No PII.

CREATE TABLE IF NOT EXISTS "scan_observability_events" (
  "id"               TEXT      PRIMARY KEY,
  "scan_id"          TEXT      NOT NULL,
  "user_id"          TEXT,
  "photo_quality"    TEXT,
  "provider"         TEXT,
  "crop_name"        TEXT,
  "confidence"       INTEGER,
  "confidence_band"  TEXT,
  "health_detected"  BOOLEAN   NOT NULL DEFAULT false,
  "detected_issue"   TEXT,
  "insect_detected"  BOOLEAN   NOT NULL DEFAULT false,
  "detected_insect"  TEXT,
  "task_created"     BOOLEAN   NOT NULL DEFAULT false,
  "plant_saved"      BOOLEAN   NOT NULL DEFAULT false,
  "duration_ms"      INTEGER,
  "success"          BOOLEAN   NOT NULL DEFAULT false,
  "failure_reason"   TEXT,
  "created_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScanObservabilityEvent_scan_id_key"
  ON "scan_observability_events" ("scan_id");

CREATE INDEX IF NOT EXISTS "idx_scan_obs_created"
  ON "scan_observability_events" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_scan_obs_crop"
  ON "scan_observability_events" ("crop_name");

CREATE INDEX IF NOT EXISTS "idx_scan_obs_issue"
  ON "scan_observability_events" ("detected_issue");
