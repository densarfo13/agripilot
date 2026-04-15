-- Server-side task completion tracking for the farm task engine.
-- Replaces localStorage-only completion with persistent DB records.
-- Compound unique on (farm_id, task_rule_id) ensures idempotent completion.

CREATE TABLE IF NOT EXISTS "v2_farm_task_completions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "farm_id" TEXT NOT NULL,
  "task_rule_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "action_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "v2_farm_task_completions_pkey" PRIMARY KEY ("id")
);

-- Compound unique: one completion per rule per farm
CREATE UNIQUE INDEX "v2_farm_task_completions_farm_id_task_rule_id_key"
  ON "v2_farm_task_completions" ("farm_id", "task_rule_id");

-- Indexes for common queries
CREATE INDEX "v2_farm_task_completions_user_id_idx"
  ON "v2_farm_task_completions" ("user_id");

CREATE INDEX "v2_farm_task_completions_farm_id_idx"
  ON "v2_farm_task_completions" ("farm_id");

CREATE INDEX "v2_farm_task_completions_completed_at_idx"
  ON "v2_farm_task_completions" ("completed_at");

-- Foreign keys
ALTER TABLE "v2_farm_task_completions"
  ADD CONSTRAINT "v2_farm_task_completions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "v2_farm_task_completions"
  ADD CONSTRAINT "v2_farm_task_completions_farm_id_fkey"
  FOREIGN KEY ("farm_id") REFERENCES "farm_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
