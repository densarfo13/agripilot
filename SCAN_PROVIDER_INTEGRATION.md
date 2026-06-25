# SCAN_PROVIDER_INTEGRATION

## Pipeline order
`Plant.id (consensus) → Crop.health → Insect.id → Mushroom.id → FarmBrain`.

In `/api/scan/analyze` the four providers run in a single failure-isolated group
(`Promise.all` over adapters that never throw), then merge in the order above.
Parallel execution keeps scan latency low; failure-isolation means **a provider
failure never stops the scan** (each returns an honest UNSUPPORTED/ok:false
envelope).

## Cost-aware gating
- **crop.health** runs on every scan (disease is universal) — UNSUPPORTED with
  no key, so zero API cost until keyed.
- **mushroom.id** fires ONLY on a mushroom-relevant scan (cropName/scanMode
  matches mushroom/fungi/toadstool); otherwise it short-circuits UNSUPPORTED with
  no API call. This avoids burning mushroom credits on every leaf scan.

## What the response carries
`/api/scan/analyze` now returns `cropHealth`, `mushroom`, and a `providerStatuses`
summary: `{ plantId, cropHealth, insectId, mushroom }` each ∈ the status taxonomy
— the live per-scan truth. FarmBrain merges these alongside plant + pest signals.

## Runtime status
`providerRuntimeStatus.js` now marks crop.health + mushroom.id `wired:true`, so
`/api/scan/diagnostics` + `__scanAcceptanceHealth().runtimeStatus` report them as
keyed/auth/credits rather than `not_wired`. The hard rule still holds: a keyed
provider is never `missing_env`.

## Failure isolation (verified)
The adapter gate runs both adapters with no key and asserts they return
UNSUPPORTED, never throw — so the scan pipeline cannot be broken by a provider.
