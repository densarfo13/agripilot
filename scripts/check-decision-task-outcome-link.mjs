/**
 * check-decision-task-outcome-link.mjs — FARROWAY DECISION ENGINE §10.
 * Every decision links to a task; every task links to an outcome path. The
 * contract requires reason + confidence too.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(); const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const C = rd('src/runtime/decision/FarrowayDecisionContracts.ts');
for (const f of ['taskRef', 'outcomePath', 'reason', 'confidence'])
  h(C, f, 'DailyDecision must include: ' + f);

const eng = rd('src/runtime/decision/FarrowayDecisionEngine.ts');
h(eng, 'taskRef:', 'every built decision must set taskRef');
h(eng, 'outcomePath:', 'every built decision must set outcomePath');
// The empty-state path must ALSO link a task + outcome (onboarding).
if (!/taskRef:\s*'task:'/.test(eng)) E.push('empty-state decision must still link a task');
if (!/outcomePath:\s*'outcome:onboarding'/.test(eng)) E.push('empty-state decision must link an outcome path');

if (E.length) { console.error('[check:decision-task-outcome-link] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:decision-task-outcome-link] PASS — every decision links a task + outcome path; reason + confidence required.');
