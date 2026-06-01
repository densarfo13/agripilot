# Farroway Post-Scan Intelligence Production Fix

Builds the layer AFTER scan detection — outcome learning, farm digital twin,
regional intelligence, scan risk scoring, NGO reporting — without
destabilizing Scan. All runtimes are pure, read-only, composition-only,
explainable, honest (NEEDS_DATA), and never block the scan render. No
wave-36-protected runtime touched (Scan risk scoring lives in
`src/runtime/scanRisk/`, NOT the protected `src/runtime/scan/`).

> Decision support, not a guarantee. No fabricated intelligence, no fake
> outbreaks, no exact yield, no private farmer data exposed.

---

## 1. Files created
- `src/runtime/intelligence/outcomes/OutcomeLearningLoop.ts` → `__outcomeLearningLoopHealth`
- `src/runtime/intelligence/farmTwin/FarmDigitalTwinRuntime.ts` → `__farmDigitalTwinHealth`
- `src/runtime/intelligence/regional/RegionalIntelligenceRuntime.ts` → `__regionalIntelligenceReadiness`
- `src/runtime/scanRisk/ScanRiskScoringRuntime.ts` → `__scanRiskScoringHealth` (+ `scoreScanRisk()`)
- `src/runtime/intelligence/ngo/NGOReportingHooks.ts` → `__ngoReportingHooksHealth`
- `src/runtime/intelligence/PostScanIntelligenceRuntime.ts` → `__postScanOODAHealth`, `__postScanArtifactHealth`
- 6 gates: `scripts/check-{outcome-learning-loop,farm-twin-real-data,regional-intelligence-thresholds,scan-risk-scoring-safety,ngo-reporting-privacy,post-scan-ooda-artifacts}.mjs`
- `docs/POST_SCAN_INTELLIGENCE.md`

## 2. Files modified
- `src/App.jsx` — boot installs for the 5 runtimes + composite (each try/catch, composite last, never blocks boot).
- `package.json` — 6 gates wired into `build:safe`.

## 3. Outcome learning loop summary
Wires ScanCompleted → DiagnosisCreated → RecommendationCreated → TaskCreatedFromScan
→ TaskCompleted → FollowUpScanCompleted → OutcomeRecorded → snapshot, from the
canonical event log. Statuses IMPROVED/UNCHANGED/WORSENED/UNKNOWN.
`MIN_OUTCOME_SAMPLE = 5` — no improvement/effectiveness rate below it;
confidence only rises above 'low' when follow-up scans are linked AND sample ≥ 5;
NEEDS_DATA otherwise. No fake effectiveness.

## 4. Farm digital twin summary
`__farmDigitalTwinHealth` builds a real-data twin (farm/plants/scans/tasks/
outcomes/weather + coarse buyer readiness) with per-section readiness flags.
`noInventedHistory:true`, `tenantScoped:true`, `farmerId:null` (no PII); missing
fields are null / "Not enough data yet"; never exposes private data to buyers.

## 5. Regional intelligence summary
`__regionalIntelligenceReadiness` attests the regional contract over the
existing `__regionalIntelligenceHealth` (v8 risk signals) + `__regionalNetworkHealth`
(v13 multi-farm): requires **≥2 farms** and **≥10 scans** before any regional
signal, `anonymized:true`, `noFakeOutbreaks:true`, NEEDS_DATA below threshold —
never a single-farmer outbreak alert. (The canonical risk-signal probe was left
untouched to avoid destabilizing it.)

## 6. Scan risk scoring summary
`scoreScanRisk(detection)` → severity / spread / cropStage / weather /
yieldReadiness risk (LOW/MEDIUM/HIGH/UNKNOWN), actionUrgency
(TODAY/THIS_WEEK/MONITOR/UNKNOWN), overallRisk, with an explanation for every
score. **No exact yield, no revenue, no guaranteed outcome**; missing data → UNKNOWN.
`__scanRiskScoringHealth` reports readiness. Lives in `src/runtime/scanRisk/`.

## 7. NGO reporting hook summary
`__ngoReportingHooksHealth` aggregates **organization-scoped** counts
(farmers enrolled/active, scans, diagnosis counts, task completion, follow-ups,
outcomes, improving/unchanged/worsened, regional signals if threshold met).
`orgScoped:true`, `privacySafe:true`, `noFakeMetrics:true`; no cross-org leakage;
no private farmer detail; NEEDS_DATA honest.

## 8. OODA integration summary
`__postScanOODAHealth` → outcomeLoop/farmTwin/regional/riskScoring/ngoReporting
integrated, `nonBlocking:true`, `failureSafe:true`, `growerSafe`. Post-scan
intelligence composes AFTER the result; never blocks the scan render; failure is
non-fatal. Gate forbids any scan-render component importing the post-scan runtimes.

## 9. Artifact integration summary
`__postScanArtifactHealth` → 6 events (OutcomeLearningSnapshotCreated,
FarmTwinSnapshotCreated, RegionalRiskSignalCreated, ScanRiskScoreCalculated,
NGOImpactAggregateCreated, FollowUpOutcomeRequested) via ArtifactRuntime only,
`artifactRuntimeOnly:true`, `idempotent`, `offlineSafe`, `nonBlocking`.

## 10. Governance checks added (all in `build:safe`)
`check-outcome-learning-loop`, `check-farm-twin-real-data`,
`check-regional-intelligence-thresholds`, `check-scan-risk-scoring-safety`,
`check-ngo-reporting-privacy`, `check-post-scan-ooda-artifacts`.

## 11. Result UI
`ScanResultCard` is already gate-locked safe (safe wording Likely/Possible/Needs
review/Not enough data yet; no raw JSON; no confirmed/guaranteed/exact-yield;
has Save to My Plants / Create Task / Scan Again) — left unchanged to avoid any
risk to the live scan flow. Risk/next-action data is available to it via
`__scanRiskScoringHealth` + `scoreScanRisk()` for a future safe render.

## 12. Final production verdict
Post-scan intelligence is wired, explainable, honest, org-scoped, and
non-blocking. Scan safe-shell / iOS-camera / upload-primary are untouched.
Metrics report NEEDS_DATA until pilots accumulate the chain — by design. All
6 gates green in `build:safe`.
