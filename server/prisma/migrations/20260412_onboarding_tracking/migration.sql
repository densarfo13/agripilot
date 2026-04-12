-- CreateEnum: OnboardingStatus
CREATE TYPE "OnboardingStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'abandoned');

-- AlterTable: users — add onboarding tracking columns
ALTER TABLE "users"
  ADD COLUMN "onboarding_status"     "OnboardingStatus" NOT NULL DEFAULT 'not_started',
  ADD COLUMN "onboarding_started_at" TIMESTAMP(3),
  ADD COLUMN "onboarded_at"          TIMESTAMP(3),
  ADD COLUMN "onboarding_last_step"  TEXT,
  ADD COLUMN "onboarding_source"     TEXT,
  ADD COLUMN "timezone"              TEXT;

-- Back-fill: mark users who already completed onboarding
-- (users linked to a Farmer with onboardingCompletedAt set)
UPDATE "users" u
SET "onboarding_status" = 'completed',
    "onboarded_at" = f."onboarding_completed_at"
FROM "farmers" f
WHERE f."user_account_id" = u."id"
  AND f."onboarding_completed_at" IS NOT NULL;

-- Back-fill: users with a farmer profile but no completedAt → in_progress
UPDATE "users" u
SET "onboarding_status" = 'in_progress'
FROM "farmers" f
WHERE f."user_account_id" = u."id"
  AND f."onboarding_completed_at" IS NULL
  AND u."onboarding_status" = 'not_started';

-- CreateIndex: idx_users_onboarding_status
CREATE INDEX "idx_users_onboarding_status" ON "users"("onboarding_status");

-- CreateTable: onboarding_events
CREATE TABLE "onboarding_events" (
  "id"              TEXT         NOT NULL,
  "user_id"         TEXT         NOT NULL,
  "event_type"      TEXT         NOT NULL,
  "step_name"       TEXT,
  "metadata_json"   JSONB,
  "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "onboarding_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: onboarding_events indexes
CREATE INDEX "idx_onboarding_events_user" ON "onboarding_events"("user_id");
CREATE INDEX "idx_onboarding_events_type" ON "onboarding_events"("event_type");
CREATE INDEX "idx_onboarding_events_ts"   ON "onboarding_events"("event_timestamp");

-- AddForeignKey
ALTER TABLE "onboarding_events"
  ADD CONSTRAINT "onboarding_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
