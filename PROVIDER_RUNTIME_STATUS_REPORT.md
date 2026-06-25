# PROVIDER_RUNTIME_STATUS_REPORT — P0

## What was wrong (root cause)
The app reported `cropHealthReady:false` / `insectIdReady:false` **not because
the keys were missing**, but because the diagnostics path checked only Plant.id.
The sibling-provider fields were never populated → the client coerced them to
`false`. This is a wiring gap, not an env problem. Setting keys on Railway had
no effect because nothing read them.

## What was added
`server/src/ml/providerRuntimeStatus.js` reads `process.env` at RUNTIME (on
Railway) for every provider and reports, per provider:
```
{ providerName, expectedEnvNames, envNameUsed, envPresent, keyLength,
  keyFingerprint (first 6 only), providerWired, initialized, authSucceeded,
  lastHttpStatus, creditsKnown, candidateCount, failureReason, providerReady }
```
Wired through `/api/scan/diagnostics` → `__scanAcceptanceHealth().runtimeStatus`
+ logged at server boot (`[provider-status] …`, no secrets).

## Failure taxonomy (task 5)
`missing_env · auth_failed_401 · forbidden_403 · credits_exhausted ·
rate_limited_429 · timeout · provider_error · mapping_error · ready`
(+ `not_wired` for a keyed provider with no call adapter, + `pending` for keyed
+ wired but not yet proven by a call).

## The hard rule (task 7, gate-enforced)
`failureReason` is **NEVER** `missing_env` when `keyLength > 0`. The build gate
`check:provider-runtime-status` runs the classifier across every HTTP status with
a key present and fails if any path returns `missing_env`. Verified: env present
+ 401 → `auth_failed_401`; + 402/credits → `credits_exhausted`; + 200 → `ready`.

## What this means for crop.health / insect.id on Railway
Once deployed, hit `GET /api/scan/diagnostics` (admin) or read the boot log:
- **insect.id** — IS wired (`insectProvider`). If `INSECT_ID_API_KEY` is set on
  Railway, it reports `envPresent:true`; a scan proves `ready` or `auth_failed_401`.
- **crop.health** — key is now read, but there is **no inference adapter** yet, so
  it reports **`not_wired`**, not `ready`. Setting the key is necessary but NOT
  sufficient — crop.health needs an adapter to actually call it. (Honest gap.)
- **mushroom.id** — no reader, no adapter → `missing_env`/`not_wired`; genuine
  unbuilt provider.

## Final verdict
**Determined at Railway runtime, not here.** This build environment cannot see
Railway's env, so locally every provider reads `envPresent:false`. The verdict is
emitted by the deployed server:
- `__scanAcceptanceHealth().runtimeStatus.providers[].failureReason` per provider.
- If `INSECT_ID_API_KEY` is set and a scan returns 200 → insect.id `PROVIDER_READY`.
- If set but a scan returns 401 → `BLOCKED_BY_AUTH` (auth_failed_401).
- If 402/quota → `BLOCKED_BY_CREDITS`.
- crop.health → `not_wired` until an adapter is built (a code task, not an env task).

**Recommended next check (you, on Railway):** open `/api/scan/diagnostics?live=1`
as admin and read `runtimeStatus.providers` — it now tells the truth per provider.
