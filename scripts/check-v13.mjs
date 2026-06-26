/**
 * check-v13.mjs — Farroway v13 honesty gate.
 *
 * Enforces: the digital twin never carries a forward estimate without a basis;
 * the farm agent never fabricates urgency; and the capability registry dresses
 * NOTHING predictive/market/satellite/drone/carbon up as "live". Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const TWIN = 'src/runtime/v13/DigitalTwin.ts';
const AGENT = 'src/runtime/v13/FarmAgent.ts';
const REG = 'src/runtime/v13/V13CapabilityRegistry.ts';
const TEST = 'src/runtime/v13/__tests__/V13.test.ts';
for (const ff of [TWIN, AGENT, REG, TEST]) if (!x(ff)) E.push('missing: ' + ff);

const twin = rd(TWIN);
h(twin, 'applyScanToTwin', 'twin must expose applyScanToTwin');
h(twin, 'hasBasis', 'twin must drop a forward estimate that lacks a named basis');
h(twin, '__digitalTwinHealth', 'twin must pin its health global');

const agent = rd(AGENT);
h(agent, 'buildMorningPlan', 'agent must expose buildMorningPlan');
h(agent, '__farmAgentHealth', 'agent must pin its health global');

const reg = rd(REG);
h(reg, 'V13_CAPABILITIES', 'registry must export V13_CAPABILITIES');
// The honesty rule, statically: market/satellite/drone/disease-prediction/pest/
// carbon/biodiversity must NOT be marked 'live'.
const liveRe = /C\('(market_ai|satellite_layer|drone_layer|disease_prediction|pest_forecasting|carbon_engine|biodiversity_engine)',[^)]*'live'/;
if (liveRe.test(reg)) E.push('a predictive/market/satellite/carbon capability is fabricated-as-live');
// And the things we actually built MUST be live.
for (const id of ['digital_twin', 'farm_agent', 'scan_v12'])
  if (!new RegExp("C\\('" + id + "',[^)]*'live'").test(reg)) E.push('real capability must be marked live: ' + id);

// 6 reports.
for (const doc of ['V13_ARCHITECTURE.md', 'DIGITAL_TWIN.md', 'GLOBAL_AI.md', 'ENTERPRISE_SCALE.md', 'PRODUCTION_READINESS.md', 'WORLD_CLASS_REPORT.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('v13 test did not PASS: ' + out.trim());
  } catch (err) { E.push('v13 test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:v13] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:v13] PASS — digital twin (no fabricated prediction) + farm agent (honest urgency) + capability '
  + 'registry (nothing predictive/market/satellite dressed up as live); test green.');
