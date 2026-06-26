# OPERATIONS_RUNBOOK — Farroway (Workstream C)

Run Farroway like production. Most observability already exists; this runbook says
what to watch, the thresholds, and what to do when it breaks.

## Dashboards (what exists + what to add)
| Surface | Source (exists) | Status |
|---|---|---|
| Provider health (24h latency/success/error/uptime/confidence) | `/admin/scan-health` → Provider reliability card · `GET /api/admin/scan/reliability` | ✅ live |
| Credit consumption | `/admin/scan-health` → credit card · `GET /api/admin/scan-credits` | ✅ live |
| Scan observability (totals, top crops/diseases) | `/admin/scan-health` · `GET /api/admin/scan-observability` | ✅ live |
| Railway / DB / uptime | `GET /api/health` ({status, db, uptime}) | ✅ endpoint; add a tile |
| Redis / Queue / Storage | graceful-degrade (Redis optional) | ◷ add tiles from /api/health |
| Client error rate | `window.__swallowedErrors()` (INFO/WARNING/ERROR/CRITICAL) | ✅ live |

**NOW:** bookmark `/admin/scan-health`; check daily. **NEXT:** add DB/Redis/storage
tiles to the page from `/api/health`. **LATER:** export to a hosted metrics stack
(OTel/Prometheus) when farm count justifies the infra.

## Alerting thresholds (set these)
- Provider success rate < 90% (15-min window) → page on-call.
- Any provider `AUTH_FAILED` / `CREDITS_EXHAUSTED` → page (a farmer-facing outage).
- Credit balance < 50 on any provider → warn; < 20 → page.
- `__swallowedErrors().counts.CRITICAL` > 0 → investigate.
- `/api/health` non-200 or db != ok → page (platform down).

## Incident response
1. **Detect** (alert or dashboard). 2. **Classify** (P0 farmer-down / P1 degraded /
P2 minor). 3. **Mitigate** (rollback the last deploy if correlated; revert is one
commit). 4. **Root-cause** (reliability dashboard + swallow telemetry + provider
status). 5. **Fix + regression gate.** 6. **Post-incident note** (what/why/fix/
prevent). Keep a running incident log.

## Deployment
- Push to `master` → GitHub auto-deploy (reliable). Or `railway up --detach` (the
  sandbox TLS sometimes needs a retry; GitHub is the fallback).
- **Every change passes `build:safe` (360+ gates) BEFORE commit.** Verify the PASS
  line — a piped `&&` does not gate on it.
- Rollback = revert the commit + redeploy. No migration is destructive (all additive
  `CREATE ... IF NOT EXISTS`).

## Provider certification (the recurring op)
`railway run npm run scan:certify` after any key change or provider incident.
`DEGRADED` = keyed but unproven (run a real scan); `READY` = proven live;
`AUTH_FAILED`/`CREDITS_EXHAUSTED` = real, actionable.

**NOW:** set the 5 alert thresholds + name an on-call. **NEXT:** the DB/Redis/storage
tiles + a weekly synthetic scan to keep providers `READY`. **LATER:** the metrics-stack
export + automated rollback.
