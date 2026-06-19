/**
 * check-task-dedup.mjs — sprint #212 §11.
 * Fails build if the task deduper is missing its dedup keys, the
 * health global, or the wiring into the farmer task render path.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const D = _read('src/runtime/tasks/TaskDeduper.ts');
if (!D) errors.push('missing TaskDeduper.ts');
else {
  _has(D, 'export function dedupeTasks', 'must export dedupeTasks');
  for (const k of ['taskType', 'farmId', 'cropId', 'dueDate', 'sourceEngine']) {
    _has(D, k, 'deduper must key on: ' + k);
  }
  _has(D, '__taskDedupHealth', 'must pin __taskDedupHealth');
  _has(D, 'preserve', 'must preserve user notes (comment intent)');
}
_has(_read('src/pages/farmer/FarmerTodayPage.jsx'), 'dedupeTasks',
  'FarmerTodayPage must dedupe tasks before render');
_has(_read('src/App.jsx'), 'installTaskDedupHealthGlobal',
  'App.jsx must boot-install task dedup health');

if (errors.length) { console.error('[check:task-dedup] FAIL'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('[check:task-dedup] PASS — deduper keyed + wired + health.');
