# Farroway V8 — Post-V7 Platform Layer (Report)

V8 adds the next production-safe layer on top of V7 — **additive, read-only**,
over existing pilot data. Protected flows (login, home, scan, upload, camera,
tasks, activity, language, offline, invites, NGO/buyer foundations) are
untouched and never blocked.

> Every farmer-facing output carries: **"Decision support, not a guarantee."**

---

## 1. Architecture summary
Seven pure, self-contained engines + a composite. Each is a read-only
composition over existing `window.__*Health()` probes and on-device
localStorage — no project imports (build-safe), no network calls, no
fabrication, honest "Not enough data yet" fallbacks.

| Module | Engine | Global |
|--------|--------|--------|
| Regional intelligence | `v8/regional/RegionalIntelligenceEngine.ts` | `__regionalIntelligenceHealth` |
| Digital farm twin | `v8/farmTwin/FarmTwinEngine.ts` | `__farmTwinHealth` |
| Voice assistant readiness | `v8/voice/VoiceAssistantReadiness.ts` | `__voiceAssistantHealth` |
| NGO enterprise program | `v8/ngoEnterprise/NGOEnterpriseEngine.ts` | `__ngoEnterpriseHealth` |
| Supply chain intelligence | `v8/supplyChain/SupplyChainIntelligenceEngine.ts` | `__supplyChainHealth` |
| Satellite/soil readiness | `v8/remoteSensing/RemoteSensingReadinessEngine.ts` | `__remoteSensingReadinessHealth` |
| Institutional data readiness | `v8/institutionalData/InstitutionalDataReadiness.ts` | `__institutionalDataHealth` |
| Composite | `v8/V8HealthRuntime.ts` | `__v8Health`, `__v8OODAHealth`, `__v8ArtifactHealth` |

## 2. Files created
7 engines + `V8HealthRuntime.ts`; `src/pages/internal/V8CommandCenterPage.jsx`
(`/internal/v8`); 7 gates `scripts/check-v8-*.mjs`; `docs/V8_ACCEPTANCE_TEST.md`,
`docs/V8_PLATFORM_REPORT.md`.

## 3. Files modified
`src/App.jsx` (boot installs in try/catch, composite last; lazy import + admin
route `/internal/v8`); `package.json` (7 gates wired into `build:safe`).

## 4. Regional intelligence
`{ region, crop, diseaseRisk, pestRisk, weatherRisk, outbreakSignal,
confidence, dataPoints, explanation, limitations }`. Requires
`MIN_REGIONAL_DATA_POINTS = 5` before showing risk; below that → all
`unknown` + "Not enough regional data yet". `outbreakSignal` is `emerging`
only with many corroborating recent same-disease/pest detections — never a
fake outbreak.

## 5. Farm twin
Digital reflection of REAL stored data: `farmTimelineReady, cropHistoryReady,
scanHistoryReady, taskHistoryReady, outcomeHistoryReady, weatherContextReady,
buyerReadinessContextReady` (true only when the data exists) + counts. No
generated history; missing data shown honestly.

## 6. Voice readiness
`{ selectedLanguage, voiceAvailable, fallbackVoice, lowLiteracyPromptsReady,
nativeVoiceConfigured, perLanguage, limitations }` for en/tw/ha/fr/sw/hi.
Native voice detected from the real `speechSynthesis` engine — never claims a
native Twi/Hausa voice that isn't configured; fallback is disclosed; voice
follows the selected language.

## 7. NGO enterprise
Org-scoped cohorts/communities/villages, field-officer workload, intervention
progress, evidence completion, donor-report readiness, program-risk-map
readiness. `organizationScoped:true`, `crossTenantLeakage:false`, no PII, no
fake metrics. Donor report is `ready` only when real evidence exists.

## 8. Supply chain
`{ listingFreshness, harvestWindowReadiness, supplyReadiness,
buyerMatchReadiness, logisticsReadiness('not_configured'), trustStatus }`.
Buyer sees no private farmer demographics or scan detail; no fake demand; no
price prediction without real market data.

## 9. Remote sensing readiness
`{ sentinelHubReady, soilDataReady, farmBoundaryReady, gpsAvailable,
weatherProviderReady, ndviCanRun, moistureCanRun, activeRemotePrediction:false }`.
Env-only provider detection; no NDVI/soil claim without real provider data; not
a blocker for the grower pilot.

## 10. Institutional data readiness
`{ eventLogReady, warehouseReady, analyticsExportReady, modelRegistryReady,
featureStoreReady, auditRetentionReady, backupRestoreReady, monitoringReady,
limitations }` — each ready only if a real probe reports ready; warehouse/model
registry/feature store honestly "not configured yet" until built.

## 11. OODA integration (`__v8OODAHealth`)
observe (farm twin/regional/NGO cohort/buyer supply/remote readiness) → orient
(farm/regional/program risk, buyer readiness) → decide (daily action/follow-up
scan/field-officer priority/buyer trust) → act (task suggestion/notify officer/
update buyer readiness/create artifact). `nonBlocking:true`,
`growerSafeOutput:true` — never blocks scan/upload/login; if a V8 signal is
unavailable the normal flow continues.

## 12. Artifact integration (`__v8ArtifactHealth`)
7 events (RegionalRiskSnapshot, FarmTwinSnapshot, VoiceReadinessChecked,
NGOEnterpriseSnapshot, SupplyChainReadinessCalculated,
RemoteSensingReadinessChecked, InstitutionalDataReadinessChecked) via
ArtifactRuntime only; `artifactRuntimeOnly:true`, `idempotencyKeysRequired:true`,
`offlineSafe`. Engines never write directly.

## 13. Governance checks added (all in `build:safe`)
`check-v8-no-fake-regional-intelligence`, `check-v8-farm-twin-real-data`,
`check-v8-voice-honesty`, `check-v8-ngo-tenant-isolation`,
`check-v8-buyer-privacy`, `check-v8-remote-sensing-claims`,
`check-v8-ooda-artifacts` — all PASS.

## 14. Build results
See build log / commit. `build:safe` runs all gates + vite build.

## 15. Final V8 verdict
`window.__v8Health().verdict` ∈ `PILOT_READY | PROGRAM_READY |
INSTITUTIONAL_READY | NEEDS_DATA | BLOCKED`. It reports **NEEDS_DATA** honestly
while modules are wired but pilots have not accumulated scans/records, and
climbs the institutional ladder only as real institutional probes report ready.

## 16. Remaining data/operational gaps
Surfaced live in `__v8Health().blockers/.warnings` and on `/internal/v8`:
modules at "Not enough data yet" until pilot data accrues; warehouse / model
registry / feature store not configured yet (by design — no premature build);
remote sensing remains readiness-only until a real Sentinel/SoilGrids
integration fetches and stores data. No fabricated readiness is ever reported.
