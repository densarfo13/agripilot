-- Production infra spec §3 — additional indexes for the
-- marketplace + payments tables to keep query times bounded
-- as we approach the 1k–10k user ceiling.
--
-- Each new index uses CREATE INDEX IF NOT EXISTS so a partial
-- previous run / a manual hotfix on the database can re-apply
-- this migration without erroring.

-- ProduceListing — region filter for the marketplace browse
-- screen (status + crop + farmId + createdAt are already
-- indexed via the previous migration).
CREATE INDEX IF NOT EXISTS "idx_produce_listings_region"
  ON "produce_listings" ("region");

-- BuyerRequest — region filter + recency sort.
CREATE INDEX IF NOT EXISTS "idx_buyer_requests_region"
  ON "buyer_requests" ("region");
CREATE INDEX IF NOT EXISTS "idx_buyer_requests_created"
  ON "buyer_requests" ("created_at");

-- MarketplacePayment — recency sort for ledger / admin reads.
CREATE INDEX IF NOT EXISTS "idx_marketplace_payments_created"
  ON "marketplace_payments" ("created_at");
