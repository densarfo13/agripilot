-- Composite index for getReliabilityScorecard(): WHERE provider = ? AND created_at >= ?
-- Additive + idempotent; no data change.
CREATE INDEX IF NOT EXISTS "idx_scan_metric_provider_time"
  ON "scan_provider_metrics" ("provider", "created_at");
