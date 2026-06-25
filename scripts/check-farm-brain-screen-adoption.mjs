/**
 * check-farm-brain-screen-adoption.mjs — FARM_BRAIN_STATE_V1, RULE 2 adoption.
 *
 * Locks the first screen reader of the single canonical FarmBrain state and the
 * broadened event surface (RULE 1 beyond scans). Keeps the read honest: the
 * canonical state is only folded in when it has advanced past the empty state,
 * and never carries a fabricated value.
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// ── The hook: subscribes to the store + reads the canonical selector. ──
const HOOK = 'src/hooks/useFarmBrainState.js';
if (!x(HOOK)) E.push('missing: ' + HOOK);
else {
  const s = rd(HOOK);
  h(s, 'export default function useFarmBrainState', 'hook must default-export useFarmBrainState');
  h(s, 'getFarmBrainState', 'hook must read the canonical selector getFarmBrainState');
  h(s, 'subscribeFarmBrain', 'hook must subscribe so screens re-render on events');
}

// ── First adopter: Home reads the canonical state (RULE 2). ──
const HOME = rd('src/pages/Home.jsx');
h(HOME, 'useFarmBrainState', 'Home must consume useFarmBrainState (RULE 2 first adopter)');
h(HOME, 'farmBrainState', 'Home must fold the canonical state into its signals');
h(HOME, 'hasFirstScan', 'Home must only fold canonical state once it has advanced (honest)');

// ── RULE 1 broadened: a completed task updates FarmBrain. ──
const TASKS = rd('src/lib/taskActions.js');
h(TASKS, 'dispatchFarmEvent', 'completeTask must dispatch a FarmBrain event');
h(TASKS, "'task_completed'", 'completeTask must dispatch the task_completed event (RULE 1)');

if (E.length) {
  console.error('[check:farm-brain-screen-adoption] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farm-brain-screen-adoption] PASS — useFarmBrainState hook; Home reads the '
  + 'canonical state (RULE 2); task_completed updates FarmBrain (RULE 1); honest fold (no fabrication).');
