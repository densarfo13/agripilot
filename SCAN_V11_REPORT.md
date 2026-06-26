# SCAN_V11_REPORT

Extends the stable scan platform with field intelligence (no redesign).

## Shipped this sprint (the genuine delta)
- `FieldIntelligenceEngine` → `__fieldIntelligenceHealth()`: calendar-based
  estimates (plant age / maturity / harvest window / growth velocity) that are
  REAL from a planting date, and CV-dependent fields (counts / canopy / density /
  spacing / yield / biomass / coverage) that are honest `unavailable` — never
  fabricated. 40-assertion test + gate enforce it.

## Composed (already built — not rebuilt)
Location/season/weather/soil context, the recommendation engine (evidence +
confidence + reason + next action), and farm memory timelines.

## Honest production line
Every recommendation includes evidence, confidence, reason, and next action; no
fabricated confidence; **unknown is always acceptable** (low confidence → review,
no FarmBrain ingestion). The CV-dependent field estimates remain PENDING a real
vision model — flagged, not faked.

Verdict: **field intelligence extended, honestly.**
