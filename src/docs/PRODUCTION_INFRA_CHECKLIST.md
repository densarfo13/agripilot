# Farroway — Production Infra Checklist

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY FOR EARLY PRODUCTION (1k–10k users)**

Lightweight upgrades that prepare the existing stack for early
production scale without a full rebuild. Maps 1:1 to the spec.

---

## 1. Files added / modified

```
server/src/app.js                                        (health response + scan/funding/sell limiters)
server/prisma/schema.prisma                              (region + createdAt indexes on marketplace tables)
server/prisma/migrations/20260501_production_infra_indexes/migration.sql  (new)
scripts/ops/export-data.mjs                              (new — backup helper)
src/docs/PRODUCTION_INFRA_CHECKLIST.md                   (this file)
```

No frontend changes — frontend resilience already shipped:
RecoveryErrorBoundary (4 buttons), ScanRetryTips fallback,
ExperienceFallback safe guard, explicit-logout flag,
clearFarrowayCache.

---

## 2. Health check

```
GET /health
GET /api/health
```

Response:
```json
{
  "status":    "ok" | "degraded",
  "db":        "ok" | "down",
  "uptime":    seconds since process start (integer),
  "timestamp": ISO 8601 string,
  "version":   "1.0.0"
}
```

- `200` when `db === 'ok'`, `503` when down.
- Probes `SELECT 1` via Prisma — fast (<5 ms typical).
- `/health` is exposed alongside `/api/health` so a load
  balancer can target either path.
- Admin extended health at `/api/ops/health` (super_admin
  only) returns DB latency, upload-dir health, evidence
  count, active-season count.

**Probe config (Vercel / load balancer / k8s):**
```
liveness:  GET /health   every 30s, fail after 3 misses
readiness: GET /health   every 10s, drop on first 503
```

---

## 3. API rate limits

| Surface | Window | Max | Why |
|---|---|---|---|
| Auth (`/api/v2/auth/*`) | 5 min | 30 / IP | Strict — covers brute-force on login + refresh |
| Scan (`scan`, `pest-scan`, `crop-scan`, `image-scan`) | 1 min | 30 / IP | Moderate — image upload + AI is cost-sensitive |
| Funding (`funding`, `opportunities`, `fund-application`) | 1 min | 60 / IP | Generous — forms + reads |
| Sell (`market`, `listing`, `sell`, `buyer-interest`) | 1 min | 60 / IP | Generous — same |
| General `/api/*` | 1 min | 200 / IP | Default — protects every other endpoint |

All limiters use `express-rate-limit` with `standardHeaders: true`
so clients see `X-RateLimit-*` response headers and can back off
gracefully.

---

## 4. Database indexes

**New** (this commit, applied via
`server/prisma/migrations/20260501_production_infra_indexes`):

- `produce_listings.region`
- `buyer_requests.region`
- `buyer_requests.created_at`
- `marketplace_payments.created_at`

**Already present:**
- User: `(orgId, role)`, `(active)`, `(onboardingStatus)`
- Farmer: `(orgId)`, `(countryCode)`, `(region)`, 12 more
- ProduceListing: `(status)`, `(crop)`, `(farmId)`, `(createdAt)`
- BuyerRequest: `(status)`, `(crop)`, `(buyerId)`
- MarketplacePayment: `(buyerId)`, `(listingId)`, `(status)`

Spec coverage:
- ✓ userId — User has @id (clustered primary key)
- ✓ farmId — ProduceListing + ClientEvent
- ✓ listingId — MarketplacePayment
- ✓ buyerId — BuyerRequest + MarketplacePayment
- ✓ createdAt — all marketplace tables (now)
- ✓ role — User (orgId, role) composite
- ✓ country — Farmer.countryCode
- ✓ region — Farmer.region + ProduceListing.region + BuyerRequest.region (now)
- gardenId — deferred (no separate Garden table; gardens are
  Farmer rows with `farmType=backyard` per the safe-launch
  multi-experience model)

**Apply the migration before deploy:**
```
cd server && npx prisma migrate deploy
```

---

## 5. Prisma connection pooling

Default Prisma client opens **one** connection per process. For
1k–10k users on Vercel/Railway/Fly with auto-scaling, we need:

### Recommended `DATABASE_URL` query params

```
postgresql://USER:PASS@HOST:PORT/DB
  ?connection_limit=10
  &pool_timeout=10
  &connect_timeout=15
```

- `connection_limit=10` per process — multiplied by replica
  count. 5 replicas × 10 = 50 concurrent connections at peak.
- `pool_timeout=10` — fail fast (10s) if the pool is exhausted
  rather than queueing forever.
- `connect_timeout=15` — initial DB connection timeout.

For Postgres-hosted deploys (Supabase, Neon, RDS), keep the DB
side at **2–3× the per-process limit**: e.g. for 5 replicas at
`connection_limit=10`, the DB should accept 60+ connections.

