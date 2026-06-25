# FARROWAY X — The Agricultural Operating System

One question, every feature: **"What is the next best action for this farm today?"**
One Scan · One FarmBrain · One Daily Decision · One Timeline · One Source of Truth.
Every module reads FarmBrain; nothing calculates independently.

## The 15 engines (each maps to real code — gate-locked)
| # | Engine | Status | Backing |
|---|---|---|---|
| 1 | Universal Scanner | ◑ partial | `AgriculturalObjectClassifier` (weed/disease/equipment classes pending) |
| 2 | Provider Orchestrator | ✅ | `EnvironmentOrchestrator` + scan providers (retry/cache/circuit-breaker/health/degradation); Sentinel not integrated |
| 3 | FarmBrain | ✅ | `FarmBrainStateEngine` / `FarmBrainStateStore` (single source of truth) |
| 4 | Decision Engine | ✅ | `FarrowayDecisionEngine` (action/reason/confidence/evidence/urgency/time/benefit/cost/nextReview) |
| 5 | Evidence Engine | ✅ | `EvidenceEngine` (✓ lines; never fabricated) |
| 6 | Trust Engine | ✅ | `TrustScoreEngine` (High/Med/Low; raw math internal) |
| 7 | Outcome Engine | ✅ | decision feedback + `OutcomeEngine` (learns only from validated outcomes) |
| 8 | Digital Twin | ✅ | `FarmDigitalTwinRuntime` + FarmBrainState histories |
| 9 | Business Engine | ⊘ honest_null | no live market/funding feed — never fabricated (frozen) |
| 10 | Observability | ✅ | `scanObservability` + PilotAnalytics + `providerRuntimeStatus` |
| 11 | Safety | ✅ | `FarmBrainScanIngestion` + trust gate + no-fabrication doctrine |
| 12 | Offline | ✅ | `public/sw.js` (OFFLINE_SHELL_V1) + farmSync queue |
| 13 | Localization | ◑ partial | 6 locales; Hindi hidden until translated; locale-audit gate |
| 14 | Agronomist Review | ✅ | review-queue (low-confidence/review-only) via ScanTrustGate |
| 15 | Pilot Certification | ✅ | `PilotCertificationRuntime` + `EnterpriseCertificationRuntime` |

## Design invariants (gate-enforced)
- **No screen owns intelligence** — every screen reads FarmBrainState.
- **No fabrication** — disease/treatment/yield/soil-chem/funding/market are
  honest-null when there's no evidence; weak scans are held for review.
- **Provider failures never stop the platform** — graceful degradation, confidence down.
- **No farmer-facing jargon** — Recommended/Likely/Estimated/Detected, never API/AI/provider.
- **Readiness is measured, never assumed** — provider keys + accuracy at runtime.

## Final verdict: **READY FOR 10 FARMERS**
The OS is built, safe, and gated. A small **supervised pilot (10 farmers)** is the
correct next step — and the only way to earn 100 / 1,000 / global, which require
the field evidence + provider keys that cannot be produced from code. See
TECHNICAL_DEBT_REGISTER.md and ROADMAP_2026_2030.md.
