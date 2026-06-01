#!/usr/bin/env node
/**
 * scripts/check-simple-mode-hard-split.mjs — Simple Mode hard split.
 *
 * Fails if:
 *   - any of the 10 spec-named files at src/modes/{simple,standard}/ is
 *     missing on disk
 *   - the Home.jsx page-level renderer does not branch into <SimpleHome />
 *     when simpleMode is enabled
 *   - AllTasksPage does not branch into <SimpleTasks /> when enabled
 *   - the simple-mode runtime envelope does not report all 5 *Component
 *     fields (home / tasks / scan / dailyPlan / postHarvest)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const exists = (f) => { try { return fs.statSync(path.join(ROOT, f)).isFile(); } catch { return false; } };

// 1. Spec-canonical files exist on disk.
const SPEC_FILES = [
  'src/modes/simple/SimpleHome.jsx',
  'src/modes/simple/SimpleTasks.jsx',
  'src/modes/simple/SimpleScanResult.jsx',
  'src/modes/simple/SimpleDailyPlan.jsx',
  'src/modes/simple/SimplePostHarvest.jsx',
  'src/modes/standard/StandardHome.jsx',
  'src/modes/standard/StandardTasks.jsx',
  'src/modes/standard/StandardScanResult.jsx',
  'src/modes/standard/StandardDailyPlan.jsx',
  'src/modes/standard/StandardPostHarvest.jsx',
];
const missing = SPEC_FILES.filter((f) => !exists(f));
if (missing.length) F.push(`spec files missing: ${missing.join(', ')}`);
else P.push('all 10 spec files present (5 simple + 5 standard)');

// 2. Home.jsx page-level branch.
const home = read('src/pages/Home.jsx');
if (!home) F.push('src/pages/Home.jsx: missing');
else {
  if (!/import\s+SimpleHome/.test(home))
    F.push('Home.jsx must import SimpleHome');
  else P.push('Home.jsx imports SimpleHome');
  if (!/if\s*\(\s*simpleModeEnabled\s*\)\s*\{?\s*return\s+<SimpleHome\s*\/>/.test(home))
    F.push('Home.jsx must branch: if (simpleModeEnabled) return <SimpleHome />');
  else P.push('Home.jsx branches early into <SimpleHome />');
}

// 3. AllTasksPage branch.
const tasks = read('src/pages/AllTasksPage.jsx');
if (!tasks) F.push('src/pages/AllTasksPage.jsx: missing');
else {
  if (!/import\s+SimpleTasks/.test(tasks))
    F.push('AllTasksPage must import SimpleTasks');
  else P.push('AllTasksPage imports SimpleTasks');
  if (!/if\s*\(\s*simpleModeEnabled\s*\)\s+return\s+<SimpleTasks\s*\/>/.test(tasks))
    F.push('AllTasksPage must branch: if (simpleModeEnabled) return <SimpleTasks />');
  else P.push('AllTasksPage branches early into <SimpleTasks />');
}

// 4. Diagnostic envelope reports all 5 *Component fields.
const runtime = read('src/runtime/simpleMode/SimpleModeRuntime.ts');
if (!runtime) F.push('SimpleModeRuntime.ts: missing');
else {
  for (const fld of ['homeComponent', 'tasksComponent', 'scanComponent', 'dailyPlanComponent', 'postHarvestComponent']) {
    if (!new RegExp(`\\b${fld}\\b`).test(runtime))
      F.push(`__simpleModeHealth envelope must include ${fld}`);
  }
  if (!F.some((m) => /envelope must include/.test(m)))
    P.push('5 *Component fields present in envelope');
  // §10 spec assertions
  for (const fld of ['analyticsHiddenInSimple', 'modeDifferenceObvious']) {
    if (!new RegExp(`\\b${fld}\\b`).test(runtime))
      F.push(`__simpleModeHealth envelope must declare ${fld}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('analyticsHiddenInSimple + modeDifferenceObvious declared');
}

if (F.length) {
  console.error('[check:simple-mode-hard-split] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-hard-split] PASS — 10 spec files present, Home + Tasks branch early, 5 *Component fields wired.');
for (const m of P) console.log('  ✓ ' + m);
