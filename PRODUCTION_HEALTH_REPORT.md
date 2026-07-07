# PRODUCTION_HEALTH_REPORT.md — Farroway

> 2026-07-06 · Integration + workflow health. **Honest boundary:** this validation runs in a build
> environment with **no live database, Redis, or provider keys** (those are Railway secrets). I can
> verify that integration *code + config* exist and are wired; I **cannot** verify live connectivity
> from here, and I will not fabricate "connected/green" statuses. Live status is read from the running
> deployment's `/api/ops/health` + `/api/scan/provider-health` endpoints by the operator.

## Integrations (requirement 4)
| Integration | Code wired? | Live status |
|---|---|---|
| PostgreSQL (Prisma) | ✅ singleton `config/database.js`; schema **valid** | ⛔ operator — check `/api/ops/health` (DB latency) |
| Prisma migrations | ✅ `scripts/prisma-deploy-with-baseline.mjs` on boot | ⛔ operator — `prisma migrate status` needs `DATABASE_URL` |
| Plant.id / Kindwise (scan) | ✅ server-side adapters; keys never client-exposed | ⛔ operator — `/api/scan/provider-health` (`apiKeySet` booleans) |
| Weather | ✅ provider adapter + SoilGrids nonblocking | ⛔ operator — set key at Railway; honest `no_live_feed` if unset |
| Maps / geocoding | ✅ reverse-geocode wired | ⛔ operator |
| Redis | ✅ rate-limit store with **in-memory fallback** (`app.js:417-443`) | ⛔ operator — optional; app degrades gracefully if absent |
| Sentry | ✅ `lib/sentry.js` | ⛔ operator — needs DSN env |
| Twilio (SMS) | ✅ `services/smsService.js` + honest `manual_share_ready` when unconfigured | ⛔ operator — set keys |
| SendGrid (email) | ✅ `services/emailService.js` (canonical) | ⛔ operator — set key |
| Railway (host) | ✅ deploy on push to master; start script runs migrate→init-admin→server | ⛔ operator — Railway dashboard |

**Design note:** every external provider is **fail-soft** — the app is built to run (degraded) when a
provider is unconfigured, never to crash. This is verified in code (try/catch + honest `ok:false`
envelopes), which is why "keys unset" is an operational state, not a defect.

## Major workflows (requirement 3)
Verified via the **test suite + build** (not live E2E, which needs a running app + seeded DB):
| Workflow | Coverage evidence |
|---|---|
| Authentication / RBAC | ✅ 14 auth tests + `check:role-route-guards` gate (Security scored 5 in RELEASE_READINESS) |
| Scan | ✅ **41 scan tests**, `/api/ops/health`, provider-health, safety-filter; "never block scan" contracts |
| Farmer / NGO / Buyer / Marketplace | ✅ module tests + org-scope isolation suite (`ngoDashboardOrgScope`) |
| Analytics / Reports | ⚠️ works; cross-org scoping fixed on `fix/analytics-org-scope` (not yet in RC) |
| Offline sync | ✅ offline-first tests + drain logic |
| Notifications | ✅ 12 tests + honest delivery contracts |
| Regional Risk / High-Risk Farms / Admin Dashboard | ✅ present; UI covered by frontend gates |
| Government portal | ⚠️ regional-intelligence surfaces exist; not a separately-gated E2E |

**E2E workflow runs (live app + DB) are operator activities** — this phase validates the build + unit/
integration suite, not a staged environment.

## Remaining operational risks
1. **One real device scan** ungated (the standing release blocker) — human action.
2. **Provider keys** verified only at Railway runtime — confirm via the health endpoints.
3. **DR restore never rehearsed** — run `docs/PRODUCTION_BACKUP_RESTORE.md` §2.
4. **Test-suite debt** (50 stale/over-strict tests) — cleanup, non-blocking.
5. **Analytics cross-org scoping** — fixed but unmerged (`fix/analytics-org-scope`).
