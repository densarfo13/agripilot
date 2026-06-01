# Farroway Pilot — Daily Readiness Report (operator runbook)

**Pilot Execution Mode.** Architecture is frozen — no new engines, frameworks,
or AI modules. This is the daily measure-and-report loop. Run it each morning;
paste the snapshot into the pilot log.

> All numbers come from already-shipped, read-only diagnostic globals. If a
> metric reads `NEEDS_DATA` / `null`, that is honest — the pilot is still
> accumulating that data. Never substitute an estimate.

---

## How to capture (browser console, signed in as admin)

```js
const r = {
  os:        window.__farrowayHealth(),       // unified verdict
  goLive:    window.__goLiveHealth(),          // GO / GO_WITH_LIMITATIONS / NO_GO
  scan:      window.__scanMetrics(),           // success / failures / retries / sources
  analytics: window.__pilotAnalytics(),        // WAU / task / follow-up / outcomes
  retention: window.__retentionHealth(),       // D1 / D7 / D30
  farmers:   window.__farmerSuccessHealth(),   // risk tiers
  outcomes:  window.__outcomeCaptureHealth(),  // capture chain
  perf:      window.__performanceHealth(),     // load times
};
console.log(JSON.stringify(r, null, 2));
```
(Also available on the admin pages: `/internal/pilot-analytics`,
`/internal/ngo-intelligence`, `/internal/v13`.)

## Metric → source → target

| Metric | Source | Target |
|--------|--------|--------|
| DAU / WAU / MAU | `__pilotAnalytics()` (weeklyActiveGrowers) + `__retentionHealth()` | trend ↑ |
| Scan success rate | `__scanMetrics().successRate` | ≥ 95% |
| Avg analysis time | `__scanMetrics().avgAnalysisTime` | < 20s |
| Task completion rate | `__pilotAnalytics().taskCompletionRate` | ≥ 40% |
| Follow-up rate | `__pilotAnalytics().followUpScanRate` | ≥ 30% |
| Outcome capture rate | `__outcomeCaptureHealth()` + `__pilotAnalytics().outcomesRecorded` | growing |
| Retention D1 / D7 / D30 | `__retentionHealth()` (d1/d7/d30) | D1 ≥ 40%, D7 ≥ 20%, D30 ≥ 10% |

## 8 focus areas — daily status checklist

1. **Scan reliability** — `__scanMetrics().successRate` ≥ 95%; failures/retries flat or ↓.
2. **Farmer onboarding** — new farmers activating; `__farmerSuccessHealth` risk tiers (At-risk count ↓).
3. **Follow-up scans** — `followUpScanRate` ≥ target; overdue follow-ups triaged by field officers.
4. **Outcome collection** — `outcomesRecorded` ↑; improved/unchanged/worsened distribution captured.
5. **NGO reporting** — `/internal/ngo-intelligence` org-scoped metrics current; grant export (CSV/JSON) works.
6. **Pilot analytics** — `/internal/pilot-analytics` WAU + rates rendering real data.
7. **Performance** — `__performanceHealth` home < 2s, scan shell < 1s; bundle 843 KB gzip.
8. **Bug fixes** — zero new blockers in `__goLiveHealth().blockers`; triage any warnings.

## Daily report template (fill in)

```
FARROWAY PILOT — DAILY READINESS — <date>
Platform verdict (__farrowayHealth):  <READY | NEEDS_DATA | BLOCKED>
Go-live (__goLiveHealth):             <GO | GO_WITH_LIMITATIONS | NO_GO>

ADOPTION
  DAU / WAU / MAU:        <n> / <n> / <n>
  Retention D1/D7/D30:    <%> / <%> / <%>

SCAN
  Success rate:           <%>   (target ≥95%)
  Avg analysis time:      <ms>
  Failures / retries:     <n> / <n>
  Upload vs camera:       <n> / <n>

ENGAGEMENT
  Task completion rate:   <%>
  Follow-up scan rate:    <%>
  Outcomes recorded:      <n>   (improved/unchanged/worsened/unknown: …)

HEALTH
  Blockers:               <list or NONE>
  Warnings:               <list>
  Perf (home/scan):       <s> / <s>

ACTIONS TODAY
  - <field-officer follow-ups, bug fixes, onboarding nudges…>
```

## Escalation
- Any `__goLiveHealth().blockers` non-empty → **stop new onboarding**, fix, re-deploy.
- Scan success rate < 90% for a day → investigate provider/device; Upload path stays the safe fallback.
- No new code ships in execution mode except **bug fixes** (must pass `build:safe`).
