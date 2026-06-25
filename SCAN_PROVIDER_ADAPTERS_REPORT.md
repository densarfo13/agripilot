# SCAN_PROVIDER_ADAPTERS_REPORT

## Architecture (the security line)
Real provider API calls live SERVER-SIDE (`server/src/ml/providers/*.js`) because
the keys are secrets — calling Kindwise from the browser would leak the key. The
client `src/runtime/scan/providers/*.ts` are typed NORMALIZERS over the server's
`/api/scan/analyze` response, plus a consensus layer. No key ever touches the browser.

## 1. Providers wired
| Provider | Server adapter | Client normalizer | Status |
|---|---|---|---|
| plant.id | consensus engine (existing) | via scan envelope | wired |
| crop.health | `cropHealthProvider.js` (NEW) | `CropHealthProvider.ts` (NEW) | wired |
| insect.id | `insectProvider.js` (existing) | via pest envelope | wired |
| mushroom.id | `mushroomProvider.js` (NEW) | `MushroomProvider.ts` (NEW) | wired |

## 2. Provider runtime status
`/api/scan/diagnostics` + `__scanAcceptanceHealth().runtimeStatus` report each
provider's envPresent/keyLength/fingerprint/wired/failureReason. All four are now
`wired:true`; a keyed provider is never `missing_env`.

## 3. Status taxonomy
`READY / NO_RESULT / UNSUPPORTED / AUTH_FAILED / CREDITS_EXHAUSTED / RATE_LIMITED
/ TIMEOUT / PROVIDER_ERROR` — emitted per scan in `providerStatuses`.

## 7. Build results
build:safe green (see commit). Gates: check:provider-adapters,
check:crop-health-wired, check:mushroom-safety, check:scan-consensus,
check:scan-provider-adapters, check:provider-runtime-status.

## 8. Final verdict: SCAN_READY (code) → MULTI_PROVIDER_READY_FOR_PILOT pending keys
Adapters + consensus + safety are built, gated, deployed. Live multi-provider
readiness is MEASURED on Railway: set CROP_HEALTH_API_KEY + INSECT_ID_API_KEY +
MUSHROOM_ID_API_KEY, then `npm run scan:provider-test` confirms per-provider READY.
