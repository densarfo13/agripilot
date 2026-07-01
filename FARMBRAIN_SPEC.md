# FarmBrain Spec

FarmBrain is the single orchestration engine. **Only FarmBrain generates farmer recommendations** —
enforced by `check:single-brain` + `check:farmbrain-x` in build:safe.

## Contract
- **Consumes** (events): `farm_created`, `crop_added`, `scan_completed`, `task_completed`,
  `weather_update` (EVENT_CATALOG.md). Other domains (scan, weather, market, funding, timeline,
  enterprise) **publish data**; FarmBrain never reaches into their internals.
- **Produces**: one canonical `FarmBrainState` + ranked recommendations (≤3 surfaced) + Today's
  priority. Files: `src/runtime/farmBrain/FarmBrainStateEngine.ts`, `FarmBrainStateContracts.ts`;
  daily surface via `src/core/intelligence/dailyDecisionEngine.js` + `DecisionHero.jsx`.

## Honesty invariants (gate-enforced — do not weaken)
- Metrics with no live data source → **`no_live_feed`**, never faked (yield $, market, funding,
  buyers). `FarmBrainStateContracts.ts:46`.
- Recommendation impact is **qualitative** (`expectedBenefit: "Prevents yield loss."`) — **never a
  fabricated percentage** like "8% yield loss."
- Confidence is a **`low`/`medium`/`high` label**, never a fabricated numeric % — `check:no-fake-
  intelligence` fails the build otherwise.
- No fabricated ML — `check:v13-no-fake-ml`.
- The farmer never sees engineering wording — `check:ui-page-certification` (all 10 pages).

## Ranking
Recommendations rank by impact · urgency · confidence · cost · time · risk-reduction · farmer
preference, and never surface more than three. This logic lives in FarmBrain only; no domain
duplicates it.

## Extension rule
Add a new signal by having its domain **publish an event** FarmBrain consumes — never by adding a
second recommendation generator. That is the whole point of the single-brain gate.
