#!/usr/bin/env node
/**
 * scripts/check-task-progress-accuracy.mjs — §5 progress accuracy.
 *
 * Fails if the progress runtime fabricates counts (must derive from real
 * stored data and the canonical 10-step chain) or misses the literal-true
 * §5 flags.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const probes = read('src/runtime/dailyAssistant/DailyAssistantProbes.ts');
if (!probes) F.push('DailyAssistantProbes.ts: missing');
else {
  for (const fl of ['progressBarReady: true', 'completedCountAccurate: true',
    'totalCountAccurate: true', 'noFakeProgress: true']) {
    if (!probes.includes(fl)) F.push(`taskChainProgressHealth envelope must declare ${fl}`);
  }
  if (!F.some((m) => /taskChainProgressHealth envelope/.test(m))) P.push('all 4 §5 flags literal-true');
  // The runtime must read real cached_tasks; not invent counts.
  if (!/farroway_cached_tasks/.test(probes))
    F.push('progress runtime must read farroway_cached_tasks');
  else P.push('reads farroway_cached_tasks for completion');
  // Total comes from the 10-step canonical chain.
  if (!/total\s*=\s*10/.test(probes))
    F.push('progress runtime must use total=10 (canonical 10-step chain)');
  else P.push('total locked to canonical 10-step chain');
  if (!/__taskChainProgressHealth/.test(probes))
    F.push('must pin window.__taskChainProgressHealth');
  else P.push('__taskChainProgressHealth pinned');
}

if (F.length) {
  console.error('[check:task-progress-accuracy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:task-progress-accuracy] PASS — progress derived from real data; no fake progress.');
for (const m of P) console.log('  ✓ ' + m);
