# DIGITAL_AGRONOMIST_FOUNDATION_REPORT.md

**Sprint #194 (spec #189A FINAL) — Digital Agronomist Foundation.**
Date: 2026-06-13

The farmer opens Farroway and immediately knows:
1. **How healthy is my farm?** — Health tile (0-100 + label) + Why line
2. **What is my biggest risk?** — Risk tile + sub-risk chips
3. **What should I do today?** — ONE action with Start
4. **Why should I do it?** — reason + confidence on the action card

---

## Architecture

```
                ┌──────────────────────────────┐
                │  Existing pinned probes      │
                │  __farmHealthScoreHealth     │
                │  __farmRiskHealth (4 cats)   │
                │  __retentionHealth           │
                │  __predictiveHealth          │
                └─────────────┬────────────────┘
                              │ read-only composition
                ┌─────────────▼────────────────┐
                │  FarmHealthEngine.ts (#194)  │
                │  getFarmHealthBrief() →      │
                │  { healthScore, confidence,  │
                │    contributors[], risks[] } │
                │  pins __farmHealthBrief()    │
                └─────────────┬────────────────┘
                              │
   RecommendationEngine ──────┤ (one action + why + confidence,
   (#172, 40/30/20/10)        │  40% scan / 30% weather /
                              │  20% lifecycle / 10% outcomes)
                ┌─────────────▼────────────────┐
                │  CommandCenterDeck (Home     │
                │  hero, #192/#193/#194)       │
                │  tiles + why + chips +       │
                │  action + confidence +       │
                │  ONE Start button            │
                └─────────────┬────────────────┘
                              │ Start →
                ┌─────────────▼────────────────┐
                │  Task → follow-up (3/7/14d)  │
                │  → outcome (better/same/     │
                │    worse) → engine weighting │
                │  (#168/#173 chain)           │
                └──────────────────────────────┘
```

Every layer is a composer over the one below — no duplicate
state, no new ML.

---

## Home hierarchy (above the fold)

```
Farm Command Center
┌──────┬───────┬─────────┬────────┬────────────┐
│ Crop │ Stage │ Health  │ Risk   │ To Harvest │
│Tomato│ Veg.  │ 87/100  │ Medium │  41 days   │
└──────┴───────┴─────────┴────────┴────────────┘
 [+ Healthy recent scans] [+ Tasks completed]      ← Why (#194)
 [Disease: low] [Weather: medium] [Water: low]     ← Risks (#193)
┌───────────────────────────────────────────────┐
│ TODAY'S ACTION                                 │
│ Inspect lower onion leaves                     │
│ Why: regional thrips pressure increasing       │
│ Time required: 5 min · Confidence: 92%         │
│              [█ START]   [▢ Scan]              │
└───────────────────────────────────────────────┘
```

Everything else (DailyFarmPlanCard, TopActionCard, scan row)
demoted below into the collapsed "More for today" section (#192).
Exactly ONE primary Start button — gate-enforced.

---

## Scoring model

Documented in full in FARM_HEALTH_REPORT.md (#193). Summary:
- Score 0-100 from `__farmHealthScoreHealth` (vegetation classifier
  + drought folded; NDVI sealed from grower UI). Bands 75/50.
- **NEW #194 — "never show score without explanation":**
  `FarmHealthEngine.getFarmHealthBrief()` derives contributors,
  each requiring a REAL probe attestation:

| Contributor key | Condition (probe-attested) |
|---|---|
| `farmHealth.why.healthyScans` | retention reports recent scans AND last scan healthy |
| `farmHealth.why.tasksCompleted` | ≥1 task completed in last 7 days |
| `farmHealth.why.goodWeather` | FarmRisk weather category = low |

No signal → empty array → the Why line renders nothing. The score
is never decorated with invented reasons
(`neverFabricatesReasons: true`, gate-locked).

## Risk model

FarmRisk composite (#140): Disease (predictive engine, folds pest
pressure) / Weather (covers heat) / Water (soil composite, real
SoilGrids only) / Market. Max-severity-wins; `unknown` never
raises; chips render only known levels. Heat risk maps into the
weather channel — honest mapping note rather than a duplicate
engine.

## Confidence engine

- Action confidence: DailyAction envelope 0-100, rendered when
  0 < c < 100 (100 suppressed — no certainty claims).
- Brief confidence: signals-counted (score + risks + contributors);
  ≥4 → high, ≥2 → medium, else low.
- Every recommendation carries reason (`why`) — Recommendation
  Engine contract since #172, now surface-gated.

## Follow-up + outcome loop (already shipped, re-asserted)

- Start → task created → follow-up at 3/7/14 days
  (`followUpEngine.FOLLOWUP_OFFSETS_DAYS`, gate-locked #168).
- Completion → "Did this help?" → improved / same / worse stored
  (`recordFollowUpOutcome`) → outcome history feeds the 10%
  weighting in the next recommendation.

## Admin analytics (already shipped)

`/internal/pilot-analytics` + `/admin/pilot-analytics` (#157/#189):
action completion %, outcome capture %, top actions; average farm
health + top risks visible through `__pilotMetrics()` +
`__farmRiskHealth()` composites on the founder/command dashboards.

---

## Build gates (new: check-digital-agronomist)

Fails build when:
- FarmHealthEngine missing any of the 4 brief fields or the
  neverFabricatesReasons declaration
- Deck missing health / why / sub-risks / action / confidence
  testids or the action reason
- **More than one** `cc-btn-start` primary action in the deck
- Home mounts the deck below the demoted section
- followUpEngine loses better/same/worse statuses
- This report deleted

## UI verification

Screenshot tooling unavailable in this environment (times out;
documented since #182). Verified instead by: dev-preview compile +
zero console errors (#192), 285 build:safe gates green, DOM
contract inspectable at runtime via the testids above.

## Acceptance tests

| # | Test | Expected | Verified by |
|---|---|---|---|
| 1 | Probes warm, healthy farm | Score + Why chips + risk chips + 1 action + confidence | testids + gate |
| 2 | No health probe | "Not enough data yet"; Why line hidden | engine null path |
| 3 | No positive signals | Why line absent — score never decorated | empty contributors |
| 4 | confidence=100 | line suppressed | deck guard |
| 5 | Start tapped | task + follow-up + outcome record chain | #173 wiring + check-scan-v3 §7 |
| 6 | Outcome recorded | better/same/worse stored, feeds next rec | followUpEngine gate |
| 7 | Second primary button added by future PR | build FAILS | gate exact-one rule |

## Success metrics (measured by pilot analytics #188/#189)

today_action_started% · today_action_completed% · task completion%
· outcome capture% · D7 retention — all flowing through
`farroway.pilotEvents` → `__pilotMetrics()`.
