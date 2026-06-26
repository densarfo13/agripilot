/**
 * check-v15.mjs — Farroway v15 honesty gate.
 *
 * Enforces: the Farmer Copilot routes via a deterministic classifier + composes real
 * engines + DECLINES profit (confidence 0, never fabricated); and the capability
 * registry dresses nothing optimization/financial/soil-lab/surveillance up as "live".
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const COP = 'src/runtime/farmos15/FarmerCopilot.ts';
const REG = 'src/runtime/farmos15/V15CapabilityRegistry.ts';
const TEST = 'src/runtime/farmos15/__tests__/V15.test.ts';
for (const ff of [COP, REG, TEST]) if (!x(ff)) E.push('missing: ' + ff);

const cop = rd(COP);
h(cop, 'export function askCopilot', 'must expose askCopilot');
h(cop, 'export function classifyQuestion', 'must expose a deterministic classifier');
h(cop, '__farmerCopilotHealth', 'must pin the copilot health global');
// Composes real engines, not invented advice.
h(cop, 'buildMorningPlan', 'today plan must compose the real farm agent');
h(cop, 'computeLifecycleSnapshot', 'harvest must compose the real crop calendar');
h(cop, 'WeatherRisk', 'spray must compose the real weather-risk engine');
// profit_estimate must be a decline (canAnswer false / confidence 0) — never fabricated.
const profitBlock = cop.slice(cop.indexOf("case 'profit_estimate'"), cop.indexOf("case 'profit_estimate'") + 400);
if (!/canAnswer:\s*false/.test(profitBlock) || !/confidence:\s*0/.test(profitBlock))
  E.push("profit_estimate must decline (canAnswer:false, confidence:0) — never fabricate a number");

const reg = rd(REG);
h(reg, 'V15_CAPABILITIES', 'registry must export V15_CAPABILITIES');
// Line-based status check (paren-safe).
const regLines = reg.split(/\r?\n/);
const statusOf = (id) => {
  const line = regLines.find(l => l.includes("C('" + id + "'"));
  if (!line) return null;
  const m = line.match(/C\('[^']+',\s*'[^']*',\s*'([a-z_]+)'/);
  return m ? m[1] : null;
};
for (const id of ['farmbrain_optimization', 'autonomous_roi_plan', 'digital_soil_lab', 'financial_engine', 'disease_surveillance'])
  if (statusOf(id) === 'live') E.push('a optimization/financial/soil-lab capability is fabricated-as-live: ' + id);
for (const id of ['farmer_copilot', 'farmbrain_daily_plan'])
  if (statusOf(id) !== 'live') E.push('real capability must be live: ' + id);

// 6 reports.
for (const doc of ['AUTONOMOUS_PLATFORM.md', 'FARMBRAIN3.md', 'GLOBAL_SURVEILLANCE.md', 'FINANCIAL_ENGINE.md', 'EXPORT_ENGINE.md', 'PRODUCTION_CERTIFICATION.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('v15 test did not PASS: ' + out.trim());
  } catch (err) { E.push('v15 test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:v15] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:v15] PASS — Farmer Copilot routes real questions to real engines + declines profit honestly (conf 0); '
  + 'capability registry declares the truth (nothing optimization/financial/soil-lab dressed up as live); test green.');
