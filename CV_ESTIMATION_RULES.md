# CV_ESTIMATION_RULES — when a field may carry a value

These rules are mechanically enforced by `check:evidence-tier` + the test. They exist
so the platform can never drift into fabricating a measurement.

## A field MAY carry a value only when:
1. **Tier 1 DIRECT_MEASURED** — a real computer-vision model measured it from the
   image (status `measured`, confidence required). *No CV model is deployed today, so
   no Tier-1 field currently carries a value.*
2. **Tier 2 MODEL_ESTIMATED** — a VALIDATED estimation model produced it. The only
   validated model wired today is the **crop calendar** (deterministic crop-duration
   model): plant age / maturity / harvest window / growth velocity → `estimated`,
   `estimated=true`, `method=crop-calendar`, with a confidence. CV-based Tier-2 fields
   (yield/biomass/ripeness/stress/health/recovery) require a CV model and stay
   `awaiting_model`.
3. **Tier 3 FUSED_ESTIMATE** — a model fusing ≥2 real sources produced it. Requires the
   CV component, so `awaiting_model` today.
4. **Tier 4 LIVE_PROVIDER** — a live feed returned it: weather (`live`) and soil
   pH/moisture (`live` with soil context). Market/satellite/drone/iot are
   `awaiting_provider`.

## A field MUST NOT carry a value when:
- **Tier 5 LAB_REQUIRED** — N/P/K/CEC/organic-matter/micronutrients need a soil lab
  test; never estimated from a photo (`awaiting_lab`).
- **Any tier without its capability present** — `awaiting_model` / `awaiting_provider`
  / `awaiting_input`, value null, confidence null, lastUpdated null.

## The deployment rule
When a validated CV model is later added, flip the relevant fields from
`awaiting_model` to `measured`/`estimated` — and ONLY then. Adding a model is the only
way a Tier-1/2 CV field earns a value. No value is ever hardcoded.
