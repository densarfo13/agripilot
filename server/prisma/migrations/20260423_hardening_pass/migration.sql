-- Hardening pass: analytics event log.

CREATE TABLE IF NOT EXISTS "event_logs" (
  "id"          TEXT      NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"     TEXT,
  "event_type"  TEXT      NOT NULL,
  "metadata"    JSONB,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_event_log_type_time" ON "event_logs" ("event_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_event_log_user_time" ON "event_logs" ("user_id", "occurred_at");
