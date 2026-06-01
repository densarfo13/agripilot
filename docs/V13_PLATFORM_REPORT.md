# Farroway V13 — Institutional Data Warehouse + MLOps + Outcome Learning (Report)

V13 adds institutional-scale **readiness** infrastructure — additive,
read-only, over existing pilot data. Protected flows (Scan, Upload, Login,
Home, Tasks, Activity, Language, Offline) are untouched and never blocked.
Nothing fakes ML, invents yield, fabricates outbreaks, or exposes private
farmer data.

> Every farmer-facing output carries: **"Decision support, not a guarantee."**

---

## 1. Architecture summary
Ten pure, self-contained readiness runtimes + a composite. Each composes
existing `window.__*Health()` probes + on-device localStorage — no deep
project imports (the event-sourcing cluster uses same-folder `./` siblings
only), no network calls, no fabrication, honest "Not enough data yet"
fallbacks, and explicit minimum-data guards before any signal.

| Capability | Runtime | Global |
|------------|---------|--------|
| Event sourcing | `v13/events/EventSourcingRuntime.ts` (+ EventContract / EventIdempotency / EventReplayReadiness) | `__eventSourcingHealth` |
| Outcome learning | `v13/outcomeLearning/OutcomeLearningRuntime.ts` | `__outcomeLearningHealth` |
| Regional network | `v13/regionalNetwork/RegionalNetworkRuntime.ts` | `__regionalNetworkHealth` |
| Voice-first readiness | `v13/voice/VoiceFirstReadinessRuntime.ts` | `__voiceFirstHealth` |
| Yield prediction readiness | `v13/yield/YieldPredictionReadinessRuntime.ts` | `__yieldPredictionReadinessHealth` |
| Data warehouse readiness | `v13/warehouse/DataWarehouseReadiness.ts` | `__warehouseHealth` |
| Feature store readiness | `v13/featureStore/FeatureStoreReadiness.ts` | `__featureStoreHealth` |
| Model registry readiness | `v13/modelRegistry/ModelRegistryReadiness.ts` | `__modelRegistryHealth` |
| Analytics exports | `v13/exports/AnalyticsExportRuntime.ts` | `__analyticsExportHealth` |
| Data governance | `v13/governance/DataGovernanceRuntime.ts` | `__v13GovernanceHealth` |
| Composite | `v13/V13HealthRuntime.ts` | `__v13Health`, `__v13OODAHealth`, `__v13ArtifactHealth` |

## 2. Files created
14 runtime files (10 runtimes + 3 event-cluster siblings + composite);
`src/pages/internal/V13CommandCenterPage.jsx` (`/internal/v13`); 10 gates
`scripts/check-v13-*.mjs`; `docs/V13_ACCEPTANCE_TEST.md`,
`docs/V13_PLATFORM_REPORT.md`.

## 3. Files modified
`src/App.jsx` (boot installs in try/catch, composite last; lazy import + admin
route `/internal/v13`); `package.json` (10 gates wired into `build:safe`).

## 4. Event sourcing
`EventContract` declares the 26 canonical events + `requiresOrgScope`.
`EventIdempotency` derives a deterministic key (FNV-1a, no random/clock).
`EventReplayReadiness` reports append-only/idempotency/replay readiness over
`farroway_event_log`. `__eventSourcingHealth` asserts `immutableAppendReady`,
`idempotencyRequired:true`, `tenantScopeRequired:true`, `noUIDirectWrites:true`,
lists all 26 events, and degrades honestly when empty.

## 5. Outcome learning
Chain Scan→Diagnosis→Recommendation→Task→Completion→Follow-up→Outcome with
values IMPROVED/UNCHANGED/WORSENED/UNKNOWN. `MIN_OUTCOME_SAMPLE = 5` — no rate
shown below it ("Not enough outcome data yet"). No treatment/medical/pesticide
overclaim; diagnosis/recommendation never invented.

## 6. Regional network
Disease/pest clusters + trend + region risk from real scans only.
`MIN_SCAN_COUNT = 10` AND `MIN_FARM_COUNT = 2`, with each signal requiring
≥2 distinct farms — a single device/farm can never raise a region signal
(no single-user outbreak). Honest "Not enough regional data yet".

## 7. Voice-first readiness
en/tw/ha/fr/sw/hi. Native voice detected from the real `speechSynthesis`
engine; `nativeVoiceAvailable`/`fallbackVoice` disclosed; never claims an
unconfigured native Twi/Hausa voice; voice follows the selected locale.

