-- PROVIDER RELIABILITY — per-call metric rows (24h scorecard is computed from these).
CREATE TABLE IF NOT EXISTS "scan_provider_metrics" (
  "id"                TEXT PRIMARY KEY,
  "provider"          TEXT NOT NULL,
  "status"            TEXT NOT NULL,
  "latency"           INTEGER,
  "confidence"        INTEGER,
  "farmbrain_accepted" BOOLEAN NOT NULL DEFAULT false,
  "retry_count"       INTEGER NOT NULL DEFAULT 0,
  "failure_reason"    TEXT,
  "http_status"       INTEGER,
  "cache_hit"         BOOLEAN NOT NULL DEFAULT false,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_scan_metric_provider" ON "scan_provider_metrics" ("provider");
CREATE INDEX IF NOT EXISTS "idx_scan_metric_created" ON "scan_provider_metrics" ("created_at");
