-- Marketplace v1: crop listings + buyer interest + in-app notifications.
-- Structured matching; contact reveal gated on farmer acceptance.

CREATE TABLE IF NOT EXISTS "crop_listings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "farmer_id" TEXT NOT NULL,
  "farm_profile_id" TEXT,
  "crop_cycle_id" TEXT,
  "crop_key" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'kg',
  "quality" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "state_code" TEXT,
  "city" TEXT,
  "available_from" TIMESTAMPTZ,
  "price" DOUBLE PRECISION,
  "pricing_mode" TEXT NOT NULL DEFAULT 'negotiable',
  "delivery_mode" TEXT NOT NULL DEFAULT 'either',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "support_confidence" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "crop_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crop_listings_crop_cycle_id_key"
  ON "crop_listings" ("crop_cycle_id");

CREATE INDEX IF NOT EXISTS "idx_crop_listing_farmer"  ON "crop_listings" ("farmer_id");
CREATE INDEX IF NOT EXISTS "idx_crop_listing_crop"    ON "crop_listings" ("crop_key");
CREATE INDEX IF NOT EXISTS "idx_crop_listing_country" ON "crop_listings" ("country");
CREATE INDEX IF NOT EXISTS "idx_crop_listing_state"   ON "crop_listings" ("state_code");
CREATE INDEX IF NOT EXISTS "idx_crop_listing_status"  ON "crop_listings" ("status");
CREATE INDEX IF NOT EXISTS "idx_crop_listing_created" ON "crop_listings" ("created_at");

-- "market_buyer_interests" is the marketplace-v1 table. The legacy
-- "buyer_interests" table already exists for a different concept
-- (a farmer's interest in a buyer type); we don't reuse it.
CREATE TABLE IF NOT EXISTS "market_buyer_interests" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "listing_id" TEXT NOT NULL,
  "buyer_id"   TEXT NOT NULL,
  "quantity_requested" DOUBLE PRECISION,
  "offered_price"      DOUBLE PRECISION,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "farmer_response_note" TEXT,
  "responded_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "market_buyer_interests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "market_buyer_interests_listing_id_fkey"
    FOREIGN KEY ("listing_id") REFERENCES "crop_listings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_market_interest_listing" ON "market_buyer_interests" ("listing_id");
CREATE INDEX IF NOT EXISTS "idx_market_interest_buyer"   ON "market_buyer_interests" ("buyer_id");
CREATE INDEX IF NOT EXISTS "idx_market_interest_status"  ON "market_buyer_interests" ("status");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_notification_user_unread" ON "notifications" ("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "idx_notification_user_time"   ON "notifications" ("user_id", "created_at");
