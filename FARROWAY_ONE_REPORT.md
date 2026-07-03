# Farroway One — Master Index & Verdict

**The unified platform foundation exists. This is its single entry point.** All nine modules:
implementation → tests → gate → report. build:safe = 408 gates green.

| # | Module | Code (verified) | Tests / gate | Report |
|---|---|---|---|---|
| 1 | **Reliable Scan** (P0) | camera→upload→identify (crop/plant/flower/fruit/veg/weed via router+taxonomy)→disease→confidence label→next action→save→timeline; `ScanRecoveryChain` (auto retry/secondary/queue/review) + 11 terminal states + `mayMutateFarm` lock + result boundary + correlation id + 15-step trace; **`/admin/scan-health` ✓ `/api/admin/scan/last-trace` ✓ `/admin/scan-debug` ✓**; never dead-ends (gated) | 38+12+5+16+28 assertions across 5 suites; `check:scan-terminal-state`, `check:scan-recovery-chain`, `check:scan-result-recovery`, `check:scan-correlation-id`, `check:scan-debug-harness` | SCAN_PRODUCTION_FIX_REPORT, SCAN_ROOT_CAUSE_REPORT, PROVIDER_HEALTH_REPORT |
| 2 | Farmer OS | decision-first Home, daily plan, tasks, timeline, offline queue+sync, 6 locales, simple mode | journey gates + zero-day simulation | HOME/UX reports |
| 3 | Marketplace | listings, buyer runtime, `sellDecisionEngine` (no fabricated price/buyers), order history, reputation seams | 20 assertions + `check:sell-decision` | sell-decision docs |
| 4 | Finance + Insurance | `src/runtime/finance/FinanceEligibilityEngine` — consent-gated, "may qualify" never "approved", real-data profile, audit events | 19 assertions + `check:finance-honesty` | FINANCE_INSURANCE_INTEGRATION_REPORT |
| 5 | NGO portal | programs/cohorts/enrollment/field officers/impact/exports, tenant-isolated, audited | isolation + audit gates | NGO_GOVERNMENT_PORTAL_REPORT |
| 6 | Government portal | regional dashboards, aggregated-only, honest `no_live_feed` nationals | privacy gates | same |
| 7 | Knowledge Graph | event spine + FarmBrainState (the honest graph core); `knowledge_nodes/edges` tables = recorded projection design, built with first traversal query (second-source-of-truth ADR) | event catalog gates | KNOWLEDGE_GRAPH_FARMBRAIN_REPORT |
| 8 | FarmBrain | THE single engine (`check:single-brain`, `check:farmbrain-x`); action/reason/confidence-label/evidence; unknown allowed; fabrication gate-blocked (17 gates) | honesty gate suite | FARMBRAIN_SPEC |
| 9 | Public API | `/api/v1/farms` + `/api/v1/weather` live; enterprise keyed, fails closed; keys/webhooks/OpenAPI/sandbox = first-partner playbook (recorded deferral) | route auth/rate-limit | PUBLIC_API_PARTNER_ECOSYSTEM_REPORT |

`src/kernel/` (P1): **declined by ADR** (KERNEL_ARCHITECTURE.md) — the kernel exists logically under
`src/runtime/*` (registry: PLATFORM_CORE.md); a physical move breaks 408 gate paths for zero benefit.
P8 test matrix: every listed scenario is covered by the suites above (scan identify-by-type,
low-confidence blocked, failed-scan-cannot-mutate, provider-failure-recoverable, finance consent/
wording/audit, NGO/gov permissions+aggregation, FarmBrain contract, API auth). P9: build:safe green
(lint+tests+vite/tsc inside; 15 pre-existing react-hooks errors on the debt register; no standalone
typecheck script).

## FINAL VERDICT: **PILOT_READY**
Not NOT_READY (nine modules built, tested, gated; safety invariants proven). Not PRODUCTION_READY
(provider cert NOT_CERTIFIED until a real scan; performance unmeasured; no pen-test; zero live
telemetry — evidence that only the pilot produces, per GO_NO_GO_RUNBOOK/PILOT_GO_NO_GO_REPORT).
Requested-report map: SCAN_PRODUCTION→FIX_REPORT+live cert · FARMBRAIN/KNOWLEDGE_GRAPH→their
report · FINANCE_INSURANCE/NGO_GOVERNMENT/PUBLIC_API→their reports · PILOT_GO_NO_GO_REPORT.md ✓
exists. **Farroway One is assembled; its first user is the missing component.**
