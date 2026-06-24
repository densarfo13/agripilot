-- FARM_PERSISTENCE_V1 — durable source of truth for farmer state.
-- One generic row per (user_id, domain, record_id); all five domains
-- (plants | scanHistory | tasks | outcomes | timeline) share this table.
-- localStorage becomes a cache; this is the recovery source.

CREATE TABLE IF NOT EXISTS "farm_state_records" (
  "id"                 TEXT             PRIMARY KEY,
  "user_id"            TEXT             NOT NULL,
  "domain"             TEXT             NOT NULL,
  "record_id"          TEXT             NOT NULL,
  "payload"            JSONB            NOT NULL,
  "deleted"            BOOLEAN          NOT NULL DEFAULT false,
  "client_updated_at"  DOUBLE PRECISION,
  "updated_at"         TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"         TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_farm_state_user_domain_record"
  ON "farm_state_records" ("user_id", "domain", "record_id");

CREATE INDEX IF NOT EXISTS "idx_farm_state_user_domain"
  ON "farm_state_records" ("user_id", "domain");

CREATE INDEX IF NOT EXISTS "idx_farm_state_updated"
  ON "farm_state_records" ("updated_at");
