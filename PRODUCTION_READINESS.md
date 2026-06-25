# PRODUCTION_READINESS

## Final verdict
| Provider | Verdict |
|---|---|
| Plant.id | PARTIAL (wired+keyed; live accuracy PENDING) |
| Crop.health | PARTIAL (wired; key+accuracy PENDING on Railway) |
| Insect.id | PARTIAL (wired; PENDING) |
| Mushroom.id | PARTIAL (wired, safe; PENDING) |
| Soil | PARTIAL (hardened; live readiness PENDING) |
| Weather | READY |
| Sentinel Hub | NOT_INTEGRATED |

**Overall: READY_FOR_PILOT.**

## What makes it PRODUCTION_READY (the operator's remaining steps)
1. Set `CROP_HEALTH_API_KEY`, `INSECT_ID_API_KEY`, `MUSHROOM_ID_API_KEY`,
   `AMBEE_API_KEY` on Railway.
2. Run the live photo acceptance (`npm run scan:acceptance`) across the Phase-2
   matrix; confirm identification + health + insect + mushroom-safety on real images.
3. Confirm per-provider `ready` at `/api/scan/diagnostics?live=1` +
   `/api/environment/diagnostics`.

The pipeline LOGIC + safety are certified and gated now; the remaining gap is a
live verification run + provider keys, not code.
