# WORLD_CLASS_SCAN_V12 — Farroway Scan Intelligence v12

A single orchestrator (`analyzeScanV12`) composes every existing engine into the
full v12 field taxonomy — **98 fields across 11 sections** — without rewriting the
production-certified architecture. Every field is a `V12Field`:
`{ value, status, confidence, source, evidence }`.

## What "world-class" means here: the status tells the truth
| Status | Meaning | Examples |
|---|---|---|
| `ok` | measured/known fact | scientific name (known crop), photo/voice support |
| `estimated` | honest model estimate | harvest window (calendar), weather risks (forecast) |
| `advisory` | reference guidance, not image-measured | pest treatment, storage, market grade |
| `unknown` | we don't know (acceptable) | soil N/P/K/CEC, identity of an unlisted plant |
| `unavailable` | needs a capability we don't run | **all CV fields** — health %, counts, canopy, ripeness |
| `no_live_feed` | no live source wired | **all market fields**, drone/satellite/video/sensor |

## The honesty invariants (gate + 517-assertion test enforce them)
- **CV-dependent → `unavailable`, value null.** Health/stress/damage %, fruit/flower
  counts, yield/weight/biomass, plant population/spacing/canopy/ripeness. No vision
  model exists, so no number is invented.
- **Market → `no_live_feed`, value null.** Price, demand, buyers, sell time are
  NEVER fabricated.
- **Soil N/P/K/CEC → `unknown`.** Not in our free data sources; a lab test is named
  as the real path. Moisture/pH/organic populate only from real server-side soil.
- **Identity → real reference only when confident AND known.** Low confidence or an
  unlisted plant returns `unknown` — never a guessed binomial.

## Real, composed (not rebuilt)
Botanical reference (12 crops, real binomials/edibility/toxicity/companions) ·
crop-calendar field intelligence (v11) · live-weather risk (`WeatherRiskRuntime`) ·
server-side soil · FarmBrain timelines · simple/expert/voice/local-language modes.

**Unknown is always acceptable; a fabricated number never is.** That is the whole
engine.
