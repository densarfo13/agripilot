-- PRODUCTION CERTIFICATION — provider certification rows (live runtime evidence).
CREATE TABLE IF NOT EXISTS "scan_provider_certifications" (
  "id"             TEXT PRIMARY KEY,
  "provider"       TEXT NOT NULL,
  "status"         TEXT NOT NULL,
  "latency"        INTEGER,
  "confidence"     INTEGER,
  "auth"           BOOLEAN NOT NULL DEFAULT false,
  "credits"        BOOLEAN NOT NULL DEFAULT true,
  "environment"    TEXT,
  "build_sha"      TEXT,
  "api_version"    TEXT,
  "last_success"   TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_scan_cert_provider" ON "scan_provider_certifications" ("provider");
CREATE INDEX IF NOT EXISTS "idx_scan_cert_created" ON "scan_provider_certifications" ("created_at");
