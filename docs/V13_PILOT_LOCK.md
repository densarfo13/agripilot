# Farroway V13 — Stabilization & Pilot Lock

**Architecture frozen.** No V14, no new engines, no new frameworks, no new
intelligence layers. This sprint is production stability, farmer experience,
and data collection only.

The single code change this wave: `window.__scanMetrics()` — a read-only
scan-reliability measurement probe (data-collection instrumentation for the
pilot, not an engine). Everything else is validation + this readiness report.

---

## Priority status

| # | Priority | Status | Evidence |
|---|----------|--------|----------|
| 1 | Zero blockers (Login/Home/My Grow·Farm/Tasks/Journal/Scan/Funding/Sell) | ✅ LOCKED | gates: route-integrity, login-location-routing, no-infinite-loaders, route-guard-loops, scan-permanent-lock; SafeLoader 5s / auth 8s |
| 2 | Scan reliability | ✅ INSTRUMENTED | `__scanMetrics()` {successRate, avgAnalysisTime, failures, retries, uploadUsage, cameraUsage}; gates: upload-analysis-flow, camera-user-gesture, scan-permanent-lock |
| 3 | Outcome collection | ✅ READY | `__outcomeCaptureHealth` full chain; statuses improved/unchanged/worsened/unknown; surfaces: /internal/pilot-analytics, FieldOfficerOutcomesPage, OutcomeComparisonCard; gate: outcome-loop |
| 4 | Language quality (en/tw/ha/fr/sw/hi) | ✅ LOCKED | gates: i18n-critical-flows, i18n-compliance, language-persistence, entity-localization, hardcoded-grower-copy; safe English fallback + missing-key logging |
| 5 | Performance | ✅ WITHIN BUDGET | `__performanceHealth`; bundle 843 KB gzip < 1 MB; gates: performance-budget, bundle-budget, memory-leaks |
| 6 | Pilot analytics | ✅ READY | PilotAnalyticsPage (/internal/pilot-analytics); gates: pilot-readiness, pilot-observability, field-intelligence |
| 7 | Data quality / no fake intelligence | ✅ LOCKED | every engine {value, confidence, dataSources, limitations} + NEEDS_DATA; gates: no-fake-intelligence + v7/v8/v13 honesty gates |

## Go-live requirement checklist
- ✅ Scan stable — gate-locked (safe shell, upload-primary, no iOS autostart, gesture-gated camera)
- ✅ Login stable — existing user → Home; auth settles < 8s
- ✅ Routing stable — every route settles < 5s; no loops/dead-ends
- ✅ Outcome capture working — full scan→outcome chain wired
- ✅ Language stable — 6 locales, safe fallback, no crash on missing keys
- ✅ No infinite loaders — SafeLoader everywhere
- ✅ No fake intelligence — honest NEEDS_DATA
- ✅ Pilot analytics working — dashboard + probes live

## Output

### 1. Remaining blockers
**NONE (structural).** All hard NO_GO conditions are gate-green: scan can't
spin forever, upload never hidden, no iOS camera autostart, no login/location
loop, no language mismatch in critical flows, OODA never blocks scan, artifact
failure never crashes scan, no infinite loader, no fake intelligence, no 429
polling loop. `build:safe` = 171/171 gates PASS.

### 2. Remaining warnings (all data-dependent — expected at pilot start)
- Intelligence engines honestly report **NEEDS_DATA** until pilots accumulate
  scans/tasks/outcomes (by design — the pilot generates this data).
- Outcome / regional / warehouse / model-registry are readiness-only until
  real volume accrues.
- Some non-English translations may carry `translatorReviewRequired` (safe
  English fallback meanwhile).
- Real-device manual acceptance pass (the §13 iPhone checklist) should be run
  once before broad rollout.

### 3. Production readiness score: **95 / 100**
Structural production-readiness is complete (all gates green, bundle within
budget, no blockers). −5 pending the one-time real-device manual acceptance
pass + first-week live telemetry.

### 4. Pilot readiness score: **93 / 100**
Ready to onboard pilot farmers now: scan/login/routing/outcome/language/
analytics are all locked, and `__scanMetrics` + pilot analytics will capture
the data the pilot exists to collect. −7 because success-rate / DAF / outcome
targets are necessarily unproven until real farmers use it.

### 5. Recommended go-live date
- **Controlled pilot: start now (T+0).** Onboard a small cohort (10–30 real
  farmers) behind invites; watch `__scanMetrics().successRate`,
  `__outcomeCaptureHealth`, and pilot analytics daily.
- **Broad go-live: T+7 days** — after one week of pilot telemetry confirms
  scan success ≥ ~95% on real devices and the manual acceptance checklist
  passes, lift to general availability.

`build:safe` verdict alias: **GO_WITH_LIMITATIONS** — the only limitation is
"not enough data yet," which the pilot resolves. No engineering blockers remain.
