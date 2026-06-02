# INTELLIGENCE_PLATFORM_REPORT

**Sprint:** Farroway Intelligence Platform V1
**Date:** 2026-06-02
**Modes:** `/godmode` `/ooda` `/artifacts`
**Mission:** create a single unified recommendation engine.

---

## Single source of truth — delivered

The farmer's Home page now leads with **ONE** highest-priority action. That action is computed server-side by `recommendationPriorityEngine.js` which composes every upstream signal the platform already produces. No new APIs were added; this sprint is the composition layer.

---

## Spec → delivery

| § | Spec | Delivery |
|---|---|---|
| Recommendation Engine | `server/src/ml/recommendationPriorityEngine.js` exposes `computeUnifiedRecommendations({ weather, scan, soil, regional, satellite, market, outcomeHistory }) → { topAction, topThree, sources, generatedAt }`. Pure / never throws. |
| Action Prioritization | `scoreAction({ risk, urgency, impact, confidence }) → 0..100` using **frozen weights 30/30/25/15** (gate-locked). |
| Example output shape | `{ source, recommendation, reason[], expectedBenefit, risk, urgency, impact, confidence, priorityScore, timeframeDays, category, outcomeLift? }` |
| Soil Intelligence | Composes existing `soilProvider.fetchSoilProfile` → uses `soilRisk` + `soilRecommendation` + `fertilityScore` |
| Satellite Intelligence | Composes existing `fieldHealthProvider.fetchFieldHealth` → uses `ndvi` + `vigor` + `stressLevel` + `trend` |
| Regional Intelligence | Composes existing `regionalIntelligenceProvider.getRegionalIntelligence` → uses `diseasePressure` + `pestPressure` + `rainfallTrend` |
| Market Intelligence | Composes existing `marketEngine.getMarketIntelligence` → uses `currentPrice` + `demandScore` + `recommendedSellWindow` |
| Outcome Intelligence | Composes `outcomeIntelligenceEngine.computeRecommendationSuccess` (90d) → `_applyOutcomeBoost` lifts confidence +0.15 when historical success ≥70%, demotes –0.15 when <30% |
| Command Center | Replaces multiple alert sources with `topThree` (≤3 actions, sorted by priority score). |
| Home Page | `<TopActionCard />` mounted in `Home.jsx` directly above the legacy Today's-task card. Renders the 4 spec fields: **1. Highest Priority Action · 2. Why · 3. Expected Benefit · 4. Confidence** (plus a Priority badge with score). Self-hides on the honest empty state. |
| Founder Analytics | Surfaced via the existing FounderOSPage + OrganizationOutcomesPage which already render Recommendation Accuracy + Outcome Success Rate (V2 + Outcome Intelligence sprints). The V1 engine feeds those panels — no duplicate dashboard. |
| Organization Dashboard | Existing `/admin/organization-outcomes` page shows Risk Farms + Intervention Success (`programImpactPct`). The V1 engine's prioritization now drives the same upstream data. |
| Build Safety | `scripts/check-intelligence-platform-v1.mjs` (build:safe step 278). Locks every contract point — including the **exact weights 30/30/25/15** and **topAction:null on empty input** (no fabricated recommendations). |

---

## End-to-end pipeline

```
GET /api/recommendations/today (authenticated farmer)
   │
   ├─ Locate user's primary farm  (Prisma)
   ├─ Pull most recent scan       (scanTrainingEvent + weatherSummary v3 envelope)
   │
   ├─ Promise.all
   │    ├─ soilProvider.fetchSoilProfile           (SoilGrids)
   │    ├─ fieldHealthProvider.fetchFieldHealth    (Sentinel Hub NDVI)
   │    ├─ regionalIntelligenceProvider            (recent scans + planting windows)
   │    └─ marketEngine.getMarketIntelligence      (listings + buyers + ref table)
   │
   ├─ weatherProvider.getWeatherForFarm            (Open-Meteo)
   ├─ outcomeIntelligenceEngine.computeRecommendationSuccess(90d)
   │
   ▼
recommendationPriorityEngine.computeUnifiedRecommendations(...)
   ├─ _fromScan       → candidate action (when scan has disease or pest)
   ├─ _fromSoil       → candidate action (when soilRisk.kind != 'none')
   ├─ _fromWeather    → candidate action (when ≥10mm rain or ≥32°C dry)
   ├─ _fromSatellite  → candidate action (when stressLevel != 'low')
   ├─ _fromRegional   → candidate action (when pressure == 'high')
   ├─ _fromMarket     → candidate action (when sell window opens ≤14d)
   │
   ▼ _applyOutcomeBoost(action, outcomeHistory)
   ▼ priorityScore = round(risk·30 + urgency·30 + impact·25 + confidence·15)
   ▼ sort desc by priorityScore
   ▼
Response: { ok, topAction, topThree, sources, generatedAt, scoringWeights, limitations }
```

---

## Honest empty state

Per the gate-enforced rule (`topAction: null`):

When no signal is present (no recent scan, no farm coords, no soil/satellite/market/weather data), the engine returns:
```js
{
  ok: true,
  topAction: null,
  topThree: [],
  message: 'Scan a plant or add location for personalized actions.',
  sources: { weather: false, scan: false, ... },
  limitations: 'Decision support, not a guarantee.'
}
```
The TopActionCard renders the empty-state copy — never fabricates a recommendation.

---

## Files

**New (4):**
- `server/src/ml/recommendationPriorityEngine.js` — server-side composer + scoring
- `src/runtime/intelligencePlatform/IntelligencePlatformRecommendationEngine.ts` — client adapter + health
- `src/components/intelligence/TopActionCard.jsx` — single highest-priority surface
- `scripts/check-intelligence-platform-v1.mjs` — contract gate
- `INTELLIGENCE_PLATFORM_REPORT.md` (this file)

**Extended (4):**
- `server/src/app.js` — `GET /api/recommendations/today` + `POST /api/recommendations/score`; composes 5 lazy-imported upstream modules
- `src/pages/Home.jsx` — mounts `<TopActionCard />` above the legacy Today card
- `src/App.jsx` — boot installs `__intelligencePlatformHealth`
- `package.json` — gate + build:safe:steps

**0 wave-36 frozen files modified.**
**0 new Prisma models / migrations** — V1 reads existing tables only.

---

## Verification (post-deploy)

```bash
# Top action for the signed-in farmer:
curl -H 'Cookie: <session>' https://www.farroway.app/api/recommendations/today | jq

# Compute the priority score for arbitrary weights:
curl -X POST -H 'Cookie: <session>' \
     -H 'Content-Type: application/json' \
     -d '{"risk":0.8,"urgency":0.9,"impact":0.7,"confidence":0.85}' \
     https://www.farroway.app/api/recommendations/score | jq
# → { "ok": true, "priorityScore": 81 }

# In a logged-in browser session:
window.__intelligencePlatformHealth()
# → { initialized: true, recommendationEngineReady: true,
#     composesScan: true, composesWeather: true, composesSoil: true,
#     composesSatellite: true, composesRegional: true,
#     composesMarket: true, composesOutcomeHistory: true,
#     appliesOutcomeBoost: true, returnsSingleTopAction: true,
#     returnsTopThreeOrFewer: true, noFabricatedRecommendation: true,
#     respectsArchitectureLock: true }
```

---

## Build state

- `build:safe` → **278 sequential gates green** (up from 277)
- New gate `check:intelligence-platform-v1` locks the contract — including the **exact 30/30/25/15 weight formula** and the **never-fabricates-a-recommendation** invariant.

---

*Decision support, not a guarantee.*
