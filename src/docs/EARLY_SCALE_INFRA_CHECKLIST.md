# Farroway — Early-Scale Infrastructure Checklist

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY FOR EARLY SCALE (10k–50k users)**

Practical infrastructure upgrade tier above the 1k–10k baseline.
Adds Redis-backed shared state, queue-ready job paths, and
analytics-light service. Does NOT add Kubernetes, multi-region
hosting, or read replicas — those land at the next tier.

---

## 1. Files added / modified

```
server/src/queue/queueClient.js                          (+ SCAN_JOBS + SYNC_JOBS queue names)
server/src/app.js                                        (rate-limit-redis store wired into all 5 limiters)
server/src/services/analytics/earlyScaleAnalytics.js     (new — 8-event service layer)
scripts/ci/check-env-assertions.mjs                      (REDIS_URL + AUTH_SECRET required; SCAN_API_KEY + ANALYTICS_KEY optional)
src/docs/EARLY_SCALE_INFRA_CHECKLIST.md                  (this file)
scripts/ci/check-mobile-readiness.mjs                    (+4 → 66 total)
```

Already-shipped pieces (from prior commits) that are now part
of the early-scale tier:
- `server/src/cache/cacheClient.js` — Redis-backed K/V cache with
  in-memory fallback (already lazy-loads `ioredis`)
- `server/src/queue/queueClient.js` — BullMQ producer/consumer
  with in-process fallback runner
- Graceful shutdown — `server/src/server.js:128-144`
  (SIGTERM/SIGINT → `server.close()` → drain in-flight requests)
- `server/src/lib/logger.js` — structured JSON logger
- Backup script — `scripts/ops/export-data.mjs`
- Health check — `/health` + `/api/health` returning
  `{ status, db, uptime, timestamp }`
- Database indexes for marketplace tables

---

## 2. Redis integration

| Use | Module | Storage key prefix | Falls back to |
|---|---|---|---|
| Session cache | `cacheClient.js` | `farroway:cache:` | In-memory LRU (1000 keys) |
| Rate-limit store | `app.js` (rate-limit-redis) | `farroway:rl:auth:` / `:api:` / `:scan:` / `:funding:` / `:sell:` | `express-rate-limit` per-process memory |
| Job queue | `queueClient.js` | `bull:risk_scoring:` etc. | In-process processor execution |
| Short-term app cache | `cacheClient.js` | `farroway:cache:` | In-memory LRU |

**Activation:** set `REDIS_URL` (e.g. Upstash, Redis Cloud, or
Redis on Railway) and ensure the npm package is installed:

```
cd server && npm install ioredis bullmq rate-limit-redis
```

The lazy loaders detect the modules at runtime — no rebuild
required to swap memory → Redis.

---

## 3. Background queue summary

```js
import { enqueue, registerProcessor, QUEUES }
  from '../queue/queueClient.js';

QUEUES.RISK_SCORING        — per-farm risk model fan-out
QUEUES.AUTONOMOUS_ACTIONS  — decision dispatch loop
QUEUES.NOTIFICATIONS       — batched SMS/email fanout
QUEUES.SCAN_JOBS           — image scan → AI inference → result
                             persistence (NEW)
QUEUES.SYNC_JOBS           — offline localStorage queue → server
                             reconciliation (NEW)
```

**Fallback contract:** without `bullmq` + `REDIS_URL`, jobs run
inline via the registered processor (awaited). API callers
still see `{ queued: true }` so call-sites don't branch on
infrastructure state.

**Scan queue worker (target):** dequeue → call external scan
API (`SCAN_API_KEY`) → on success persist `V2PestImage` +
`V2ImageDetection` rows → on failure return the existing
on-device fallback. Worker code lands when the actual external
scan provider is wired.

**Sync queue worker (target):** dequeue → idempotent upsert by
client-minted UUID → ack → mark localStorage queue cursor.
Worker shape mirrors `ClientEvent` ingest already in place at
`/api/ingest`.

---

## 4. Database index summary

Indexes shipped (combined with the previous 1k–10k tier):

| Table | Indexed columns |
|---|---|
| User | id (PK), `(orgId, role)`, `active`, `onboardingStatus` |
| Farmer | `orgId`, `countryCode`, `region`, `currentStage`, `programId`, `cohortId`, `phone`, 8 more |
| FarmActivity | `farmerId`, `type`, `createdAt` |
| ProduceListing | `status`, `crop`, `farmId`, `createdAt`, `region` |
| BuyerRequest | `status`, `crop`, `buyerId`, `region`, `createdAt` |
| MarketplacePayment | `buyerId`, `listingId`, `status`, `createdAt` |
| ClientEvent | `farmerId`, `farmId`, `type`, `createdAt` |
| Application | `farmerId`, `programId`, `status`, `createdAt` |

Spec coverage:
- ✓ userId — User PK + Farmer.orgId
- ✓ farmId — ProduceListing + ClientEvent
- ✓ listingId — MarketplacePayment
- ✓ buyerId — BuyerRequest + MarketplacePayment
- ✓ role — `(orgId, role)` composite
- ✓ country — Farmer.countryCode
- ✓ region — Farmer + ProduceListing + BuyerRequest
- ✓ createdAt — every marketplace + ledger + event table
- gardenId — virtual partition over Farmer.farmType=backyard;
  no separate Garden table at this tier

**Apply migrations before deploy:**
```
cd server && npx prisma migrate deploy
```

---

## 5. Monitoring summary

