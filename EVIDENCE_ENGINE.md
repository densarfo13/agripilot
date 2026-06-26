# EVIDENCE_ENGINE — Scan Intelligence evidence tiers

Replaces the flat `unavailable / unknown / no_live_feed` taxonomy with **evidence
tiers**: every scan field is classified by HOW a real value would be obtained, and
its status reports whether that capability exists right now. Same honesty, far more
actionable — the farmer/operator learns *why* a field has no value and *what* would
provide one.

## The 6 tiers
| Tier | Meaning | A real value today? |
|---|---|---|
| 1 DIRECT_MEASURED | direct image measurement | needs a CV model → `awaiting_model` |
| 2 MODEL_ESTIMATED | a validated estimation model | **YES for crop-calendar fields** (plant age/maturity/harvest/velocity → `estimated`, estimated=true); CV-based ones (yield/biomass/ripeness/stress/health) → `awaiting_model` |
| 3 FUSED_ESTIMATE | image + weather + soil + gps + history | needs the CV component → `awaiting_model` |
| 4 LIVE_PROVIDER | external live feed | **YES for weather** (`live`) + **soil pH/moisture** when present; market/satellite/drone/iot → `awaiting_provider` |
| 5 LAB_REQUIRED | laboratory test | N/P/K/CEC/organic-matter/micronutrients → `awaiting_lab` (never estimated) |
| 6 UNKNOWN | no model, provider, or evidence | `unknown` |

## Every field returns the full contract
`{ field, tier, status, value, confidence, source, reason, estimated, lastUpdated }`.

## The hard rules (gate + 187-assertion test enforce them)
- **A value exists only for a real `measured` / `estimated` / `live` status.** No
  value → null confidence + null lastUpdated.
- **We do NOT hardcode unavailable when a validated model exists.** Crop-calendar
  fields are served as real `estimated` values (estimated=true, method=crop-calendar,
  confidence); live-weather risks as real `live` values.
- **CV-dependent fields are tier-labeled but `awaiting_model` with a null value** —
  never a fabricated count/score.
- **Lab fields are `LAB_REQUIRED`, never estimated** from a photo.
