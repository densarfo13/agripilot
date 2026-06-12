# FARM_HEALTH_REPORT.md

**Sprint #193 — Farm Health Score + Daily Brief.**
Date: 2026-06-13
Surface: top of Home, via CommandCenterDeck (mounted sprint #192).

In scope per spec: health score, disease/pest/water risk, today's
action + reason + confidence. Explicitly NOT built: marketplace,
satellite intelligence, yield prediction (all remain suppressed by
existing gates).

---

## Scoring model (as implemented — file:line cited)

### Farm Health Score (0–100)

- **Source:** `__farmHealthScoreHealth()` probe, read by
  `CommandCenterAggregator.ts:134-148`.
- **Inputs:** vegetation classifier (healthy / stressed / sparse)
  folded with drought risk from `useFarmHealth.js:58-96`
  (GET `/api/v2/satellite/farm-health`). Raw NDVI stays sealed
  from grower UI per the recommendation-engine rule
  (`useFarmHealth.js:29-31`).
- **Bands** (`CommandCenterAggregator.ts:41-46`):

| Score | Band | Label | Color |
|---|---|---|---|
| ≥ 75 | high | Healthy | `#1f6a3a` |
| 50–74 | medium | Watching | `#9a6a00` |
| < 50 | low | Needs attention | `#a13a3a` |
| null | unknown | "Not enough data yet" | neutral |

- **Honesty rule:** when the probe returns no score, the tile reads
  "Not enough data yet" — never a fabricated number.

### Risk model

`__farmRiskHealth()` (`FarmRiskRuntime.ts`) composes four sub-risks:

| Sub-risk | Source probe | Extraction | File:line |
|---|---|---|---|
| **Weather** | `__weatherRiskHealth` | `.weatherRisk` / `.riskLevel` → low/medium/high | FarmRiskRuntime.ts:85-96 |
| **Disease** | `__predictiveHealth` | `.diseaseRisk` / `.predictedRisk` | FarmRiskRuntime.ts:98-109 |
| **Water (soil)** | `__soilIntelligenceHealth` | real risk only when `soilGridsConfigured=true`, else `unknown` | FarmRiskRuntime.ts:111-131 |
| **Market** | `__marketIntelligenceCompositeHealth` | demand INVERTED (high demand → low risk) | FarmRiskRuntime.ts:133-166 |

- **Aggregation** (`FarmRiskRuntime.ts:168-183`): max of present
  categories wins; `unknown` never raises the overall level. Any
  `high` → overall high; else any `medium` → medium; all unknown
  → unknown.
- **Composite confidence** (`FarmRiskRuntime.ts:197`): ≥3 categories
  present → high; ≥1 → medium; 0 → low.

**Spec mapping note (honest):** the spec asks for Disease / Pest /
Water. The composite provides Disease (predictive engine, which
folds pest-pressure signals from the regional provider §#168) +
Weather + Soil-as-Water + Market. A standalone Pest sub-risk
channel is not yet split out of `__predictiveHealth` — the chips
render exactly what the composite computes, labeled Disease /
Weather / Water / Market. Splitting pest into its own channel is a
follow-up if pilot feedback wants it.

### Today's Action (Daily Brief)

- **Source:** `fetchDailyAction()` → RecommendationEngine
  (`RecommendationEngine.ts:16-32`), envelope:
  `{ actionId, action, category, priority, estimatedMinutes,
     followUpDate, why, confidence (0-100) }`
- **Weights** (Recommendation Engine V1, sprint #172): 40% scan
  urgency / 30% weather window / 20% lifecycle stage / 10% outcome
  history; exactly ONE action returned per the gate-locked contract.
- **Inputs flowing in:** crop + planting date (farm profile),
  weather (`useLiveWeather`), scan results (scan history /
  retention events), task completion (taskActions ledger),
  outcome history (OutcomeTracker).

---

## What shipped this sprint (UI delta)

`src/components/commandCenter/CommandCenterDeck.jsx`:

1. **Sub-risk chips row** (`data-testid="cc-sub-risks"`) — below
   the tile row, one chip per composite category that reports a
   level: `Disease: low · Weather: medium · Water: unknown-omitted
   · Market: low`. Inverted color band (high risk = red), matching
   the Risk tile. Categories at `unknown` are omitted, not faked.
2. **Confidence line** (`data-testid="cc-action-confidence"`) —
   under Today's Action when the envelope carries a numeric
   confidence in (0, 100). Renders "Confidence: 84%". Values of
   100 are suppressed — banned-wording gates forbid certainty
   claims.

Both additions are inside the deck's existing error boundary —
failures render nothing, never block Home.

## UI verification

Screenshots are not capturable in this environment (preview
screenshot times out; documented since sprint #182). Verification
instead by:
- Live preview: `/home` compiles + renders with zero console
  errors and no Vite overlay.
- Static gates: all build:safe gates green including
  `check-command-center`, `check-command-center-production`,
  `check-single-brain`.
- The deck DOM contract is inspectable at runtime:
  `document.querySelector('[data-testid="cc-sub-risks"]')`.

---

## Acceptance tests

| # | Test | Expected | How verified |
|---|---|---|---|
| 1 | Health tile with score present | "Healthy/Watching/Needs attention" + N/100 | gate `check-command-center` + tile band math above |
| 2 | Health tile with NO probe data | "Not enough data yet", neutral band | aggregator null path (Aggregator.ts:134-148) |
| 3 | Sub-risk chips with ≥1 category present | chips render with level + inverted color | `cc-sub-risks` testid + runtime read of `__farmRiskHealth` |
| 4 | All categories unknown | chips row hidden entirely (no fake levels) | `subRisks.length === 0` guard |
| 5 | Today's Action with confidence 84 | "Confidence: 84%" line renders | `cc-action-confidence` testid |
| 6 | Confidence 100 or absent | line hidden (no certainty claims) | `c > 0 && c < 100` guard |
| 7 | `__farmRiskHealth` global missing (boot race) | chips hidden, deck unaffected | `typeof fn !== 'function'` guard |
| 8 | Deck failure of any kind | renders nothing; Home unaffected | class error boundary (Deck lines 183-191) |

---

## Verdict

Farm Health Score + Daily Brief live at the top of Home: score
(0-100, banded), sub-risk breakout (disease/weather/water/market),
one personalized action with reason + time + confidence. Every
number traces to a real engine; every missing input renders an
honest empty state.
