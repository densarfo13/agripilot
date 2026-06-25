# SCAN_TYPE_ROUTER_REPORT.md

**Scan the right thing the right way.** Sprint #231. Farroway no longer
forces every photo through the plant-only result path.

## The router

`src/runtime/scan/router/ScanTypeRouter.ts` + `ScanTypeContracts.ts`.
`detectScanType(input)` → `{ scanType, confidence, route, reason, providers }`.

**Signals (priority order):** (1) user-selected scan mode, (2) provider
candidates (object type + name), (3) image hints, (4) crop context.

| scanType | route | providers |
|---|---|---|
| leaf · whole_plant · stem | `plant_disease` | plant.id, crop.health |
| fruit · vegetable | `fruit_quality` | plant.id, quality_analysis |
| insect | `insect_pest` | **insect.id** |
| soil | `soil_visual` | soil_visual |
| unknown | `review` | (coaching only) |

Every scan result now carries `scanType` + `scanRoute` (attached in the
`scanDetectionEngine` chokepoint, both the API result and the rule
fallback — no bypass). `window.__scanTypeRouterHealth()` →
`{ routerReady, fruitRouteReady, vegetableRouteReady, insectRouteReady,
soilRouteReady, lowConfidenceBlocked }` (all true).

## Routing → result cards

`IntelligentScanResult` branches on `scanType`:
- **fruit / vegetable** → `FruitVegResultCard` (status/quality/issue/action/follow-up)
- **insect** → `InsectResultCard` (pest/threat/impact/action/follow-up)
- leaf / whole_plant / stem → the existing plant-disease card
- soil / unknown → photo-quality coaching + save-for-review

## Safety gates (§5)

`applyScanTypeSafetyGate(decision)` — below `SCAN_CONFIDENCE_MIN = 70`:
`allowPlantCreation: false`, `allowTaskCreation: false` (only retake /
save-for-review), `ingestFarmBrain: false`, `showCoaching: true`.

## Build gates (§8) — all enforced by `check:scan-type-router`

- ✅ fruit scan can't render "Unknown plant"
- ✅ vegetable scan routes to the fruit-quality card, not crop-health-only
- ✅ insect route declares Insect.id (no bypass)
- ✅ low-confidence result can't create a plant
- ✅ `scanType` present on every result

## Pre-scan modes (§6)

`ScanModeSelector` — Auto-detect (default) · Scan Plant · Scan Leaf ·
Scan Fruit · Scan Vegetable · Scan Insect · Scan Soil. Localized across
all 6 locales (Twi coverage held at 97.5%).

## Acceptance (§9) — expected routing

| # | Input | scanType | route | card |
|---|---|---|---|---|
| 1 | tomato fruit | fruit | fruit_quality | FruitVeg |
| 2 | pepper fruit | fruit | fruit_quality | FruitVeg |
| 3 | onion leaf | leaf* | plant_disease | plant |
| 4 | maize leaf | leaf | plant_disease | plant |
| 5 | insect on leaf | insect | insect_pest | Insect |
| 6 | soil photo | soil | soil_visual | coaching |
| 7 | blurry photo | unknown | review | coaching + retake |

*onion: if the candidate name resolves to onion it routes vegetable;
the leaf signal wins when the photo is clearly a leaf.

## Honest provider status

The router routes correctly today, but the **deep providers are
key-gated**: only `PLANT_ID_API_KEY` is configured. `CROP_HEALTH_API_KEY`
and `INSECT_ID_API_KEY` are unset, so the insect/quality routes currently
**degrade honestly** — they show the right card with "analysis still being
added / take a closer photo" coaching rather than a fabricated insect or
ripeness result. Add the two Kindwise keys and the deep analysis lights up
with **no further code change** — the routes already point at them.
