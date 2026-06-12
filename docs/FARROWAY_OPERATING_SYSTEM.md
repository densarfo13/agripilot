# Farroway Operating System Layer

A unified operating system for farmers, gardeners, NGOs, cooperatives, buyers,
agribusinesses, and governments. **No new AI** — this wave builds the
operational foundation's single pane of glass: the unified
`window.__farrowayHealth()` composite over all subsystems + the one missing
subsystem (Funding). Every subsystem already existed; this layer unifies and
governs them.

---

## 1. Files created
- `src/runtime/os/FarrowayHealthRuntime.ts` — `window.__farrowayHealth()`
  unified OS health composite (10 subsystem flags + governance + verdict).
- `src/runtime/funding/FundingRuntime.ts` — `window.__fundingHealth()`
  funding subsystem (opportunities / applications / awards / history).
- `scripts/check-operating-system.mjs` — governance gate.
- `docs/FARROWAY_OPERATING_SYSTEM.md`.

## 2. Files modified
- `src/App.jsx` — boot-install Funding + the OS composite (composite last;
  try/catch; never blocks boot).
- `package.json` — `check:operating-system` wired into `build:safe`.

## 3. Operating system architecture
One composite (`__farrowayHealth`) rolls up the operational subsystems — each
of which already exists as a pure, read-only, artifact-backed runtime:

| OS subsystem | Backing runtime | Probe |
|--------------|-----------------|-------|
| Unified Timeline (event sourcing) | `v13/events/EventSourcingRuntime` | `__eventSourcingHealth` |
| Farm Digital Twin | `v8/farmTwin/FarmTwinEngine` | `__farmTwinHealth` |
| Decision Engine | `intelligence/DailyDecisionEngine` + `intelligenceLoop` | `__dailyDecisionHealth` |
| Outcome | `pilot/PilotHealthRuntime` + `OutcomeLearningRuntime` | `__outcomeCaptureHealth` |
| Marketplace | `v8/supplyChain` + `MarketplaceIntelligenceEngine` + `BuyerTrustRuntime` | `__marketplaceIntelligenceHealth` |
| Funding | **`funding/FundingRuntime` (new)** | `__fundingHealth` |
| Program (NGO/coop/gov) | `v8/ngoEnterprise/NGOEnterpriseEngine` | `__ngoEnterpriseHealth` |
| Voice | `v13/voice/VoiceFirstReadinessRuntime` | `__voiceFirstHealth` |
| Localization | `i18n/LanguageHealthRuntime` + `translateEntityLabel` | `__languageHealth` |
| Performance | `performance/PerformanceHealthRuntime` | `__performanceHealth` |

`__farrowayHealth()` → `{ scanReady, farmTwinReady, decisionReady,
outcomeReady, marketplaceReady, fundingReady, ngoReady, voiceReady,
localizationReady, performanceReady, governance{eventSourced, artifactBacked,
noDirectWrites}, readyCount, verdict }`. Verdict READY / NEEDS_DATA / BLOCKED.

## 4. Event model
Append-only, immutable, idempotent, artifact-backed event log (V13 event
sourcing). Canonical events incl. FarmCreated, PlantCreated, ScanCompleted,
TaskCompleted, OutcomeRecorded, plus FundingApplied / GrantApproved /
ProduceListed / BuyerInterested surfaced through the same log. No direct
writes — everything flows through ArtifactRuntime / the event log.

## 5. Farm twin architecture
`FarmTwinEngine` (`__farmTwinHealth`) reflects real farm/plants/tasks/scans/
weather/outcomes and exposes a FarmSnapshot (farm health, active plants,
active tasks, risk level, readiness, confidence) — honest, no invented history.

## 6. Decision engine architecture
`DailyDecisionEngine` (`__dailyDecisionHealth`, max-3 grounded actions) +
the OODA decide phase produce a NextBestAction (scan plant / water crop /
inspect pest / prepare harvest) from scan + weather + tasks + outcomes + farm
twin. Decision support only — no fabricated certainty.

## 7. NGO / Program architecture
`NGOEnterpriseEngine` (`__ngoEnterpriseHealth`, org-scoped, no cross-tenant
leakage) covers NGOs / cooperatives / government programs — enrollment,
adoption, outcomes, retention, impact — with privacy-filtered grant export
(`AnalyticsExportRuntime`).

## 8. Marketplace architecture
`SupplyChainIntelligenceEngine` + `MarketplaceIntelligenceEngine` +
`BuyerTrustRuntime` + `HarvestReadinessRuntime` — produce listings, buyer
matching, harvest readiness, buyer interest. **No payments.** Buyers never see
private farmer data.

## 9. Funding architecture (new)
`FundingRuntime` (`__fundingHealth`) tracks grant opportunities, applications,
awards, and farmer funding history from the real event log + on-device stores.
Honest NEEDS_DATA until funding activity exists; never fabricates awards.

## 10. Go-live readiness
`__farrowayHealth().verdict` is **READY** once the core subsystems (scan, farm
twin, decision, outcome, localization) are wired and the foundation is
event-sourced + artifact-backed — otherwise **NEEDS_DATA** (wired but data
still settling) or **BLOCKED** (a real wiring failure). At pilot start it
reports NEEDS_DATA on the data-dependent subsystems by design; all engineering
is in place. Locked by `check-operating-system` in `build:safe`. No new AI;
no payments; no fabricated metrics; governance event-sourced + artifact-backed.

## 11. Post-OS additions (sprints #188–#194, June 2026)

Layers added on top of the OS foundation after this doc's original
wave — each follows the same composite-over-existing pattern:

| Addition | Probe | Sprint |
|---|---|---|
| Pilot analytics write-side (24-event contract, privacy sanitizer, localStorage log) | `__pilotAnalyticsHealth` / `__pilotMetrics(days)` | #188–#189 |
| Language system completion (6-locale key parity, 🌐 bottom sheet, `/admin/i18n-health`, `audit:i18n` ≥98% gate) | `__languageHealth` (extended) | #182–#191 |
| Home Command Center hero (single primary action; Health / Risk / Stage / Days-to-Harvest tiles) | `__commandCenterHealth` (now home-mounted) | #192 |
| Farm Health sub-risk breakout + action confidence | `__farmRiskHealth` (deck chips) | #193 |
| Digital Agronomist brief (score + attested contributors + risks) | `__farmHealthBrief` | #194 |

Gate count at this writing: **286 sequential `build:safe` steps**,
including `check-pilot-analytics` and `check-digital-agronomist`
(both permanent as of #194). The Home hero contract — exactly one
primary Start action, score never shown without explanation — is
locked by `check-digital-agronomist`.
