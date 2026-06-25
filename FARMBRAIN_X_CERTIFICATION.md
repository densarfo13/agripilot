# FARMBRAIN_X_CERTIFICATION

**FarmBrain X — Agricultural Intelligence Runtime.** This certifies the 15
sections of the mission against what *truthfully* exists today. The verdict is
**computed** by `certifyFarmBrainX()` from the section statuses below — not
asserted. Live envelope: `window.__farmBrainXHealth()`.

The honest finding up front: **FarmBrain X is ~85% already built.** Most of these
sections shipped across prior sprints (and several this session). This sprint is
the certification + the one genuinely-additive contract change (§4), not 15 new
engines. And §12 of the spec — "never invent disease/yield/treatment/funding/
buyer/market price" — is the exact discipline already enforced.

## Single source of truth
`FarmBrainState` is the one canonical state every event updates and every screen
reads (RULE 1/2, shipped). The P0 ingestion gate ensures only strong scans
advance it. So "no screen owns intelligence" is **attestable**, not aspirational.

## Section certification

| # | Section | Status | Backed by |
|---|---|---|---|
| 1 | Agricultural Digital Twin | ✅ ready | FarmDigitalTwinRuntime + FarmBrainState |
| 2 | Universal Scan Engine | ◑ partial | AgriculturalObjectClassifier + ScanTypeRouter |
| 3 | Multi-Provider Consensus | ◑ partial | ScanAcceptanceGate (only Plant.id keyed) |
| 4 | Recommendation Engine | ✅ ready | FarmBrainState.Recommendation (+cost/risk/nextReview) |
| 5 | Agricultural Memory | ✅ ready | FarmScanMemory + OutcomeEngine + FarmTimeline |
| 6 | Season Engine | ✅ ready | cropLifecycleEngine + SeasonContext + cropSeasonality |
| 7 | Market Engine | ⊘ honest_null | FarmBrainState.marketReadiness — **no live feed** |
| 8 | Funding Engine | ⊘ honest_null | FarmBrainState.fundingEligibility — **no live feed** |
| 9 | Weather Engine | ✅ ready | useLiveWeather + WeatherDecisionCard (impact-explained) |
| 10 | Farm Health Score | ✅ ready | FarmHealthScoreEngine + FarmBrainState.farmHealth |
| 11 | Offline-First | ✅ ready | OFFLINE_SHELL_V1 + farmSync |
| 12 | Trust & Safety | ✅ ready | ScanTrustGate + FarmBrainScanIngestion |
| 13 | Performance | ◑ partial | perf-budget + bundle-budget gates (live timing not measured here) |
| 14 | Observability | ✅ ready | SCAN_OBSERVABILITY/ANALYTICS + ScanCreditMonitor |
| 15 | Pilot Acceptance | ◑ partial | routing test green; live 30-scan run PENDING |

**Counts:** 9 ready · 4 partial · 2 honest_null · 0 missing.

## What is deliberately NOT certified ready (and why)
- **Market (7) + Funding (8)** — no live price/buyer/grants feed exists. Per §12
  these stay `honest_null` (FarmBrainState returns `no_live_feed`), not faked.
- **Consensus (3)** — only Plant.id is keyed; Crop.health + Insect.id report
  not-ready. No multi-provider "consensus" is fabricated from one provider.
- **Pilot Acceptance (15)** — the routing acceptance is green (34 + 11 + 34
  assertions across the scan tests), but the live **30-scan / 10-crop / 5-fruit
  / 5-flower / 5-insect** run + farmer-satisfaction measurement cannot be
  executed from the build environment. The harness exists; the run is the
  operator's.
- **Universal Scan (2)** — weed / disease / irrigation-equipment are not yet
  object classes (named gap, not silently dropped).

## §15 measures — status
| Measure | Status |
|---|---|
| Identification accuracy | pending live 30-scan run (Plant.id keyed; others not) |
| Recommendation usefulness | instrumented (rec acceptance in observability); needs pilot data |
| Task completion | tracked (FarmBrain task_completed events) |
| Farmer satisfaction | not yet collected (needs pilot) |

## Final verdict: **LIMITED PILOT**

Computed, with reasons:
- multi-provider consensus partial (only Plant.id keyed)
- live 30-scan pilot acceptance pending
- market engine honest_null (no live feed)
- funding engine honest_null (no live feed)

**Path to the next tiers (the verdict moves automatically as reality changes):**
- **READY FOR 100 FARMERS** ⇐ set `CROP_HEALTH_API_KEY` + `INSECT_ID_API_KEY` on
  Railway (consensus → ready) **and** run the live 30-scan acceptance (§15) to a
  pass (pilot → ready).
- **READY FOR SCALE** ⇐ additionally connect a live market-price feed and a live
  funding/grants feed (market + funding → ready).

The core intelligence runtime — twin, scan, classification, recommendation,
memory, season, weather, health score, offline, trust, observability — is built
and gated. The blockers are **data feeds + a live validation run**, not code, and
FarmBrain reports each honestly rather than pretending.
