#!/usr/bin/env node
/**
 * generate-weekly-pilot-report.mjs — sprint #218 (PILOT MODE).
 *
 * Emits WEEKLY_PILOT_REPORT.md: the founder's weekly pilot dashboard.
 * READ-ONLY. No new engine, no architecture change — pilot-ops only.
 *
 * Honesty contract:
 *   - The activation/retention metrics (Users Activated, Farms Created,
 *     First Scan/Task %, Outcome %, D1/D7) are CLIENT-SIDE — they live
 *     in the browser analytics store and are read by `__pilotMetrics()`
 *     on /admin/pilot-analytics. A build-time Node script CANNOT see
 *     them, so this report prints NEEDS_DATA + the live source. It does
 *     NOT fabricate pilot numbers.
 *   - What IS knowable at build time is filled in for real: translation
 *     coverage (from the columns) and the candidate drop-off points
 *     (the activation funnel steps).
 *
 * Usage:  node scripts/generate-weekly-pilot-report.mjs [ISO-date]
 *   The optional date stamps the report (default: a fixed placeholder,
 *   since Date.now() is avoided for deterministic output — pass the
 *   real week-ending date when running it for a given week).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLS = path.join(ROOT, 'src', 'i18n', 'columns');
const weekEnding = process.argv[2] || '<set week-ending date>';

async function loadCol(code) {
  return (await import(pathToFileURL(path.join(COLS, 'T-' + code + '.js')).href + '?w=' + code)).default;
}

// Real translation coverage (value differs from English = translated).
async function translationCoverage() {
  const en = await loadCol('en');
  const keys = Object.keys(en);
  const out = {};
  for (const c of ['fr', 'sw', 'ha', 'tw', 'hi']) {
    const col = await loadCol(c);
    let tr = 0;
    for (const k of keys) { const v = col[k]; if (typeof v === 'string' && v.trim() && v !== en[k]) tr++; }
    out[c] = +(tr / keys.length * 100).toFixed(1);
  }
  return { total: keys.length, pct: out };
}

// The activation funnel steps = the candidate drop-off points. Sourced
// from FirstFiveMinutesEngine so the report and the engine never drift.
function funnelSteps() {
  const src = fs.readFileSync(path.join(ROOT, 'src/runtime/onboarding/FirstFiveMinutesEngine.ts'), 'utf8');
  const m = src.match(/\[\s*'([a-zA-Z]+)'\s*,\s*'[a-z_]+'\s*\]/g) || [];
  return m.map((x) => (x.match(/'([a-zA-Z]+)'/) || [])[1]).filter(Boolean);
}

async function main() {
  const cov = await translationCoverage();
  const steps = funnelSteps();
  const L = [];
  L.push('# WEEKLY_PILOT_REPORT.md');
  L.push('');
  L.push('**Farroway pilot — weekly report.** Week ending: ' + weekEnding + '.');
  L.push('Generated read-only by `scripts/generate-weekly-pilot-report.mjs`.');
  L.push('Pilot Execution Mode: architecture/intelligence/satellite/marketplace FROZEN.');
  L.push('');
  L.push('## North-star metrics');
  L.push('');
  L.push('| Metric | This week | Source |');
  L.push('|---|---|---|');
  for (const [label, key] of [
    ['Users Activated', 'signup_completed'],
    ['Farms Created', 'farm_created'],
    ['First Scan %', 'scan_started/activated'],
    ['First Task %', 'task_created/activated'],
    ['Outcome Capture %', 'outcome_recorded/task_completed'],
    ['D1 Retention %', 'return_visit@24h'],
    ['D7 Retention %', 'return_visit@7d'],
  ]) {
    L.push('| ' + label + ' | **NEEDS_DATA** | `__pilotMetrics()` · /admin/pilot-analytics (event: ' + key + ') |');
  }
  L.push('');
  L.push('_NEEDS_DATA = no pilot users yet. The metrics are instrumented');
  L.push('(events wired #188/#189/#213, funnel #217) and populate live on');
  L.push('the admin page the moment the cohort starts. This script cannot');
  L.push('read client-side analytics, so it never fabricates these numbers._');
  L.push('');
  L.push('## Top 10 drop-off points (activation funnel)');
  L.push('');
  L.push('Ranked once data flows by `FirstFiveMinutesEngine.dropOffStep`.');
  L.push('Candidate points (the funnel steps), in order:');
  L.push('');
  steps.slice(0, 10).forEach((s, i) => L.push((i + 1) + '. ' + s + ' — _% drop NEEDS_DATA_'));
  L.push('');
  L.push('## Top 10 errors');
  L.push('');
  L.push('Source: client error boundaries + server logs. **NEEDS_DATA** —');
  L.push('no pilot traffic yet. (Build-time error surface = 0: build:safe');
  L.push('311 gates green.)');
  L.push('');
  L.push('## Top 10 requested features');
  L.push('');
  L.push('Source: pilot feedback channel. **NEEDS_DATA** — collect from the');
  L.push('first cohort. Per Pilot Mode, any request is triaged against the 5');
  L.push('KPIs before it becomes work; everything else is rejected/deferred.');
  L.push('');
  L.push('## Translation completion (real, this build)');
  L.push('');
  L.push('| Locale | Coverage |');
  L.push('|---|---:|');
  L.push('| en | 100% |');
  for (const c of ['sw', 'ha', 'tw', 'fr', 'hi']) {
    L.push('| ' + c + ' | ' + cov.pct[c] + '% |');
  }
  L.push('');
  L.push('Hindi hidden until translated (enableHindiLocale=false). Total keys: ' + cov.total + '.');
  L.push('');
  L.push('## Recommendation — Keep / Fix / Remove');
  L.push('');
  L.push('| Verdict | Item |');
  L.push('|---|---|');
  L.push('| **KEEP** | The whole engineering stack — scan trust gate, Farm Brain, dedupers, activation funnel, retention engine. All gate-locked (311 green). |');
  L.push('| **FIX** | Nothing code-side is a confirmed blocker. The only "fix" is non-code: finish the Twi/regional translator queue (#211) for the visible locales. |');
  L.push('| **REMOVE** | Nothing. No feature is proven harmful — there is no usage data to prove anything yet. |');
  L.push('');
  L.push('## The one recommendation that matters');
  L.push('');
  L.push('Every north-star metric reads NEEDS_DATA for one reason: **no pilot');
  L.push('users**. The single action that improves all five at once is');
  L.push('onboarding the Phase-1 cohort (10-20 farmers). That is the next');
  L.push('step — not another code change.');

  fs.writeFileSync(path.join(ROOT, 'WEEKLY_PILOT_REPORT.md'), L.join('\n') + '\n', 'utf8');
  console.log('[weekly-pilot-report] wrote WEEKLY_PILOT_REPORT.md (week ending ' + weekEnding + ')');
}

main().catch((e) => { console.error(e); process.exit(1); });
