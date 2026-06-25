# SCAN_PROVIDER_ADAPTERS

Closes the `not_wired` gap surfaced by the runtime-status audit: crop.health and
mushroom.id now have real Kindwise adapters.

## CropHealthProvider — `server/src/ml/providers/cropHealthProvider.js`
- Reads `CROP_HEALTH_API_KEY` (alias `CROP_ID_API_KEY`).
- POSTs the image to the Kindwise crop.health endpoint (`Api-Key` header,
  `details: [treatment, prevention, cause, common_names, description]`), 6s timeout.
- Returns: `disease, confidence, confidencePct, severity, affectedArea,
  treatment, prevention, nutrition, irrigation, candidates`.
- `status ∈ READY | AUTH_FAILED | RATE_LIMITED | NO_RESULT | UNSUPPORTED`.
- Best-effort: returns UNSUPPORTED/ok:false on missing key or unreachable API —
  never throws, never fabricates a disease.

## MushroomProvider — `server/src/ml/providers/mushroomProvider.js`
- Reads `MUSHROOM_ID_API_KEY`. POSTs to the Kindwise mushroom.id endpoint.
- Returns: `species, edibility (edible|toxic|inedible|unknown), confidence,
  warnings, candidates`.
- **SAFETY:** edibility is life-critical. The adapter NEVER upgrades an unknown to
  "edible"; anything unconfirmed stays `unknown` with a strong "never eat a wild
  mushroom based on an app — confirm with a local expert" warning. Toxic →
  explicit "do not touch or eat" warning.

## Endpoint note (honest)
Both use the Kindwise `*.kindwise.com/api/v1/identification` convention (same as
the shipped insect.id adapter). The exact host is overridable via
`CROP_HEALTH_ENDPOINT` / `MUSHROOM_ID_ENDPOINT` env if Kindwise's path differs;
on a mismatch the adapter degrades to NO_RESULT/UNSUPPORTED, never a fake result.

## Status taxonomy → provider verdict
`missing key → UNSUPPORTED · 401/403 → AUTH_FAILED · 429 → RATE_LIMITED ·
200+no suggestion → NO_RESULT · 200+result → READY · timeout/5xx → UNSUPPORTED`.
