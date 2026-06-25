# TRUST_ENGINE_REPORT — Phase 2

`TrustScoreEngine.scoreTrust()` calculates recommendation trust from seven
signals — scan quality, provider agreement, farm history, weather quality, soil
freshness, task completion, outcome history — and exposes only a **High / Medium /
Low** band to the farmer (the raw score stays internal).

Honest by construction:
- A **missing** signal is not counted (it can't inflate trust); fewer signals →
  lower effective trust (coverage penalty).
- **No** signals → LOW (never high-by-default).
- A single weak signal is never HIGH.
- The weakest factor is reported for transparency; the farmer-facing reason
  suggests another photo when trust is Low. `__trustScoreHealth()`.

## Decision consensus (Phase 3 — already enforced)
Conflicting evidence lowers confidence (DecisionQualityEngine rejects
contradictions); missing evidence lowers confidence (Evidence + Trust coverage
penalty); weak evidence cannot produce a strong recommendation (ingestion gate +
≥70% rule). FarmBrain merges; provider failures never stop it.
