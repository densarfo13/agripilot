# SCAN_PLATFORM_REPORT — Scan Intelligence v10

Extends the existing scan subsystem (no redesign). Honest framing: most of v10 was
already built across prior sprints; this sprint adds the genuine deltas.

## Object coverage (now 17 + unknown)
leaf · wholePlant · fruit · vegetable · flower · tree · seedling · insect · soil
**+ herb · seed · grass · shrub · houseplant · hydroponic · greenhouse · weed**
(the 8 new classes shipped here). Each routes to providers; ambiguous → `unknown`
→ review (never a forced guess).

## Already shipped (composed, not rebuilt)
- Every-scan fields (object/name/confidence/health/stage/action/why/follow-up):
  IntelligentScanResult + ScanSpecializedEngines + FarmBrainV2.
- FarmBrain timelines + recommendation + decision/evidence/trust engines.
- Multi-photo scan composer; risk engine (disease/pest/weather/water/nutrient).
- Quality control (blur/dark/distance/photo-quality gate); review queue.
- Observability + provider reliability + golden-dataset accuracy harness.

## API surface
POST /api/scan (→ analyze) · POST /api/scan/history · POST /api/scan/review ·
POST /api/scan/bulk · GET /api/scan/statistics · GET /api/scan/providers.

## Honest limits (not fabricated)
- Ripeness / produce grade / storage readiness are **advisory** ("check by hand")
  — real CV models are not present; no fabricated percentage is emitted (gate-enforced).
- Field-intelligence counts (plant count / canopy %) need a CV model — not claimed.
- 20,000-image dataset + >99% accuracy are field/operator work (see FIELD_VALIDATION_REPORT).
