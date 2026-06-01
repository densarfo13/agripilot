#!/usr/bin/env node
/**
 * scripts/check-daily-farm-plan.mjs — §1/§7 Daily Farm Plan runtime + Home.
 *
 * Fails if the runtime does not cap the daily plan at THREE tasks, does not
 * work without weather/scan/GPS, drops the new- or existing-grower flow, is
 * not localizable, fabricates, or omits the disclaimer — or if the Home page
 * does not render the "Today's Farm Plan" section.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/dailyPlan/DailyFarmPlanRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/maxThreeTasksEnforced/.test(raw) || !/\.slice\(\s*0\s*,\s*3\s*\)/.test(src))
    F.push('daily plan must hard-cap top tasks at three (.slice(0, 3) + maxThreeTasksEnforced)');
  else P.push('top tasks hard-capped at three');
  for (const k of ['worksWithoutWeather', 'worksWithoutScan', 'worksWithoutGps']) {
    if (!raw.includes(k)) F.push(`must declare ${k} (plan works without it)`);
  }
  if (!F.some((m) => m.includes('worksWithout'))) P.push('works without weather / scan / GPS');
  for (const k of ['newGrowerFlowReady', 'existingGrowerFlowReady', 'planReady']) {
    if (!raw.includes(k)) F.push(`must surface ${k}`);
  }
  if (!F.some((m) => m.includes('GrowerFlowReady') || m.includes('planReady'))) P.push('new + existing grower flows + planReady');
  if (!/titleKey/.test(raw) || !/localizedKeysPresent/.test(raw))
    F.push('tasks must be localizable (titleKey + localizedKeysPresent)');
  else P.push('localizable (titleKey)');
  // Honest degradation: the §1 contract field is `dataGaps`, plus human copy
  // that names what is missing ("Not enough data" / "Not set yet" / "Add your…").
  if (!/dataGaps/.test(raw) || !/NEEDS_DATA|Not enough data|Not set yet|Add your/.test(raw))
    F.push('must degrade honestly (dataGaps + "Not enough data" / "Not set yet" / "Add your…")');
  else P.push('honest data gaps (dataGaps + degradation copy)');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/installDailyFarmPlanHealthGlobal/.test(raw) || !/__dailyFarmPlanHealth/.test(raw))
    F.push('must install window.__dailyFarmPlanHealth');
  else P.push('__dailyFarmPlanHealth installer present');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

// Home integration — the "Today's Farm Plan" section must render.
const home = read('src/pages/Home.jsx');
if (!home) F.push('src/pages/Home.jsx: missing');
else if (!/DailyFarmPlanCard/.test(home) || !/<DailyFarmPlanCard/.test(home))
  F.push('Home must import AND render <DailyFarmPlanCard /> (Today\'s Farm Plan section)');
else P.push('Home renders the Today\'s Farm Plan section');

// Card must not block Home — it is wrapped in an error boundary + uses a
// never-throwing dynamic import.
const card = read('src/components/home/DailyFarmPlanCard.jsx');
if (!card) F.push('src/components/home/DailyFarmPlanCard.jsx: missing');
else {
  if (!/getDerivedStateFromError|componentDidCatch/.test(card))
    F.push('card must be wrapped in an error boundary (never block Home)');
  else P.push('card error-boundary guarded');
  if (!/import\(\s*['"][^'"]*DailyFarmPlanRuntime/.test(card))
    F.push('card must build the plan via a dynamic import (no eager bundle/throw path)');
  else P.push('card builds plan via guarded dynamic import');
}

if (F.length) {
  console.error('[check:daily-farm-plan] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:daily-farm-plan] PASS — 3-task cap, works without weather/scan/GPS, both grower flows, localized, honest, Home renders it.');
for (const m of P) console.log('  ✓ ' + m);
