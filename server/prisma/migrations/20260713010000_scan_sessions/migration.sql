-- Guided multi-view scan sessions (PR-B). Three additive, fully-nullable-where-safe
-- tables. scan_session_images has a UNIQUE (session_id, image_hash) for dedup +
-- concurrent-safety. Foreign keys cascade on session delete.

CREATE TABLE IF NOT EXISTS "scan_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "farm_id" TEXT,
    "field_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'SESSION_CREATED',
    "requested_view" TEXT,
    "requested_reason_code" TEXT,
    "image_count" INTEGER NOT NULL DEFAULT 0,
    "identification_call_count" INTEGER NOT NULL DEFAULT 0,
    "health_call_count" INTEGER NOT NULL DEFAULT 0,
    "identification_state" TEXT,
    "health_state" TEXT,
    "candidates" JSONB,
    "confirmed_taxon_id" TEXT,
    "crop_name" TEXT,
    "region" TEXT,
    "entitlement_charged_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scan_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_scan_session_user" ON "scan_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_scan_session_state" ON "scan_sessions"("state");
CREATE INDEX IF NOT EXISTS "idx_scan_session_expires" ON "scan_sessions"("expires_at");

CREATE TABLE IF NOT EXISTS "scan_session_images" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "image_hash" TEXT NOT NULL,
    "storage_ref" TEXT,
    "view_type" TEXT NOT NULL,
    "capture_order" INTEGER NOT NULL,
    "quality_state" TEXT,
    "quality_reasons" JSONB,
    "provider_result" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_session_images_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_scan_session_image_hash" ON "scan_session_images"("session_id", "image_hash");
CREATE INDEX IF NOT EXISTS "idx_scan_session_image_session" ON "scan_session_images"("session_id");

CREATE TABLE IF NOT EXISTS "scan_session_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_session_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_scan_session_event_session" ON "scan_session_events"("session_id");

DO $$ BEGIN
  ALTER TABLE "scan_session_images" ADD CONSTRAINT "scan_session_images_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "scan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "scan_session_events" ADD CONSTRAINT "scan_session_events_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "scan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
