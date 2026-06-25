# CROP_HEALTH_INTEGRATION_REPORT

## Adapter
`server/src/ml/providers/cropHealthProvider.js` reads `CROP_HEALTH_API_KEY`
(alias `CROP_ID_API_KEY`), calls Kindwise crop.health, returns disease /
confidence / severity / affectedArea / likelyCauses / treatment / prevention /
nutritionSignal / waterStressSignal. No issue → clean READY result
("No clear issue detected"), never a fabricated disease.

## When it runs (§2)
Only for scanType ∈ leaf / wholePlant / crop / fruit / vegetable
(`cropHealthRelevant()`). It also runs in the analyze pipeline as a best-effort
call that returns UNSUPPORTED when unkeyed (zero cost).

## Consensus rule (§6)
No disease or treatment is shown unless crop.health returned a result. When it
fails, the result card shows "Health check unavailable. Plant identification
still worked." (`healthCheckAvailable=false`) — the scan never breaks.

## Wiring proof
`check:crop-health-wired` fails the build if `CROP_HEALTH_API_KEY` is read but no
adapter calls crop.health, or if the analyze route doesn't call it, or if runtime
status doesn't mark it wired.

## Result on Railway
With the key set → crop.health returns READY (disease or clean); AUTH_FAILED if
the key is rejected; UNSUPPORTED if unset. Measured, not assumed.
