# CV_PIPELINE_REPORT — the honest state of computer vision

## What exists (real)
- **Image quality preflight** (`src/lib/imageQualityPreflight.js`): luminance +
  Laplacian-variance sharpness, in-browser, under 30ms.
- **Image Quality Gate** (`src/runtime/scan/quality/ImageQualityGate.ts`): composes
  the preflight into sharpness/brightness/resolution scores + a gating decision (low
  quality → no diagnose / no FarmBrain ingest / no task + retake guidance).
- **Provider identification**: plant.id / crop.health / insect.id / mushroom.id do
  the actual species + disease + pest recognition (server-side).

## What does NOT exist (and is therefore awaiting_model, never fabricated)
The Phase-3 "visual analytics" — fruit count, flower/bud/leaf count, weed %, canopy
%, fruit size, leaf area, biomass, ripeness, disease/pest severity, symmetry, stem
thickness, branch/flower density — all require a **segmentation / counting CV model
on the image**. No such model is deployed.

`EvidenceTierEngine` correctly returns every one of these as
`status: awaiting_model, value: null` (Tier 1 DIRECT_MEASURED / Tier 2
MODEL_ESTIMATED). The quality gate's four CV-dependent factors (distance,
targetVisible, motionBlur, multipleObjects) are likewise `not_assessed: null`.

## The single real next step
Deploy ONE validated segmentation/counting model and wire it into the Tier-1/2 path.
The evidence-tier engine is already built to serve those fields as `measured` /
`estimated` the moment a model lands — no rework. Until then, an honest
`awaiting_model` is the only truthful output. **A fabricated count is the one thing
the charter forbids.**
