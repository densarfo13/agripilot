# Farroway Pilot Operations Layer (Post-V13)

Operational layer to manage 10 → 100 → 1,000 → 10,000 farmers. **No new AI,
no new ML, no new scan engines** — the operational surfaces already exist from
prior waves; this wave **locks them with governance** and adds read-only scan
metrics. Focus: adoption, outcomes, accountability, reporting.

---

## 1. Files created
- `scripts/check-farmer-retention.mjs`
- `scripts/check-followup-completion.mjs`
- `scripts/check-outcome-capture.mjs`
- `scripts/check-ngo-reporting.mjs`
- `scripts/check-buyer-readiness.mjs`
- (prior step this sprint) `src/runtime/scanMetrics/ScanMetricsRuntime.ts`
  (`window.__scanMetrics()`), `scripts/check-scan-metrics.mjs`
- `docs/PILOT_OPERATIONS_LAYER.md`

## 2. Files modified
- `package.json` — 5 new operations gates wired into `build:safe`.
- (No engine/runtime modified — the operational surfaces already exist.)

## 3. Farmer Success architecture
`src/runtime/farmerSuccess/FarmerSuccessEngine.ts` → `window.__farmerSuccess
Health()`: per-farmer `score` + `risk` tier (Active / Needs follow-up /
At-risk), `followUpRate`, `taskCompletion`, scan/task signals, inactivity.
Honest — no fabricated score. Locked by `check-farmer-retention` (also asserts
RetentionRuntime D1/D7/D30 cohorts).

## 4. Field Officer + NGO dashboard architecture
- Field officer: `src/runtime/fieldOfficer/FieldOfficerRuntime.ts`
  (`__fieldOfficerHealth`) + `FieldOfficerOutcomesPage` — assigned/inactive/
  high-risk farms, pending scans/follow-ups; actions (call/SMS/WhatsApp/visit).
- NGO program: `__ngoImpactHealth` (FieldIntelligence) + `__ngoEnterpriseHealth`
  (V8) + `NGOHealthPage` / `/internal/ngo-intelligence` — total/active farmers,
  scans, tasks, follow-ups, outcomes, adoption / disease-trend / task-completion
  / regional charts. Org-scoped, no cross-tenant leakage. Locked by
  `check-ngo-reporting`.

## 5. Outcome engine architecture
`OutcomeLearningRuntime` (statuses IMPROVED/UNCHANGED/WORSENED/UNKNOWN) +
`__outcomeCaptureHealth` (PilotHealthRuntime — full scan→diagnosis→
recommendation→task→follow-up→outcome chain) + PilotAnalytics `improvementRate`
(per crop / region / NGO). Locked by `check-outcome-capture` +
`check-followup-completion`.

## 6. Grant reporting architecture
`src/runtime/v13/exports/AnalyticsExportRuntime.ts` (`__analyticsExportHealth`)
+ `__reportHealth` — NGO program / farmer activity / outcome / regional risk /
buyer trust / audit reports, **organization-scoped + privacy-filtered**, in
**CSV + JSON** today (PDF / Excel are future export targets, readiness-tracked
— not yet implemented). Locked by `check-ngo-reporting`.

## 7. Pilot analytics architecture
`src/runtime/outcomeIntelligence/PilotAnalyticsRuntime.ts` (`__pilotAnalytics`):
weekly-active growers, scans, tasks generated/completed, `taskCompletionRate`,
`followUpScanRate`, `outcomesRecorded`, `improvementRate`; retention D1/D7/D30
via `RetentionRuntime`. Surface: `PilotAnalyticsPage` (`/internal/pilot-
analytics`). New: `__scanMetrics()` (success rate / avg analysis time /
failures / retries / upload vs camera usage) from real on-device data, honest
NEEDS_DATA.

## 8. Governance checks (all wired into `build:safe`, all PASS)
`check-farmer-retention`, `check-followup-completion`, `check-outcome-capture`,
`check-ngo-reporting`, `check-buyer-readiness` (+ `check-scan-metrics` from the
pilot-lock step). Each asserts the real operational surface exists, is honest
(no fabrication), and is org-scoped / privacy-safe where applicable.

## 9. Build results
`npm run build:safe` EXIT=0 — all operations gates PASS, vite `✓ built in
14.58s`, bundle within budget.

## 10. Pilot readiness verdict
**READY for scaled pilot operations.** The accountability + reporting layer is
present and now gate-locked: farmer health scoring + risk tiers, retention
cohorts, follow-up generation/capture/rate, outcome statuses + success rate,
org-scoped NGO metrics + privacy-filtered grant export (CSV/JSON), buyer
harvest/match readiness with no private-data exposure, and pilot analytics
incl. scan reliability metrics. All metrics honestly report **NEEDS_DATA**
until pilots accumulate real records — which is exactly what this layer exists
to collect as farmer counts grow 10 → 100 → 1,000 → 10,000.

Known future work (not blockers): PDF/Excel grant export formats; native
SMS/WhatsApp/Email reminder dispatch (currently message-template-ready).
