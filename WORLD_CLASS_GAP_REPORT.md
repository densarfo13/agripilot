# WORLD_CLASS_GAP_REPORT — what is genuinely missing

"World-class" honestly means: it tells the truth about what it knows and what it does
not. By that bar the platform is already there. The gaps between today and the full
v14 vision are NOT code — they are four external capabilities.

## 1. A computer-vision segmentation / counting model  (biggest real gap)
Unlocks ALL of Phase-3 visual analytics (fruit/leaf count, canopy %, severity,
biomass, ripeness…). The evidence-tier engine is pre-wired to serve these as
`measured` / `estimated` the day a model lands. **This is the single highest-leverage
build** — an ML / data-collection effort, not a TypeScript sprint.

## 2. Provider data feeds
Market price, satellite (Sentinel/NDVI), drone, IoT — each is `no_live_feed` today.
Each needs a real integration + credentials. Declared, never faked.

## 3. The live pilot
Providers are keyed; readiness is `DEGRADED` until a real scan proves them. The
golden-dataset accuracy benchmark is `PENDING` until populated with verified images.
Both are operator / field work.

## 4. Enterprise infrastructure
10M farms / 100M scans / Kafka / Kubernetes / Redis / read-replicas / SOC2 / ISO27001
— an infrastructure + certification PROGRAM. The app architecture is compatible with
it; achieving it is ops, not a code change.

## Low-value deferred items (named, not padded)
- Classifier classes for moss / lichen / fern / cactus / vine / aquatic: the
  classifier ROUTES; plant.id still identifies these (as `wholePlant` / `unknown`),
  so adding classes is cosmetic — low farmer value, deferred.

## What is NOT a gap
Identification, evidence tiers, consensus, digital twin, quality gate, explainability,
honesty enforcement, security — all built and gate-enforced. **The next real step is
#1 (a CV model) or #3 (the pilot), neither of which is another spec.**
