# PRODUCTION_CHECKLIST — Farroway v14

| Item | Status |
|---|---|
| Multi-agent advisor (12 agents) | ✅ live; 3 advise, 9 honest-decline |
| Every recommendation explainable (reason/evidence/confidence/alternative) | ✅ enforced by test |
| Never fabricate / never invent confidence | ✅ declining agents = confidence 0; gate-enforced |
| Unknown is valid | ✅ decline + null are first-class |
| Capability registry truthful | ✅ nothing predictive/market/banking marked live |
| Backward compatible / scan untouched | ✅ additive farmos14 namespace |
| 100% TypeScript (new modules) | ✅ |
| Test coverage (new modules) | ✅ 31 assertions |
| build:safe green | ✅ (+1 gate, +1 test) |

## Honest production ceiling
The truthful intelligence layer is production-ready. The capabilities marked
`requires_model` / `no_live_feed` / `requires_validation` / `requires_infra` become
real only with work that is NOT app code in a sprint: trained CV/disease/pest
models, a market data feed, a privacy-reviewed aggregation pipeline, the provider
keys + live pilot, and an infra/certification program.

**v14 names every gap precisely. The platform advances by lifting these with real
data — not by fabricating the difference.**
