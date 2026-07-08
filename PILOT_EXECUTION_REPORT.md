# PILOT_EXECUTION_REPORT.md — Farroway

> 2026-07-08 · Pilot Execution Mode. Every line below is backed by a **real** command against the live
> Railway deployment (CLI authenticated as densarfo@gmail.com) or the production logs — no estimates,
> no fabrication. Where a step could not be executed from this environment, it is marked **NOT
> EXECUTED** with the reason, never a fake PASS. Secret **values** are redacted (presence only).

## Environment under test (real)
- **Project:** agripilot · **Env:** production · **Service:** agripilot **● Online** · US East ·
  https://www.farroway.app (`railway status`, 2026-07-08).
- **This sandbox has no outbound HTTPS** (DNS fails for `api.farroway.app`; `farroway.app` fails TLS
  revocation `CRYPT_E_NO_REVOCATION_CHECK`). Evidence was gathered via the **Railway CLI** (which uses
  its own transport) — `railway variables`, `railway status`, `railway logs`.

## Step-by-step verification

| # | Step | Result | Evidence | Timestamp (UTC) |
|---|------|--------|----------|-----------------|
| 1 | Verify every Railway env var | ✅ **PASS** | `railway variables`: **48 vars set**. All critical keys present: `DATABASE_URL`, `PLANT_ID_API_KEY`, `PLANT_API_KEY`, `PLANTNET_API_KEY`, `CROP_HEALTH_API_KEY`, `CROP_ID_API_KEY`, `INSECT_ID_API_KEY`, `MUSHROOM_ID_API_KEY` (Kindwise family), `WEATHER_API_KEY`, `AMBEE_API_KEY`, `SENTINEL_HUB_*`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID`, `SENDGRID_API_KEY`, `CLOUDINARY_URL`, `REDIS_URL`, `SENTRY_DSN`, `JWT_SECRET`, `MFA_SECRET_KEY`, `OPENAI_API_KEY`. Values redacted. | 2026-07-08 |
| 2 | Verify every external provider responds | 🟡 **PARTIAL PASS** | Keys present (step 1) **and** `GET /api/scan/diagnostics` returned **200** (2068-byte body) for an authenticated user in production; unauthenticated calls correctly returned 401. **Not captured:** a live provider *inference* round-trip (Plant.id/Kindwise) — that only fires during a real scan (step 3), which did not occur in the observed window. | 2026-07-08T02:46:39Z (200); 01:54:19Z (401) |
| 3 | Execute one complete real farmer scan | ⛔ **NOT EXECUTED** | No `POST /api/scan/analyze` appears in the production logs during the observed window, and this environment has **no device/camera** to originate a real farmer scan. Executing a synthetic scan would fabricate pilot data — declined. | — |
| 4 | Record every event | ⛔ **NOT EXECUTED** | Depends on step 3. No new scan → no new events to record. | — |
| 5 | Verify Timeline updated | ⛔ **NOT EXECUTED** | Depends on step 3. | — |
| 6 | Verify Task created | ⛔ **NOT EXECUTED** | Depends on step 3 (`followUpEngine` fires on a scan). | — |
| 7 | Verify NGO metrics updated | ⛔ **NOT EXECUTED** | Depends on step 3 (`buildPilotMetrics.scan` — now wired — needs a real scan to increment). | — |
| 8 | Verify Marketplace data updated | ⛔ **NOT EXECUTED** | Depends on a full farmer journey (harvest→list), not just a scan. | — |
| 9 | Verify Notification sent | ⛔ **NOT EXECUTED** | Depends on step 3 / a triggering event. | — |
| 10 | Verify Scan History persisted | ⛔ **NOT EXECUTED** | Depends on step 3 (`ScanTrainingEvent` write + `GET /api/scan/history`). | — |

## Additional real findings (from production logs)
| Finding | Result | Evidence |
|---|---|---|
| Deployment health | ✅ PASS | Serving real traffic, `status=200` in 1–3 ms across many assets + API; multiple real client IPs. |
| A real user session is active | ✅ observed | Authenticated `userId=34643547-…` making live requests — the app is in real use. |
| RBAC enforcement | ✅ PASS | `/api/admin/scan-credits` → **403** for the non-admin user; **401** for unauthenticated. Correct. |
| ML retention sweep | 🔧 **BUG FOUND → FIXED** | Cron logged `mlRetentionSweep prune_complete error="no_prisma"` at 02:00/02:30/03:00Z (`deleted=0`). Root cause: `pruneScanTrainingEvents` imported prisma from `../core/prisma.js`, **which does not exist** → silent no-op every 30 min. Fixed to import the canonical `../config/database.js`; verified it resolves a real client with `scanTrainingEvent.count`. |
| PWA icons / favicon | ⚠️ minor | `/apple-touch-icon.png`, `/favicon.ico`, `/icons/logo-premium*.jpg` → 404. Cosmetic; flag for follow-up. |

## Remaining blockers
1. **One real farmer scan (steps 3–10).** Operator-only: a physical device + a real plant photo. Once
   it completes end-to-end, steps 4–10 become verifiable in one pass (the code path is staged + online).
2. **Live provider inference confirmation (step 2 tail).** Confirmed on the *next* real scan — watch
   `railway logs` for the Plant.id/Kindwise call + `/api/scan/analyze 200`.
3. **Telemetry (RELEASE_PLAN #12).** `POST /api/v2/analytics/track` returned 401 for the unauthenticated
   client; confirm rows land for the authenticated scanning user (separate from this run).

## Recommended release decision
**🟡 CONDITIONAL GO (closed pilot).**
The platform is **live, healthy, correctly configured, and RBAC-enforced**, with all provider keys set
and a real user already on it — verified with real evidence, not estimates. It is **one supervised
action away**: run a single real farmer scan on a device. If that scan completes end-to-end
(diagnosis → task → timeline → history) — watchable live via `railway logs` — promote to **GO**. Until
then it is not full GO (the core scan path is unproven in production) and not NO-GO (nothing is broken;
this session even fixed a live retention-sweep bug). The single highest-value next action is unchanged:
**one real device scan.**
