# Finance + Insurance Integration Report

## Shipped: `src/runtime/finance/FinanceEligibilityEngine.ts` (pure, tested, gate-locked)
- **`buildFinanceProfile`** — from REAL activity only (crops, harvests, scans, task completion,
  marketplace, seasons — all existing Prisma-backed data). `estimatedYield`/`estimatedRevenue` are
  **null + `no_live_feed`** (never fabricated); no numeric risk/credit score — `activityRecord` is a
  label (none/limited/growing/strong) from real counts.
- **`estimateEligibility`** — a **label + reasons**, never an approval. Copy: *"Based on your farm
  record, you may qualify for support."* `BANNED_FINANCE_WORDING` (approved/pre-approved/guaranteed/
  credit score) exported + tested against every copy string.
- **Consent gates everything** — no consent → `not_shared`, zero offers matched, nothing sharable.
  Composes the EXISTING consent runtime (`requiresConsent`/`upsertConsent`/`revokeConsent`) — no
  duplicate consentManager built.
- **`matchPartnerOffers`** — filters only REAL offers (valid partnerId + type, unexpired). **No
  licensed partner exists today → honest empty state**; Farroway never acts as lender/insurer.
- **`financeAuditEvent`** — §7 shape (id/timestamp/actor/tenantId/correlationId) for every share,
  emitted through the existing event runtime by callers.

## Tests (19 assertions) + gate
`check:finance-honesty` (in build:safe): consent-required, no-approval-wording, no fabricated
numbers, no invented partners, audit shape, totality (null-safe).

## Deferred with reasons
- `finance_profiles`/`data_consents`/`partner_offers` tables + documentUpload + Finance UI card:
  land together with the first UI wiring (the engine is the contract they persist). No empty tables.
- applicationStatus: meaningful only when a real partner integration exists.
