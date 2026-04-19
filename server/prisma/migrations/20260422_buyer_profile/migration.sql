-- Buyer preference store. One row per user, lazy-created on first
-- profile read / write.

CREATE TABLE IF NOT EXISTS "buyer_profiles" (
  "id"                   TEXT      NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"              TEXT      NOT NULL,
  "preferred_countries"  TEXT[]    NOT NULL DEFAULT '{}',
  "preferred_regions"    JSONB     NOT NULL DEFAULT '[]'::jsonb,
  "expand_search"        BOOLEAN   NOT NULL DEFAULT false,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "buyer_profiles_user_id_key" ON "buyer_profiles" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_profile_user" ON "buyer_profiles" ("user_id");
