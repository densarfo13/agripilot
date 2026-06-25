/**
 * check-decision-engine.mjs — FARROWAY DECISION ENGINE §10.
 * Locks the 5 engine files, the health global, and runs the acceptance test.
 */
import fs from 'node:fs'; import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd(); const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const D = 'src/runtime/decision/';
for (const f of ['FarrowayDecisionEngine.ts', 'FarrowayDecisionContracts.ts',
  'DecisionEvidenceBuilder.ts', 'DecisionExplainer.ts', 'DecisionPriorityRanker.ts'])
  if (!x(D + f)) E.push('missing: ' + D + f);

const eng = rd(D + 'FarrowayDecisionEngine.ts');
h(eng, 'export function buildDailyDecision', 'must export buildDailyDecision');
h(eng, '__decisionEngineHealth', 'must pin window.__decisionEngineHealth');
h(eng, 'recordDecisionFeedback', 'must export the §4 feedback recorder');
h(eng, 'learningActive', 'health must report learningActive (honest, false until enough data)');
h(eng, 'LEARNING_MIN_SAMPLES', 'must not fake learning before enough samples');
h(rd('src/App.jsx'), 'installDecisionEngineHealth', 'App boot must install __decisionEngineHealth');

const TEST = D + '__tests__/DecisionEngine.test.ts';
if (!x(TEST)) E.push('missing acceptance test: ' + TEST);
else if (E.length === 0) {
  try { const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('acceptance test did not PASS'); }
  catch (err) { E.push('acceptance test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:decision-engine] FAIL — ' + E.length + ':'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:decision-engine] PASS — 5 engine files, health global, feedback recorder, acceptance test green.');
