-- Migration: org scoping for ingest tables
--
-- Adds org_id columns + indexes to client_events and
-- risk_snapshots so every NGO read can filter cleanly. The
-- existing `organizations` slot in the codebase lives on the
-- Organization model (see schema.prisma line 21+); this
-- migration does NOT recreate it — only the FK target columns
-- on the new ingest-side tables.
--
-- All ALTER + CREATE statements use IF NOT EXISTS so the
-- migration is safe to re-run via prisma-deploy-with-baseline
-- on a partially-applied database.
--
-- Strict-rule audit
--   * Backfill is intentionally NULL: rows that landed before
--     this migration carry no org context, and the API layer
--     handles NULL org_id as "unscoped legacy data" — no
--     attempt to guess an org per row (which would risk
--     leaking data across orgs).
--   * Every new index pairs org_id with a hot read column so
--     scoped queries stay fast.

-- ─── client_events ─────────────────────────────────────────
ALTER TABLE "client_events"
  ADD COLUMN IF NOT EXISTS "org_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_client_events_org"
  ON "client_events" ("org_id");

CREATE INDEX IF NOT EXISTS "idx_client_events_org_type"
  ON "client_events" ("org_id", "type");

CREATE INDEX IF NOT EXISTS "idx_client_events_org_created"
  ON "client_events" ("org_id", "created_at");

-- ─── risk_snapshots ───────────────────────────────────────
ALTER TABLE "risk_snapshots"
  ADD COLUMN IF NOT EXISTS "org_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_risk_org"
  ON "risk_snapshots" ("org_id");
