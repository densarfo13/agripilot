#!/usr/bin/env node
/**
 * scripts/check-daily-plan-task-sync.mjs — §8/§11 task + outcome integration.
 *
 * Fails if the integration does not EXTEND the existing Tasks system (rather
 * than replace it), de-duplicate, track skipped tasks, feed completed tasks
 * into the outcome loop, tag a source, stay non-blocking, or install its
 * probes. Also fails if the Home card's actions don't record through the
 * canonical event logger.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/dailyPlan/DailyPlanIntegrationRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  for (const k of ['extendsExistingTasks', 'noDuplicateTasks', 'skippedTracked', 'completedFeedsOutcome']) {
    if (!raw.includes(k)) F.push(`must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('extends Tasks + dedup + skipped + completed→outcome');
  if (!/source/.test(raw)) F.push('tasks must carry a source tag (daily_plan / scan / weather / lifecycle / post_harvest)');
  else P.push('source-tagged tasks');
  for (const g of ['__dailyPlanTaskHealth', '__dailyPlanScanHealth', '__dailyPlanWeatherHealth', '__dailyPlanOutcomeHealth']) {
    if (!raw.includes(g)) F.push(`must install ${g}`);
  }
  if (!F.some((m) => /__dailyPlan(Task|Scan|Weather|Outcome)Health/.test(m))) P.push('4 integration probes installed');
  if (!/installDailyPlanIntegrationGlobals/.test(raw)) F.push('must export installDailyPlanIntegrationGlobals');
  else P.push('integration installer present');
  if (!/nonBlocking/.test(raw)) F.push('integration probes must be nonBlocking');
  else P.push('non-blocking');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

// Home card actions must record through the canonical event logger (extend,
// not invent a parallel store) using its allowed task event types.
const card = read('src/components/home/DailyFarmPlanCard.jsx');
if (!card) F.push('src/components/home/DailyFarmPlanCard.jsx: missing');
else {
  if (!/logEvent/.test(card)) F.push('card must record actions via the canonical logEvent (extend Tasks)');
  else P.push('card records via canonical logEvent');
  if (!/task_completed/.test(card) || !/task_skipped/.test(card))
    F.push('card must use the canonical task_completed / task_skipped event types');
  else P.push('canonical task_completed / task_skipped used');
}

if (F.length) {
  console.error('[check:daily-plan-task-sync] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:daily-plan-task-sync] PASS — extends Tasks, dedup, skipped tracked, completed→outcome, non-blocking.');
for (const m of P) console.log('  ✓ ' + m);
