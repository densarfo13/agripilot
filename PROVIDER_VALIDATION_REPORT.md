# PROVIDER_VALIDATION_REPORT.md — Farroway

> 2026-07-07 · BLOCKER 2. **No success is fabricated.** Live reachability/auth for every provider
> requires (a) the provider secrets — which live at Railway, not in this environment — and (b)
> outbound network, which this environment does not have. So this report certifies what IS verifiable
> here (does the code read the key? is the key present in this environment?) and marks reachability as
> **NOT TESTABLE HERE** with the exact operator command to run it on the deployed instance.

## Method
- **Key referenced in code** — verified by grep of `server/src` (the integration exists).
- **Key present in THIS environment** — verified via `process.env` (all unset — secrets are at Railway).
- **Endpoint reachable / auth valid / response received** — **NOT TESTABLE from here** (no network, no
  secrets). Run against the deployed app; do not infer.

## Results

| Provider | Env var(s) in code | Key present here | Reachable / auth / response |
|---|---|---|---|
| Plant.id | `PLANT_ID_API_KEY`, `PLANT_API_KEY` | ❌ unset | **NOT TESTABLE HERE** — run `GET /api/scan/diagnostics` on Railway |
| Kindwise / crop.health | via scan provider adapter (`FARROWAY_SCAN_PROVIDER_*`) | ❌ unset | **NOT TESTABLE HERE** — same probe |
| PlantNet (aux) | `PLANTNET_API_KEY`, `PLANTNET_PROJECT` | ❌ unset | **NOT TESTABLE HERE** |
| Weather | `WEATHER_API_KEY` / keyless Open-Meteo (`OPEN_METEO_*`, `WEATHER_BASE_URL`) | ❌ unset | Open-Meteo is **keyless**; reachability still needs network — **NOT TESTABLE HERE** |
| SMS | `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`VERIFY_SERVICE_SID`, `SMS_VERIFY_PROVIDER` | ❌ unset | **NOT TESTABLE HERE** |
| Email | `SENDGRID_API_KEY` or `SMTP_HOST/USER/PASS`, `EMAIL_FROM_*` | ❌ unset | **NOT TESTABLE HERE** |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`/`API_KEY`/`API_SECRET` | ❌ unset | **NOT TESTABLE HERE** |
| Redis | `REDIS_URL` | ❌ unset | **NOT TESTABLE HERE** — `/api/ops/health` reports connectivity on Railway |
| Railway | `RAILWAY_DEPLOYMENT_ID`, `RAILWAY_GIT_COMMIT_SHA` | ❌ unset (injected at deploy) | present only in the Railway runtime |
| Sentry | `SENTRY_DSN`, `VITE_SENTRY_DSN` | ❌ unset | **NOT TESTABLE HERE** |

**Every integration exists in code; no provider key is present in this environment; no reachability was
tested (and none is claimed).** This is the honest state — not a failure of the code, but the boundary
of what a local, network-isolated environment can certify.

## Operator runbook (do this on the deployed instance)
1. `curl https://<railway-host>/api/ops/health` → confirm `database.connected`, Redis, uploads.
2. `curl https://<railway-host>/api/scan/diagnostics` → confirm scan provider `apiKeySet:true` +
   `available[]` non-empty (this is the real Plant.id/Kindwise readiness signal, measured server-side).
3. Trigger one real scan (BLOCKER 1) → confirm a provider `200` + candidates in the response.
4. Send one test SMS + one test email from an admin action → confirm delivery.
5. Confirm a Sentry event appears in the Sentry dashboard after a forced test error.

Until steps 1–5 pass on Railway, provider validation is **PENDING (operational)**, not PASS.