| Layer | Mechanism | Output |
|---|---|---|
| Backend logs | `server/src/lib/logger.js` (JSON) | stdout → log ingest (Datadog/Loki) |
| Backend errors | global Express error handler + helmet + CORS allowlist | `{ error: 'Something went wrong' }` in prod (no stack traces) |
| Frontend errors | `RecoveryErrorBoundary` (4 buttons: Reload / Repair / Restart / Clear) | inline recovery card |
| Health probes | `/health` + `/api/health` | 200 / 503 + JSON body |
| Analytics events | `earlyScaleAnalytics.js` | `ClientEvent` table + optional PostHog/Mixpanel POST |

---

## 6. Analytics-light service

```js
import { trackLaunchEvent, EVENTS }
  from '../services/analytics/earlyScaleAnalytics.js';

EVENTS.INSTALL          — first ever app open
EVENTS.FIRST_ACTION     — onboarding entry tap, scan, or task
EVENTS.HOME_VIEW        — every landing on /home
EVENTS.TASK_COMPLETED   — Mark as done
EVENTS.SCAN_USED        — scan result rendered
EVENTS.LISTING_CREATED  — Sell save success
EVENTS.BUYER_INTEREST   — buyer interest form submit
EVENTS.DAY2_RETURN      — second-day session restore
```

Two destinations:
1. **Database (always-on):** writes a `ClientEvent` row with
   `type`, `payload`, `farmerId`, `farmId`, `createdAt`. No
   migration required — uses the existing model.
2. **PostHog/Mixpanel (optional):** when `ANALYTICS_KEY` is set,
   POSTs the event with a 1500 ms abort timeout. Missing key →
   warn-only; database writes keep flowing.

In-memory ring buffer of the last 200 events available via
`getRecentEvents()` for diagnostic dumps.

---

## 7. Rate limit summary (Redis-backed)

| Surface | Window | Max | Store |
|---|---|---|---|
| `/api/v2/auth/*` | 5 min | 30 / IP | Redis (`farroway:rl:auth:`) when `REDIS_URL` set |
| `/api/scan*` | 1 min | 30 / IP | Redis (`:rl:scan:`) |
| `/api/funding*` | 1 min | 60 / IP | Redis (`:rl:funding:`) |
| `/api/(market|listing|sell|buyer-interest)*` | 1 min | 60 / IP | Redis (`:rl:sell:`) |
| `/api/*` (default) | 1 min | 200 / IP | Redis (`:rl:api:`) |

When Redis is unavailable, all five limiters degrade to the
in-process memory store automatically — caps stay enforced
per-replica, just not coordinated across replicas. No
hard-fail. The cap factor when running 5 replicas without
Redis is 5× (each replica holds its own counter).

---

## 8. Environment validation

**Required (build / deploy fails when missing):**
- `DATABASE_URL` — Postgres connection string with
  `?connection_limit=10&pool_timeout=10&connect_timeout=15`
- `AUTH_SECRET` (or legacy `JWT_SECRET` alias) — JWT signing key
- `REDIS_URL` — Redis connection string (Upstash / Redis Cloud / Railway)
- `VITE_API_BASE_URL` — frontend API origin

**Optional (warn-only when missing):**
- `SCAN_API_KEY` — external scan provider; fallback guidance shown when missing
- `ANALYTICS_KEY` (or `POSTHOG_KEY` / `MIXPANEL_TOKEN`) — DB-only when missing
- `TWILIO_*` — SMS / WhatsApp / Voice degrade gracefully
- `SENDGRID_API_KEY` — email + password resets degrade gracefully
- `MFA_SECRET_KEY` — MFA encryption-at-rest disabled when missing

Validated by `npm run launch-gate:final` (which calls
`scripts/ci/check-env-assertions.mjs --mode=prod`).

---

## 9. Pre-launch checklist

- [ ] Redis provisioned + `REDIS_URL` set
- [ ] `npm install ioredis bullmq rate-limit-redis` in `server/`
- [ ] `DATABASE_URL` set with `connection_limit` query param
- [ ] `AUTH_SECRET` rotated from staging
- [ ] `prisma migrate deploy` against prod DB
- [ ] First `node scripts/ops/export-data.mjs` snapshot taken
- [ ] Daily backup cron / GH Action scheduled
- [ ] Health check probed: `curl https://api.farroway.app/health`
- [ ] Rate-limit headers visible on a sample API call
  (`X-RateLimit-Remaining`)
- [ ] `/help`, `/contact`, `/privacy`, `/terms` reachable without auth
- [ ] Mobile smoke test (`GO_LIVE_TEST_CHECKLIST.md`) signed off
- [ ] `launch-gate:final` green on the deploy commit
- [ ] Sentry / log ingest configured + alerting routed

---

## 10. Remaining scaling risks

**Acceptable (10k–50k tier):**
- Single Postgres instance — connection cap mitigated by
  `connection_limit` + Prisma pool. At sustained > 50k DAU,
  add a read replica.
- Single Redis instance — cap mitigated by Upstash auto-scale
  / Redis Cloud HA. At > 50k DAU, add a read replica or
  Redis Cluster.
- Single API region — fine for the launch-region farmer base.
  Multi-region when farmer geography spreads beyond one TLD.

**Blocking (revisit at > 50k):**
- No multi-region failover
- No read replicas
- No Kubernetes — current deploy is platform-managed (Vercel
  / Railway / Fly). Kubernetes adds operational cost; revisit
  when more than 3 services need to coordinate.

**None blocking 10k–50k.**

---

## 11. Verdict

**READY FOR EARLY SCALE (10k–50k users).**

Redis ✓ · queue placeholders ✓ · graceful shutdown ✓ ·
indexes ✓ · backup script ✓ · health check ✓ · structured
logs ✓ · frontend error boundary ✓ · scan resilience ✓ ·
analytics-light ✓ · Redis-backed rate limits ✓ · env
validation ✓ · checklist doc ✓.

Move to multi-region + read replicas + Redis Cluster when
sustained DAU crosses 50k or when farmer geography spreads
across continents.
