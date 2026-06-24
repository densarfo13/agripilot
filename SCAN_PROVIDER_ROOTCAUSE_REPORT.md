# SCAN_PROVIDER_ROOTCAUSE_REPORT.md

**P0 — "clear plant photos return Unknown / Needs review / Scan unclear."**
Sprint #221. Date: 2026-06-23. Server-only (no UI / no localization).

## Verdict (deliverables the spec asked for)

| Ask | Answer |
|---|---|
| **Failing file** | `server/src/ml/scanInferenceService.js` (`_externalClassify`) → silently swallows the provider HTTP failure and falls to the rule classifier, which returns `symptom:'unclear'`. |
| **Failing function** | `_externalClassify()` line ~137: `if (!res.ok) return { ok:false, error: provider_http_<status> }` — the status was discarded and never surfaced. |
| **Failing env variable** | **`PLANT_ID_API_KEY`.** `plantIdProvider.buildRequest` sets `'Api-Key': key \|\| ''` — if the key is unset/blank, an EMPTY Api-Key header is sent → Plant.id replies **401/403** → consensus gets zero candidates → UI floor = "Scan unclear". |
| **Failing API call** | `POST https://plant.id/api/v3/identification` with an empty/invalid `Api-Key` header. |
| **Exact fix** | (1) Verify + set `PLANT_ID_API_KEY` in Railway prod (operational). (2) This sprint makes the failure VISIBLE + DISTINCT so it can never be silent again. |

## What this sprint added (server)

1. **Outbound + inbound logging** in `_externalClassify`:
   `[scan.provider] → plantid <url> auth=yes|MISSING` and
   `[scan.provider] ← HTTP <status> … candidates=N conf=… latency=…ms`
   (auth errors log a 240-char body snippet). No key, no image bytes.
2. **`getScanProviderDiagnostics()`** — `{ providerConfigured, keyPresent,
   keyLength, keyLooksTruncated, lastHttpStatus, lastCandidateCount,
   lastConfidence, lastFailureReason, lastLatencyMs }`. Presence + length
   ONLY — the key value is never returned (gate-enforced).
3. **`GET /api/scan/diagnostics`** (auth-only) — the emergency endpoint:
   `{ providerConfigured, providerAvailable, httpStatus, candidateCount,
   confidence, failureReason, keyLength, keyLooksTruncated }`.
4. **`serviceUnavailable` flag** propagated from `_externalClassify` →
   `analyzePlantImage` meta: TRUE when a CONFIGURED provider FAILS
   (401/403/429/5xx/timeout) — distinct from "unconfigured" and from a
   clean "no result". This is the signal a UI follow-up uses to show
   "service temporarily unavailable" instead of "Unknown plant".
5. Client `window.__scanDebug()` already carries `providerStatus` +
   `failureReason` (#219/#220) — now backed by real server status.
6. `check:scan-provider-diagnostics` gate (in build:safe): asserts the
   diagnostics + route + logging exist and the key value is never logged.

## How to confirm the root cause in 30 seconds (production)
`GET /api/scan/diagnostics` (logged in) → read `providerConfigured` +
`keyLength` + `httpStatus`:
- `providerConfigured:false` / `keyLength:0` → **key not set on Railway** → set it.
- `keyLooksTruncated:true` → key set but malformed/whitespace → re-paste.
- `httpStatus:401|403` → key invalid/expired → rotate.
- `httpStatus:429` → **quota exhausted** → top up / throttle.
- `httpStatus:200, candidateCount:0` → genuinely unidentifiable photo (rare).

## Railway secrets (items 9-10)
Cannot be read from code — they live in the Railway dashboard. The
diagnostics endpoint is the runtime proof: if `providerConfigured:true`
and `httpStatus:200`, the secret IS mounted and the quota is live. If
not, the endpoint says exactly which of the five failure modes applies.

## §7 invariant
"Provider returns valid candidates → never Scan-unclear" is held:
candidates flow through unchanged (envelope/UI never discard them, per
SCAN_UNCLEAR_AUDIT.md); the only empty-candidate paths are the provider
failures enumerated above, which now log + surface `serviceUnavailable`.