## 8. Yield prediction readiness
READINESS ONLY. `{ readyForYieldModel, cropCycleCount, harvestOutcomeCount,
requiredMinimumsMet, missingData[], recommendation }`. No tons/acre, no
revenue, no fake model output — `readyForYieldModel` true only when real
crop-cycle/harvest minimums are met (false at pilot stage, with missingData).

## 9. Warehouse readiness
`{ analyticsSchemaReady, eventExportReady, dailySnapshotReady,
anonymizationReady, tenantIsolationReady, externalWarehouseConfigured }`.
Export targets (Postgres analytics / BigQuery / Snowflake / S3·R2) are
readiness-only; external warehouse from env (off until configured). No PII.

## 10. Feature store readiness
10 feature groups (farmer_activity / plant_health / scan_quality / disease_
pressure / pest_pressure / weather_risk / task_completion / outcome / buyer_
trust / ngo_program). Readiness only — never emits a computed feature value;
each group ready only if its real source exists.

## 11. Model registry readiness
6 future models (plant_diagnosis_ranker, disease_risk_model, pest_risk_model,
yield_readiness_model, buyer_trust_model, ngo_impact_model). All
`approvedForProduction:false`, `productionApprovedCount:0` — no model is
production-approved without validated metrics; no hidden swaps.

## 12. Analytics exports
NGO program / Farmer activity / Outcome / Regional risk / Buyer trust / Audit
reports in CSV + JSON. `organizationScoped:true`, `privacyFiltered:true`,
`auditOnExport:true` — buyer report exposes only coarse trust signals, never
PII or scan detail.

## 13. Governance
`{ orgScopingReady, buyerPrivacyReady, fieldOfficerScopeReady,
adminAccessLoggingReady, consentChecksReady, exportPrivacyReady,
anonymizationReady, dataRetentionPolicyReady, verdict, blockers, warnings }` —
each mapped to a real probe; verdict READY only when the critical privacy/
scoping/audit set is ready; absent probe is never a fake pass.

## 14. OODA integration (`__v13OODAHealth`)
observe (events/outcomes/regional/warehouse/feature/model) → orient (data
sufficiency/confidence/risk/limitations) → decide (show / suppress / request
follow-up / alert officer) → act (task/recommendation/artifact/notify).
`nonBlocking:true`, `growerSafeOutput:true`, `canReturnNeedsData:true` — never
blocks scan/upload/login; can honestly return NEEDS_DATA.

## 15. Artifact integration (`__v13ArtifactHealth`)
10 events (EventSnapshotCreated, OutcomeLearningSnapshotCreated,
RegionalNetworkSnapshotCreated, VoiceReadinessChecked,
YieldPredictionReadinessChecked, WarehouseReadinessChecked,
FeatureStoreReadinessChecked, ModelRegistryReadinessChecked,
AnalyticsExportCreated, GovernanceCheckCompleted) via ArtifactRuntime only;
`artifactRuntimeOnly:true`, `idempotencyKeysRequired:true`, `offlineSafe`.

## 16. Governance checks added (all in `build:safe`, all PASS)
`check-v13-no-fake-ml`, `check-v13-event-sourcing`, `check-v13-outcome-learning`,
`check-v13-regional-network`, `check-v13-yield-safety`,
`check-v13-warehouse-privacy`, `check-v13-feature-store`,
`check-v13-model-registry`, `check-v13-tenant-isolation`,
`check-v13-ooda-artifacts`.

## 17. Build results
See build log / commit. `build:safe` runs all gates + vite build.

## 18. Final V13 verdict
`window.__v13Health().verdict` ∈ `PILOT_READY | PROGRAM_READY |
INSTITUTIONAL_READY | NEEDS_DATA | BLOCKED`. Honestly reports **NEEDS_DATA**
while runtimes are wired but pilots have not accumulated events/outcomes/scans,
climbing the ladder only as real data + governance readiness arrive.

## 19. Remaining data/operational gaps
Surfaced live in `__v13Health().blockers/.warnings` and `/internal/v13`:
warehouse/feature-store/model-registry are readiness-only until the actual
infrastructure is built; yield model not ready until crop-cycle/harvest data
accrues; regional signals suppressed until ≥2 farms + ≥10 scans; outcome rates
hidden below 5 samples. No fabricated readiness is ever reported.
