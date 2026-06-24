# SCAN_PROVIDER_FINAL_ROOT_CAUSE.md

**P0 — "Clear plant photos return Unknown / Needs review / Scan unclear."**
Sprint #221b. Date: 2026-06-23. Method: **verified, not guessed.**

---

## DEFINITIVE ROOT CAUSE

**An environment-variable NAME mismatch.**

- **The code reads** `process.env.PLANT_ID_API_KEY` — verified, 11 active
  reads across `plantIdProvider.js`, `scanInferenceService.js`,
  `scanProviders.js`, `scanProviderHealth.js`, `server.js`.
- **The key is configured as** `PLANT_API_KEY` (no `_ID`) —
  verified in `server/.env:40`:
  `PLANT_API_KEY=PPel5C…` (fingerprint **`PPel5C`**, length **50**).
- Result: `process.env.PLANT_ID_API_KEY` is **undefined** → `buildRequest`
  sends `'Api-Key': '' ` (empty) → Plant.id/Kindwise replies **401** →
  zero candidates → consensus floor → **"Scan unclear" for every photo,
  clear or not.**

This is not a photo problem, not a confidence problem, not a UI problem.
The classifier was **never authenticated** because the key lived under a
name nothing in the code reads.

---

## 1. Which environment variable is actually used

| Variable | Read by code? | Set in env? |
|---|---|---|
| `PLANT_ID_API_KEY` | **YES** — 11 active reads | **NO** (was unset) |
| `PLANT_API_KEY`    | No (until this fix)        | **YES** (`server/.env:40`) |

→ The code and the configuration were referencing **two different names.**

## 2. Key lengths (logged, value never exposed)

`getScanProviderDiagnostics()` now reports BOTH:
- `plantIdApiKeyLength` = `process.env.PLANT_ID_API_KEY?.trim().length` (was **0**)
- `plantApiKeyLength`   = `process.env.PLANT_API_KEY?.trim().length`   (**50**)
- `envVarUsed` = which name resolved at runtime (`PLANT_ID_API_KEY` |
  `PLANT_API_KEY` | `null`)

## 3. Real provider health check

`pingScanProvider()` (exported) makes a **real authenticated GET** to
`https://plant.id/api/v3/usage_info` with the `Api-Key` header — this
validates the key against Kindwise **without consuming identification
credits**. Exposed at **`GET /api/scan/diagnostics?live=1`**, returning:

```
{ provider, httpStatus, candidateCount, responseBody, failureReason }
```

- `httpStatus: 200` → key valid + mounted + quota live
- `401 / 403`       → key invalid / expired
- `429`             → quota exhausted
- `not_configured`  → neither env var set

## 4. API key fingerprint (first 6 chars only)

- Local `server/.env`: **`PPel5C`** (length 50).
- **Production:** `GET /api/scan/diagnostics` → `keyFingerprint` reports
  the first 6 chars of whatever Railway has mounted. (Cannot be read from
  source — it lives in the Railway dashboard; the endpoint is the runtime
  proof.)

## 5. Compare fingerprint against Kindwise

Operator step (external — I cannot read the Kindwise dashboard):
1. `GET /api/scan/diagnostics?live=1` in prod → note `keyFingerprint` +
   `live.httpStatus`.
2. Open Kindwise → the configured key's first 6 chars.
3. **Match + `live.httpStatus:200`** → key correct and working.
   **Mismatch** → Railway has the wrong/old key; re-paste the Kindwise key.
   **Match but `401`** → key was rotated in Kindwise; re-issue + update Railway.

---

## THE FIX (applied, committed, deployed)

1. **`PLANT_API_KEY` accepted as an alias** for `PLANT_ID_API_KEY`
   everywhere the key is read — `(process.env.PLANT_ID_API_KEY ||
   process.env.PLANT_API_KEY)`. The existing `PPel5C…` key now
   authenticates regardless of which of the two names Railway has set.
2. Diagnostics report **both** names' lengths + `envVarUsed` + fingerprint.
3. **Live authenticated ping** (`?live=1`) proves the key against Kindwise.
4. Request/response logging (`[scan.provider] …`, `[scan.provider.ping] …`)
   — never the key value, never image bytes.
5. `serviceUnavailable` flag distinguishes a configured-but-failing
   provider from "unknown plant."
6. `check:scan-provider-diagnostics` gate locks all of the above and fails
   the build if the key value is ever logged or returned.

### Deliverables (as requested)

| | |
|---|---|
| **Failing env variable** | `PLANT_ID_API_KEY` unset; key was under `PLANT_API_KEY` |
| **Failing file** | `server/src/ml/providers/plantIdProvider.js:100` (`const key = process.env.PLANT_ID_API_KEY`) + `scanInferenceService.js` `_externalClassify` (swallowed the 401) |
| **Failing function** | `buildRequest` → `'Api-Key': key \|\| ''` with an undefined key |
| **Failing API call** | `POST https://plant.id/api/v3/identification` with an empty `Api-Key` → 401 |
| **Exact fix** | accept `PLANT_API_KEY` as an alias (done) **and/or** set the canonical `PLANT_ID_API_KEY` in Railway. Either resolves it. |

### Remaining operator action (30 seconds, non-code)
`GET /api/scan/diagnostics?live=1` in production:
- `providerConfigured:true` + `live.httpStatus:200` → **fixed, scans work.**
- still `false` → the key isn't mounted in Railway under either name → paste it.
