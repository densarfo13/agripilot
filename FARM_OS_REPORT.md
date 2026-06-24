# FARM_OS_REPORT.md

**Sprint #216 — Farm Operating System lockdown.** Date: 2026-06-19.

Goal: "smart app → daily OS for growers" without adding complexity.
Most of the spec already ships; built the 5 genuine deltas, declined
2 frozen/premature sections, reused 6 shipped engines.

## Built (5 composites — read-only, honest)

| § | Engine | What |
|---|---|---|
| 1 | `FarmLifecycleEngine` | 11 states (CREATED→INACTIVE); `canRecommend(state)` enforces "no state → no recommendation" |
| 2 | `TaskOrchestrator` | buckets deduped tasks → Today(1) / This Week(≤3) / Upcoming; never a 20-item list |
| 7 | `ExpertReviewEngine` | assign / comment / approve / reject / promote over the #214 review queue |
| 8 | `RecommendationTrustScore` | numeric 0-100 from REAL contributors (scan / photo / farm-history / region); satellite EXCLUDED (null) |
| 9 | `GrowerMemoryEngine` | preferred crops / language / common issues / task behavior (read-only, no PII) |

## Declined
- **§6 Satellite Correlation V1** — frozen (5th request). Even gated on
  gps+crop+date it needs the Sentinel integration the Do-Not-Build list
  bans + would fabricate without a provider. The #208 `SatelliteCorrelationEngine`
  stays `UNCONFIGURED` (gate-asserted). RecommendationTrustScore already
  treats satellite as null, so trust is honest without it.
- **§11 Scale Safety (Redis / queues / DLQ / rate-limit)** — premature
  infra. See PILOT_SCALE_READINESS_REPORT.md: a ~20-farm pilot has no
  load to protect; building queue workers + Redis now is speculative
  complexity the mission explicitly says to avoid. Deferred to >100 farms.

## Reused (already shipped — not rebuilt)
§3 MythosDecisionEngine → `DecisionTraceEngine` (#209) · §4 FarmHealthEngine
(#194) · §5 OutcomeTracker → OutcomePrompt/OutcomeChain (#198/#36) ·
§10 Pilot Cohort Analytics (#188) · §12 North-Star → PilotReadinessDashboard
(#215) · §13 Premortem (#213/#214/#215).

## Health globals
`__farmLifecycleHealth · __taskOrchestratorHealth · __recommendationTrustHealth
· __growerMemoryHealth · __expertReviewHealth`. Gate: `check:farm-os`.
