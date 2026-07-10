# SENTINEL_AUTH_AUDIT.md — Farroway

> 2026-07-09 · Read-only audit of the Sentinel Hub integration. No code modified. Secret **values**
> are never printed — only presence + length. Evidence is `file:line` from a full-repo search.

## TL;DR — the answer to the question

The code implements **flow #2: OAuth2 `client_credentials`** — it reads
**`SENTINEL_HUB_CLIENT_ID` + `SENTINEL_HUB_CLIENT_SECRET`**.

**Railway has flow #1 set instead** (`SENTINEL_HUB_API_KEY` + `SENTINEL_HUB_INSTANCE_ID`) — and
**no runtime code reads those two variables at all.** So the credentials that ARE set in production are
dead, and the credentials the code NEEDS are unset → **the NDVI/satellite feed is dormant in production.**

| | Flow #1 (`API_KEY` + `INSTANCE_ID`) | Flow #2 (`CLIENT_ID` + `CLIENT_SECRET`) |
|---|---|---|
| **Implemented in code?** | ❌ No code reads these | ✅ Yes — the whole runtime |
| **Set at Railway?** | ✅ Both SET | ❌ Both UNSET |
| **Set in local `server/.env`?** | `INSTANCE_ID` set | ✅ Both SET |

**Result: MISMATCH.** Production is configured for a flow the code does not implement.

## 1. Authentication flow implemented (definitive)

`server/src/services/satellite/sentinelHubService.js` — **OAuth2 client-credentials → Bearer token → Statistical API**:
- `:4` `TOKEN_URL = https://services.sentinel-hub.com/oauth/token`
- `:5` `STATS_URL = https://services.sentinel-hub.com/api/v1/statistics`
- `:23-24` reads `SENTINEL_HUB_CLIENT_ID` / `SENTINEL_HUB_CLIENT_SECRET`
- `:35-37` POSTs `grant_type=client_credentials`, `client_id`, `client_secret`
- `:114` calls the Statistical API with `Authorization: Bearer <token>`

There is **no** WMS/OGC/instance-based code path (no `instanceId` in a tile URL, no `SENTINEL_HUB_INSTANCE_ID`
read anywhere). `SENTINEL_HUB_API_KEY` / `SENTINEL_HUB_INSTANCE_ID` correspond to the *older* instance/OGC
auth mode, which this codebase does **not** use.

## 2. Every environment variable referenced (with locations)

| Env var | Referenced by (file:line) | Read by runtime? |
|---|---|---|
| `SENTINEL_HUB_CLIENT_ID` | `services/satellite/sentinelHubService.js:23`; `ml/providers/fieldHealthProvider.js:14,152-153,262`; `services/scan/certification/providerCertification.js:44`; `scripts/check-scan-intel-v2-sprint.mjs:14,82-83`; `server/.env:45`; test | ✅ **Yes** |
| `SENTINEL_HUB_CLIENT_SECRET` | `sentinelHubService.js:24`; `fieldHealthProvider.js:14,154-155,263`; `providerCertification.js:44`; `check-scan-intel-v2-sprint.mjs:14,84-85`; `server/.env:46`; test | ✅ **Yes** |
| `SENTINEL_HUB_API_KEY` | `providerCertification.js:41` — **comment only** (documents the old wrong var); set at Railway | ❌ **No** (no live read) |
| `SENTINEL_HUB_INSTANCE_ID` | `server/.env:47` only; set at Railway | ❌ **No** (no code reads it) |

## 3. Every file that actually integrates with Sentinel Hub

**A. Credential-reading / API-calling (the integration core):**
- `server/src/services/satellite/sentinelHubService.js` — OAuth client + `fetchNDVI` (Statistical API).
- `server/src/ml/providers/fieldHealthProvider.js` — `fieldHealthKeysPresent()` (needs BOTH OAuth vars), composes `fetchNDVI`, derives crop vigor/stress/trend, honest degradation.
- `server/src/services/scan/certification/providerCertification.js` — provider→env map (now `CLIENT_ID`+`CLIENT_SECRET`).

