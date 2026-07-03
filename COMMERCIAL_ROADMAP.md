# Commercial Roadmap — the honest map from today's platform to the "world's agricultural OS"

One artifact instead of nine near-duplicates (Build Once). The requested docs map onto reality:

| Requested doc | Where it already lives |
|---|---|
| MASTER_ARCHITECTURE.md | PLATFORM_ARCHITECTURE.md + DOMAIN_MODEL.md (modular monolith, clean event seams, ADR) |
| AI_ENGINE.md | FARMBRAIN_SPEC.md — FarmBrain IS the unified engine; `check:single-brain` already forbids a second one |
| KNOWLEDGE_GRAPH.md | FarmBrainState (EVENT_CATALOG.md) — the canonical event→state layer IS the graph's honest core: farmer/farm/crop/scan/task/weather/market/timeline relationships update on every event |
| DIGITAL_TWIN.md | `src/runtime/farmos13/` (farm agent/twin namespace) + timeline replay + season history |
| MARKETPLACE.md | sellDecisionEngine + buyer runtime (honest verdicts; no fabricated price) |
| NGO_PLATFORM.md | NGO dashboards, field-officer views, tenant isolation, audits, invites, impact surfaces |
| GOVERNMENT_PLATFORM.md | enterprise/regional analytics surfaces; national dashboards honestly `no_live_feed` until a government data agreement exists |
| WORLD_CLASS_RELEASE_PLAN.md | GO_NO_GO_RUNBOOK.md + LAUNCH_COMMAND_CENTER.md — the automatic PILOT_READY→READY_FOR_1000→READY_FOR_COMMERCIAL ladder |

## The three honest categories every remaining item falls into

**1. Built (at the honest ceiling).** Single-brain orchestration, event-driven state, scan 2.0
breadth (router + universal taxonomy + health/stage/severity), soil (SoilGrids real API), command
center (`/internal` + founder OS + launch engine), multi-language voice/text/simple-mode/offline,
self-healing scan chain, correction-capture endpoint, NGO/enterprise platforms, 400+ gates.

**2. Gate-blocked fabrication — will not build.** Yield estimates, price prediction, "best selling
date", credit scores, insurance eligibility, satellite NDVI/NDRE alerts, and "10 AI modules" have no
data source or model behind them. FarmBrainState marks these `no_live_feed` — *never faked*;
`check:v13-no-fake-ml` + 17 honesty gates fail the build on fabricated intelligence. A farmer acting
on an invented price or yield number is the one harm this product is built to never cause.

**3. External — the actual roadmap.** Each unlock is a contract/key/artifact, not a sprint:
- **Pilot data (first, gates everything)** → real scans flip the provider cert; corrections train models
- **Market price feed** (commodity API/partner) → market engine goes live honestly
- **Satellite provider** (key + imagery contract) → NDVI/alerts become real
- **2nd identification provider key** → true provider failover + confidence routing
- **Trained CV/ML models** (from pilot correction data) → offline AI, yield/ripeness estimation
- **Financial partners** (bank/insurer) → credit/insurance products
- **Logistics partners** → truck matching/cold chain
- **Government data agreements** → national dashboards
- **Scale infra** (post-1,000 farmers) → extract domains along the documented seams

## Sequencing
Phase 0 (now): run the 100-farmer pilot — every later phase feeds on its data. Phase 1: market feed
+ 2nd provider + telemetry at volume → READY_FOR_1000. Phase 2: satellite + first trained model +
finance pilot → commercial. Phase 3: multi-country/currency + domain extraction at real scale.

**The platform is one unified system already** — single brain, one event spine, one state layer,
gate-enforced. What makes it the "world's agricultural OS" is not another spec; it is real data
flowing through it.
