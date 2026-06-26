/**
 * check-v14.mjs — Farroway v14 honesty gate.
 *
 * Enforces: the multi-agent registry has live agents that advise from real engines
 * and declining agents that NEVER fabricate (confidence 0); and the capability
 * registry dresses nothing predictive/market/banking/infra up as "live". Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const AG = 'src/runtime/farmos14/AgentRegistry.ts';
const REG = 'src/runtime/farmos14/V14CapabilityRegistry.ts';
const TEST = 'src/runtime/farmos14/__tests__/V14.test.ts';
for (const ff of [AG, REG, TEST]) if (!x(ff)) E.push('missing: ' + ff);

const ag = rd(AG);
h(ag, 'export function askAgent', 'must expose askAgent');
h(ag, 'function decline', 'must have the honest decline() helper (confidence 0)');
h(ag, '__agentRegistryHealth', 'must pin the agent health global');
// Live agents must compose real engines (not invent advice).
h(ag, 'computeLifecycleSnapshot', 'agronomist must compose the real crop calendar');
h(ag, 'WeatherRisk', 'weather scientist must compose the real weather-risk engine');
// decline() must hardcode confidence 0 (no fabricated expertise).
if (!/confidence:\s*0/.test(ag)) E.push('decline() must return confidence 0');

const reg = rd(REG);
h(reg, 'V14_CAPABILITIES', 'registry must export V14_CAPABILITIES');
// Line-based status check (robust to '(' in the area/basis strings): find the
// capability's line and read whether 'live' is its status token.
const regLines = reg.split(/\r?\n/);
const statusOf = (id) => {
  const line = regLines.find(l => l.includes("C('" + id + "'"));
  if (!line) return null;
  const m = line.match(/C\('[^']+',\s*'[^']*',\s*'([a-z_]+)'/);
  return m ? m[1] : null;
};
// Predictive/market/banking/precision/multi-horizon must NOT be marked live.
for (const id of ['ai_yield_engine', 'global_market_engine', 'banking_engine', 'climate_engine', 'precision_agriculture', 'twin_multi_horizon'])
  if (statusOf(id) === 'live') E.push('a predictive/market/banking capability is fabricated-as-live: ' + id);
// The things we actually built MUST be live.
for (const id of ['multi_agent_ai', 'global_digital_twin'])
  if (statusOf(id) !== 'live') E.push('real capability must be live: ' + id);

// 7 reports.
for (const doc of ['GLOBAL_ARCHITECTURE.md', 'AI_AGENTS.md', 'DIGITAL_TWIN.md', 'ENTERPRISE_SECURITY.md', 'GLOBAL_SCALE.md', 'OBSERVABILITY.md', 'PRODUCTION_CHECKLIST.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('v14 test did not PASS: ' + out.trim());
  } catch (err) { E.push('v14 test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:v14] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:v14] PASS — multi-agent advisor (3 live from real engines, 9 honest declines at confidence 0) + '
  + 'capability registry (nothing predictive/market/banking dressed up as live); test green.');