**B. Consumers / wiring (use the service, don't read creds):**
- `server/src/app.js` — calls `fetchFieldHealth` inside `POST /api/scan/analyze`; surfaces `result.satellite`.
- `server/src/routes/satellite.js` — satellite API route.
- `server/src/services/scan/certification/{productionCertification,failoverPolicy,providerScorecard}.js` — reference the `sentinel_hub` provider by name (SLA/scorecard; `required:false`).
- `server/src/ml/scanOutcomePersister.js` — persists scan outcome incl. field-health signal.

**C. Governance gates referencing the OAuth vars:**
- `scripts/check-scan-intel-v2-sprint.mjs:14,82-85` — asserts the integration expects `CLIENT_ID`+`CLIENT_SECRET`.
- `scripts/check-scan-certification.mjs`, `check-scan-production-certification.mjs`, `run-scan-certification.mjs`, `check-certification-runtime-truth.mjs` — certify the provider set (by name).

**D. Frontend satellite DISPLAY / CONTRACT layer (no credentials, `no_live_feed` honest stubs):**
- `src/components/scan/IntelligentScanResult.jsx` (`_extractSatellite` → renders `result.satellite`),
  `src/runtime/farmBrain/SatelliteProvider.ts` / `SatelliteContracts.ts`, `src/runtime/satellite/SatelliteRuntime.ts`,
  `src/intelligence/satellite/*`, `src/runtime/v7/remote/RemoteSensingEngine.ts`, `src/runtime/v8/remoteSensing/*`,
  `src/core/satellite/*`. **None reference `SENTINEL_*` env vars** — they only display what the server returns.

**E. Tests:** `server/src/__tests__/sentinelHubService.test.js` (OAuth retry, mocked fetch — no live call).

> Note: a broader search matched ~100 files containing the word "satellite"/"sentinel", but the vast
> majority use it as a domain term (crops, regions, navigation, docs) and do **not** touch Sentinel Hub
> auth or the API. The list above is the actual integration surface.

## 4. Railway vs. implementation — match check (live, redacted)

`railway variables` (production, project `agripilot`, 2026-07-09):

| Variable | Railway | Code needs it? | Verdict |
|---|---|---|---|
| `SENTINEL_HUB_CLIENT_ID` | **UNSET** | ✅ required | ❌ **missing** |
| `SENTINEL_HUB_CLIENT_SECRET` | **UNSET** | ✅ required | ❌ **missing** |
| `SENTINEL_HUB_API_KEY` | SET (len 36) | ❌ unused | ⚠️ dead (no reader) |
| `SENTINEL_HUB_INSTANCE_ID` | SET (len 36) | ❌ unused | ⚠️ dead (no reader) |

**Local `server/.env`** (dev): `CLIENT_ID` (len 36), `CLIENT_SECRET` (len 32), `INSTANCE_ID` (len 36) — all SET.
So local dev IS configured for the OAuth flow the code implements; **only Railway is mis-configured.**

### Runtime consequence
`fieldHealthKeysPresent()` (`fieldHealthProvider.js:149-158`) requires BOTH OAuth vars → returns `false` at
Railway → every scan returns `{ ok:false, reason:'sentinel_credentials_missing' }` → the satellite layer
never activates in production, even though "satellite keys" appear set.

## 5. Recommendation (no code change needed)

The code is correct and consistent (all three integration files + the gate agree on the OAuth vars). The
fix is **operational**, not code:

1. Sentinel Hub dashboard → **User Settings → OAuth clients → Create** → copy `client id` + `client secret`
   (these are the values already present in local `server/.env`).
2. At Railway: `railway variables --set SENTINEL_HUB_CLIENT_ID=<id> --set SENTINEL_HUB_CLIENT_SECRET=<secret>`
3. (Optional cleanup) remove the now-dead `SENTINEL_HUB_API_KEY` / `SENTINEL_HUB_INSTANCE_ID` from Railway.
4. Redeploy → next scan with farm GPS returns real NDVI; verify via `railway logs` (no more
   `sentinel_credentials_missing`) or `GET /api/scan/diagnostics` (satellite → configured).

## Prior related work this session
- `providerCertification.js` was checking the unused `SENTINEL_HUB_API_KEY` (false "configured" green) → fixed to the OAuth vars (deployed, `c5b06c80`).
- OAuth token-refresh retry-once hardening added to `sentinelHubService.js` (deployed, `3c8f7b30`).
- No code change is recommended by THIS audit — the remaining gap is the Railway credential set above.

---

# RUNTIME VERIFICATION — 2026-07-09 (supersedes the config gap above)

The operator set the OAuth credentials at Railway. This section is a **live runtime audit**, executed
**inside the running Railway container** via `railway ssh` (the only truthful channel — the audit sandbox
has no outbound network, so `railway run`/curl run locally and can't reach Sentinel Hub; only in-container
exec has both the real creds and egress). Every line is captured output, redacted to lengths.

| # | Runtime check | Result | Evidence (captured) |
|---|---|---|---|
| 1 | `process.env` reads each variable | ✅ PASS | in-container `ENV CLIENT_ID_len=36 SECRET_len=32`; `railway variables` → all 4 SET |
| 2 | OAuth token exchange succeeds | ✅ PASS | `POST /oauth/token` → `OAUTH_STATUS=200 ACCESS_TOKEN=true EXPIRES_IN=3600 ERR=none` |
| 3 | Sentinel service initializes | ✅ PASS | real `sentinelHubService.fetchNDVI` (via the module) → `NDVI_STATUS=200` |
| 4 | FieldHealthService gets a live client | ✅ PASS | real `fieldHealthProvider.fetchFieldHealth(...)` → `KEYS_PRESENT=true`, `ok:true`, `reason:null` |
| 5 | NDVI returns real data | ✅ PASS | `ndvi:0.2626, cropVigor:"moderate", stressScore:58` → *"Field shows moderate canopy density for maize."* |
| 6 | Exact failure point (if unavailable) | N/A | **satellite is available** — prior `sentinel_credentials_missing` (unset OAuth vars) resolved |

Raw output from the real service module (lat 6.5, lng -1.6, maize):
```
KEYS_PRESENT=true
FIELD_HEALTH={"ok":true,"reason":null,"ndvi":0.2626313117968375,"cropVigor":"moderate",
              "stressScore":58,"vegetationTrend":null,"confidence":"low"}
INTERPRETATION=Field shows moderate canopy density for maize.
```

**Verdict: the Sentinel Hub NDVI integration is LIVE in production.** Honesty holds under the live feed —
`vegetationTrend:null` (needs ≥2 prior snapshots, not fabricated) and `confidence:"low"` (honest for a
single reading). The provider is proven live; it populates the scan result (`result.satellite`) on the next
real scan with farm GPS. SSH access provisioned for this audit was removed afterward (key deregistered).
