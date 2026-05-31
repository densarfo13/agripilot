-- perf_indexes.sql — STAGED, non-destructive performance indexes.
-- Operator-applied during a maintenance window; NEVER run from CI.
-- All statements are additive CREATE INDEX (IF NOT EXISTS) — no data
-- rewrite, no column/table drops. See docs/PERFORMANCE_DB_INDEXES.md.
--
-- Table names below use the Prisma @@map physical names where they
-- differ; adjust to the actual table names if a model maps elsewhere.
-- Wrapped IF NOT EXISTS so re-applying is a no-op.

-- User: role gating + active-user counts
CREATE INDEX IF NOT EXISTS idx_user_role        ON "User" ("role");
CREATE INDEX IF NOT EXISTS idx_user_active       ON "User" ("active");

-- Farmer: NGO roster + pending approval + recency
CREATE INDEX IF NOT EXISTS idx_farmer_org_status ON "Farmer" ("organizationId", "registrationStatus");
CREATE INDEX IF NOT EXISTS idx_farmer_created     ON "Farmer" ("createdAt");

-- Farm / season
CREATE INDEX IF NOT EXISTS idx_farm_user          ON "Farm" ("userId");
CREATE INDEX IF NOT EXISTS idx_farmseason_status   ON "FarmSeason" ("status");

-- Managed plants
CREATE INDEX IF NOT EXISTS idx_plant_user_created ON "ManagedPlant" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_plant_farm          ON "ManagedPlant" ("farmId");

-- Tasks
CREATE INDEX IF NOT EXISTS idx_task_user_status    ON "Task" ("userId", "status");
CREATE INDEX IF NOT EXISTS idx_task_farm_created   ON "Task" ("farmId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_task_status         ON "Task" ("status");

-- Activity events (timeline + org rollups)
CREATE INDEX IF NOT EXISTS idx_activity_user_created ON "ActivityEvent" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_activity_org_created  ON "ActivityEvent" ("organizationId", "createdAt");

-- Invites: activation lookup uses the token HASH (never raw token)
CREATE INDEX IF NOT EXISTS idx_invite_token_hash   ON "Invite" ("tokenHash");
CREATE INDEX IF NOT EXISTS idx_invite_org_status    ON "Invite" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS idx_invite_created       ON "Invite" ("createdAt");

-- Buyer listings: public/approved feed
CREATE INDEX IF NOT EXISTS idx_buyerlisting_status_created ON "BuyerListing" ("status", "createdAt");

-- ── Staged models (only take effect after they are migrated) ─────
-- EnrollmentBatch / EnrollmentBatchRow / ImpactReport live in
-- _pending-migrations/ today; these indexes are listed here so they
-- land in the same operator pass once those models are applied.
-- CREATE INDEX IF NOT EXISTS idx_enrollbatch_org_created ON "EnrollmentBatch" ("organizationId", "createdAt");
-- CREATE INDEX IF NOT EXISTS idx_enrollrow_batch          ON "EnrollmentBatchRow" ("batchId");
-- CREATE INDEX IF NOT EXISTS idx_impactreport_org_created ON "ImpactReport" ("organizationId", "createdAt");
