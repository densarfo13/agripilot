# PROVIDER_SCORECARD

Readiness is **measured at runtime** (Railway) via `/api/scan/diagnostics` +
`/api/environment/diagnostics`. Live crop-photo accuracy is **PENDING the operator
run** — never fabricated here.

| Provider | Wired (adapter) | Config | Live accuracy | Verdict |
|---|---|---|---|---|
| Plant.id | ✅ | keyed (alias) | PENDING | **PARTIAL** |
| Crop.health | ✅ | runtime-measured | PENDING | **PARTIAL** |
| Insect.id | ✅ | runtime-measured | PENDING | **PARTIAL** |
| Mushroom.id | ✅ (never claims edible) | runtime-measured | PENDING | **PARTIAL** |
| Ambee Soil | ✅ (hardened) | runtime-measured | PENDING | **PARTIAL** |
| Weather | ✅ | live, no secret | live | **READY** |
| Sentinel Hub | ❌ none | — | — | **NOT_INTEGRATED** |

"PARTIAL" = adapter wired + safe; flips to READY once keyed + a live photo run
verifies it on Railway. To run the live verification:
`SCAN_API_BASE=… SCAN_API_TOKEN=… SCAN_IMAGE_DIR=… npm run scan:acceptance`.