### Connection lifetime

Each Prisma client instance is long-lived (created once at
startup, disconnected on `SIGTERM`). The existing
`server/src/app.js` already follows this pattern:

```js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
process.on('SIGTERM', () => prisma.$disconnect());
```

### Prisma Accelerate (optional, > 10k users)

When the user count crosses ~10k or you observe spikes in
`pool_timeout` errors, swap to Prisma Accelerate (managed
connection pooler + cache). One-line change:

```
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
```

No application code changes required. Accelerate handles
pooling + read replication + edge caching transparently.

---

## 6. Safe error handling

Backend (`server/src/app.js`):
- Helmet middleware for HTTP security headers
- CORS allowlist (no `*` in production)
- Global error handler (Express last-resort) returns
  `{ error: 'Something went wrong' }` in production —
  no raw stack traces leak.
- Structured logs via the existing logger (lives at
  `server/src/lib/logger.js`); JSON-formatted for log
  ingestion (Datadog / Loki).

Frontend (already shipped):
- `RecoveryErrorBoundary` — 4-button card (Reload / Repair /
  Restart / Clear) on any render-time exception.
- `ExperienceFallback` — safe guard wraps `/dashboard` +
  `/my-farm` so null-data renders never paint.
- `clearFarrowayCache()` — aggressive `farroway_*` sweep + redirect.

---

## 7. Scan resilience

Already shipped:
- Camera permission denied → "Upload from gallery" promotes to primary
- API failure → `ScanRetryTips` surfaces with no-network fallback guidance
- Result wording: "Possible issue" / "Needs closer inspection" — never says "confirmed disease"
- Pending scan persists in scan history under the active gardenId / farmId
- `scanToTask` caps tasks at 2 per scan — no spam

---

## 8. Backup script

```
node scripts/ops/export-data.mjs [--out ./backups]
```

Writes timestamped JSON snapshots of the launch-critical
tables (users, farms, gardens, listings, buyer-requests,
applications, marketplace-payments). User passwords are
never exported.

**Recommended cadence (early production):**
- Daily at 03:00 UTC via cron
- Pre-deploy snapshot before any `prisma migrate deploy` on
  prod
- 30-day retention; archive monthly to S3/GCS cold storage

---

## 9. Environment validation

`scripts/ci/check-env-assertions.mjs --mode=prod` enforces:

**Critical (build fails):**
- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_API_BASE_URL`

**Optional (build warns, runtime degrades gracefully):**
- `TWILIO_ACCOUNT_SID` / `_AUTH_TOKEN` / `_PHONE_NUMBER` / `_WHATSAPP_FROM` / `_VOICE_FROM`
- `SENDGRID_API_KEY`
- `MFA_SECRET_KEY`

Wired into `npm run launch-gate:final`.

---

## 10. Pre-launch checklist

- [ ] `DATABASE_URL` set with `connection_limit` query param
- [ ] `JWT_SECRET` set + rotated from staging
- [ ] `VITE_API_BASE_URL` set to production API origin
- [ ] `prisma migrate deploy` run against production DB
- [ ] First `node scripts/ops/export-data.mjs` snapshot taken
- [ ] Cron / GitHub Action scheduled for daily backup
- [ ] Health check probed: `curl https://api.farroway.app/health` returns 200
- [ ] Rate-limit headers visible on a sample API call
- [ ] `/help`, `/contact`, `/privacy`, `/terms` reachable without auth
- [ ] Mobile smoke test (`GO_LIVE_TEST_CHECKLIST.md`) signed off
- [ ] `launch-gate:final` green on the deploy commit
- [ ] Sentry / log ingest configured

---

## 11. Remaining scaling risks

**Low (acceptable for 1k–10k users):**
- Single Prisma instance per process — connection pool is
  finite. Mitigated by `connection_limit` + auto-scale to
  5+ replicas.
- localStorage-first frontend cap at 5 MB per device. Each
  store (farms, listings, scan history) is bounded by the
  existing 200-row caps so a single user never blows quota.

**Medium (revisit at > 10k users):**
- No Redis / queue — task fan-out (notifications, sync) runs
  synchronously. At higher scale, move to a job queue
  (Bull / BullMQ + Redis).
- No CDN in front of the API — static assets ship from Vercel
  edge but API responses don't cache. Add Cloudflare /
  Fastly when read traffic dominates.

**None blocking 1k–10k.**

---

## 12. Verdict

**READY FOR EARLY PRODUCTION (1k–10k users).**

Health check ✓ · rate limits ✓ · indexes ✓ · pooling docs ✓ ·
backup script ✓ · env validation ✓ · error boundaries ✓ ·
scan resilience ✓ · privacy + legal pages ✓.

Move to Prisma Accelerate + Redis-backed queues when the user
count or read traffic crosses the 10k threshold.
