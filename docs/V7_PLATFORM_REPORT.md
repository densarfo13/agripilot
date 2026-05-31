# Farroway V7 — Institutional Agricultural Intelligence Platform (Report §13)

V7 upgrades Farroway from a V1 decision-support app to an institutional
intelligence platform — **additively** and **read-only**, over the existing
pilot data. None of the protected flows (Login, Home, Scan, Upload, Camera,
Tasks, Activity, Language, Offline, Invites, NGO/Buyer foundations) are
touched or blocked.

> Every farmer-facing output carries: **"Decision support, not a guarantee."**

---

## 1. Architecture summary

V7 = six pure, self-contained engines + a composite, each a read-only
composition over existing `window.__*Health()` probes and on-device
localStorage. No engine imports a project module (so the build cannot break
from a bad path), none call the network, none fabricate data, and all
degrade honestly to "Not enough data yet".

| Module | Engine | Global |
|--------|--------|--------|
| V2 Predictive | `predictive/PredictiveRiskEngine.ts` | `__predictiveHealth` |
| V3 NGO intelligence | `ngo/NGOIntelligenceEngine.ts` | `__ngoIntelligenceHealth` |
| V4 Marketplace | `marketplace/MarketplaceIntelligenceEngine.ts` | `__marketplaceIntelligenceHealth` |
| V5 Satellite + soil | `remote/RemoteSensingEngine.ts` | `__remoteSensingHealth` |
| V6 Voice + assistant | `assistant/FarmAssistantEngine.ts` | `__farmAssistantHealth` |
| V7 Institutional | `institutional/InstitutionalReadinessEngine.ts` | `__institutionalReadinessHealth` |
| Composite | `V7HealthRuntime.ts` | `__v7Health`, `__v7OODAHealth`, `__v7ArtifactHealth` |

## 2. Files created
- `src/runtime/v7/predictive/PredictiveRiskEngine.ts`
- `src/runtime/v7/ngo/NGOIntelligenceEngine.ts`
- `src/runtime/v7/marketplace/MarketplaceIntelligenceEngine.ts`
- `src/runtime/v7/remote/RemoteSensingEngine.ts`
- `src/runtime/v7/assistant/FarmAssistantEngine.ts`
- `src/runtime/v7/institutional/InstitutionalReadinessEngine.ts`
- `src/runtime/v7/V7HealthRuntime.ts`
- `src/pages/internal/V7CommandCenterPage.jsx` (`/internal/v7`)
- `src/pages/internal/NGOIntelligencePage.jsx` (`/internal/ngo-intelligence`)
- `scripts/check-v7-no-fake-intelligence.mjs`
- `scripts/check-v7-ooda-safety.mjs`
- `scripts/check-v7-artifacts.mjs`
- `scripts/check-v7-tenant-isolation.mjs`
- `scripts/check-v7-remote-sensing-claims.mjs`
- `scripts/check-v7-assistant-safety.mjs`
- `docs/V7_ACCEPTANCE_TEST.md`, `docs/V7_PLATFORM_REPORT.md`

## 3. Files modified
- `src/App.jsx` — boot installs for the 6 engines + composite (each in its
  own try/catch, composite last, never blocks boot); lazy imports + admin
  routes `/internal/v7` and `/internal/ngo-intelligence`.
- `package.json` — 6 new gate scripts wired into `build:safe`.

## 4. Predictive intelligence
Outputs **risk categories only** — `diseaseRisk`, `pestRisk`, `weatherRisk`,
`cropStressRisk`, each `low|elevated|high|unknown` — derived from scan
history, weather, trend, severity, tasks, outcomes. No exact yield, no
revenue. `'unknown'` + "Not enough data yet" when signals are absent.

## 5. NGO intelligence
Org-scoped metrics (farmers enrolled/active, scans, tasks, outcomes, disease/
pest clusters, high-risk farms, field-officer workload, program impact) from
org-scoped probes + on-device aggregation. `organizationScoped:true`,
`crossTenantLeakage:false`, zero PII. `/internal/ngo-intelligence`.

## 6. Marketplace intelligence
Harvest readiness, listing quality, buyer-match/distance/freshness scores,
trust status — coarse, non-identifying signals only. **No payments, no
escrow, no fabricated buyer demand**, and **no private farmer scan detail**
(no disease/pest/severity/PII) is ever exposed to a buyer.

## 7. Remote sensing
NDVI / vegetation-stress / soil / rainfall-anomaly / drought **readiness**
only. `activePredictionEnabled:false` and "Not enough remote data yet"
unless real provider data has been fetched and stored. Provider config is
detected from build-time env flags; **no live fetch, no fabricated NDVI**.

## 8. Farm assistant
Daily `{ greeting, topPriority, top3Actions(≤3), riskSummary, followUpNeeded,
voiceReady, language }`. Low-literacy, localized greetings (en/fr/sw/tw/ha/hi
with English fallback — no invented agronomy terms), gentle wording (no scary
language), no chemical dosage, voice follows the selected language and
discloses a fallback when native voice is unavailable.

## 9. Institutional readiness
Composes tenant isolation / audit / artifacts / RBAC / persistence / offline
sync / data export / compliance / monitoring / backup. Verdict `PILOT_READY |
PROGRAM_READY | INSTITUTIONAL_READY | NOT_READY` — cannot reach
INSTITUTIONAL_READY unless the critical set (isolation, audit, RBAC,
persistence) is ready. Absent probe → warning/blocker, never a fake pass.

## 10. OODA integration
`__v7OODAHealth()` reports observe/orient/decide/act readiness over the real
probes (scans/weather/tasks/outcomes/NGO/buyer/remote → orient via crop
stage/risk/trend/farm score → decide daily priority/follow-up → act via
artifact + assistant). `nonBlocking:true`, `growerSafeOutput:true`. Gate
`check-v7-ooda-safety` enforces that no scan-render component imports
runtime/v7.

## 11. Artifact integration
`__v7ArtifactHealth()` declares the 6 events (PredictiveRiskCalculated,
FarmAssistantRecommendationCreated, NGOImpactSnapshotGenerated,
MarketplaceTrustCalculated, RemoteSensingSnapshotCreated,
InstitutionalReadinessChecked), `artifactRuntimeOnly:true`,
`idempotencyKeysRequired:true`, `offlineSafe`. Engines never write directly.

## 12. Governance checks added
`check-v7-no-fake-intelligence`, `check-v7-ooda-safety`, `check-v7-artifacts`,
`check-v7-tenant-isolation`, `check-v7-remote-sensing-claims`,
`check-v7-assistant-safety` — all wired into `build:safe`.

## 13. Build results
See the build log / commit. `build:safe` runs all gates + vite build.

## 14. Final V7 verdict
`window.__v7Health().verdict` reflects the institutional readiness ladder and
is honest about thin data — it will read `PILOT_READY` / `NOT_READY` until
real institutional probes (persistence, audit, isolation, RBAC) report ready
in the running environment. The platform is **wired, explainable, and safe**.

## 15. Remaining blockers
Surfaced live in `window.__v7Health().blockers` / `.warnings` and on
`/internal/v7`. Typical at this stage: modules showing "Not enough data yet"
until pilots accumulate scans/tasks/outcomes; institutional checks that
depend on server-side persistence/audit being fully attested in production.
No fabricated readiness is ever reported.
