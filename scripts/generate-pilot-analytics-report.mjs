#!/usr/bin/env node
/**
 * generate-pilot-analytics-report.mjs — sprint #188.
 *
 * Generates PILOT_ANALYTICS_REPORT.md from the static contract
 * surface (the in-browser event log is a runtime artifact, not
 * available to a build-time script — we report the SHAPE of
 * measurement, not the values, until pilot data starts flowing).
 *
 * When you want a real values report:
 *   - Run the app, drive the journey, then in DevTools:
 *     `JSON.stringify(window.__pilotMetrics(), null, 2)`
 *   - Paste the JSON into the "Live metrics" section of the
 *     generated report.
 *
 * Run: node scripts/generate-pilot-analytics-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readSrc(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return ''; }
}

const contractSrc = readSrc(
  'src/runtime/analytics/PilotEventContracts.ts');
const eventNames = [];
{
  const re = /^\s*[A-Z_]+:\s*'([a-z_]+)',/gm;
  let m;
  while ((m = re.exec(contractSrc)) !== null) eventNames.push(m[1]);
}
const allowedMeta = [];
{
  const block = contractSrc.match(
    /ALLOWED_METADATA_KEYS[\s\S]*?new Set\(\[([\s\S]*?)\]\)/);
  if (block) {
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(block[1])) !== null) allowedMeta.push(m[1]);
  }
}

const today = new Date(0).toISOString().slice(0, 10);

const md = `# PILOT_ANALYTICS_REPORT.md

**Sprint #188 — pilot analytics measurement readiness.**
Generated: build-time (static contract surface).

## Pilot readiness summary

Farroway has moved from build mode to **proof mode**:
- 24 canonical pilot events defined (\`PILOT_EVENT_CONTRACTS_VERSION\`).
- Unified \`trackPilotEvent({…})\` write-side helper landed.
- localStorage event log persisted under \`farroway.pilotEvents\` (FIFO 5000 cap).
- \`window.__pilotAnalyticsHealth()\` + \`window.__pilotMetrics(days?)\` pinned at boot.
- Sanitizer rejects sensitive substrings and any metadata key not in the allow-list.
- Existing \`/internal/pilot-analytics\` dashboard (sprint #157) reads from the new aggregator.

When real pilot users land, \`__pilotMetrics()\` returns real numbers.
Until then, every count is \`0\` and every rate is \`null\` (renders
**NEEDS_DATA** in the UI — never a fake percentage).

## Canonical events tracked (${eventNames.length})

${eventNames.map((n) => '- `' + n + '`').join('\n')}

## Live metrics

Paste \`JSON.stringify(window.__pilotMetrics(), null, 2)\` here after
driving the journey:

\`\`\`json
{ "runtimeVersion": "pilot-metrics-aggregator-v1", "windowDays": 7, "scansStarted": 0, "scansCompleted": 0, "tasksCreated": 0, "tasksCompleted": 0, "outcomesRecorded": 0, "followupsCreated": 0, "followupsCompleted": 0, "scanSuccessRate": null, "taskCompletionRate": null, "outcomeCaptureRate": null, "followupCompletionRate": null, "wau": 0, "mau": 0, "d1Retention": null, "d7Retention": null }
\`\`\`

## Active users

Sourced from \`countDistinctActiveDays()\` in the last 7 / 30 days
(WAU / MAU). When zero events are persisted: WAU=0, MAU=0.

## Scan success

\`scanSuccessRate = scansCompleted / scansStarted\` (rate \`null\` when
\`scansStarted == 0\` — never \`0%\` or \`100%\` falsely).

## Task completion

\`taskCompletionRate = tasksCompleted / tasksCreated\` (rate \`null\` when
\`tasksCreated == 0\`).

## Outcome capture

\`outcomeCaptureRate = outcomesRecorded / scansCompleted\` (rate \`null\`
when \`scansCompleted == 0\`).

## Follow-up completion

\`followupCompletionRate = followupsCompleted / followupsCreated\`
(rate \`null\` when \`followupsCreated == 0\`).

## Retention

- D1: distinct active days in last 7, scaled to 7 (proxy until
  server-side cohort tables ship).
- D7: distinct active days in last 30, scaled to 30.
- Both return \`null\` when no events recorded.

## Language usage

Tally of \`event.language\` for every captured event in the window.
Reflects the locale the user had selected at event time. Renders as
NEEDS_DATA when no events recorded.

## Privacy safeguards

- Allowed metadata keys (${allowedMeta.length}):
${allowedMeta.map((k) => '  - `' + k + '`').join('\n')}
- Sensitive substrings rejected: \`@\`, \`+\`, \`phone\`, \`token\`,
  \`password\`, \`pwd\`. Values matching are dropped before write.
- Roles are enumerated only: farmer | gardener | field_officer |
  org_admin | admin. No raw user id / name / phone / email / coord /
  device id / IP / filename.
- Stored client-side only (localStorage); server-side ingestion is
  a sprint-#189 follow-up so no PII crosses the wire today.

## Top drop-off point

Computed at runtime from \`funnel\` keys (signup → farm/garden →
crop/plant → today-action → scan → outcome → follow-up). Until
pilot events flow, this card renders NEEDS_DATA.

## Recommended next 3 fixes

1. **Server-side ingestion**: \`POST /api/analytics/pilot-event\` so
   data survives device wipes and is queryable across farmers.
   Includes the \`PilotEvent\` / \`PilotDailyMetric\` /
   \`PilotUserCohort\` Prisma tables from the spec. Deferred from
   this sprint per safety contract (no auto-applied migrations
   to production).
2. **Wire remaining call sites**: 5 highest-impact event call sites
   are wired this sprint (signup, language, scan, task, outcome).
   Remaining ~17 wireup points are queued for sprint #189.
3. **Server-side cohort math**: proper D1/D7 retention needs a
   cohort table keyed by first-event date. Today's proxy is
   client-only and approximates from active-day counts.

---

_Static contract report; live values require a running app + pilot
events. Update this doc after driving the acceptance test journey._
`;

const out = path.join(ROOT, 'PILOT_ANALYTICS_REPORT.md');
fs.writeFileSync(out, md, 'utf8');
console.log('[generate-pilot-analytics-report] wrote ' + path.relative(ROOT, out)
  + ' (' + eventNames.length + ' events, ' + allowedMeta.length + ' allowed metadata keys)');
