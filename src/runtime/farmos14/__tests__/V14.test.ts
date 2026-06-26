/**
 * V14.test.ts — Farroway v14. Self-running: `tsx V14.test.ts`.
 * Proves the multi-agent panel is honest (live agents advise from real engines;
 * the rest decline with confidence 0, never fabricated expertise) and the
 * capability registry dresses nothing predictive/market/banking up as "live".
 */
import { listAgents, askAgent, askAllAgents, agentRegistryHealth } from '../AgentRegistry';
import { V14_CAPABILITIES, v14CapabilityHealth } from '../V14CapabilityRegistry';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── Multi-Agent Advisor ──
ok(listAgents().length === 12, 'twelve specialist agents registered');
const ctx = { crop: 'maize', plantingDate: '2026-05-01', nowMs: 1, weather: { tempC: 30 }, soil: { ph: 6.2, moisture: 18 } };

// Live agents give REAL advice with evidence.
const agro: any = askAgent('agronomist', ctx);
ok(agro && agro.basis === 'live' && agro.evidence.length > 0, 'agronomist advises live with evidence');
ok(agro.confidence > 0, 'agronomist has real confidence when it has a basis');
const soil: any = askAgent('soil_scientist', ctx);
ok(soil.basis === 'live' && /lab test/i.test(soil.evidence.join(' ')), 'soil scientist names lab test for N/P/K (not fabricated)');

// Declining agents NEVER fabricate — confidence 0, but still explain + offer an alternative.
for (const id of ['plant_pathologist', 'entomologist', 'market_analyst', 'financial_advisor', 'carbon_advisor', 'biodiversity_advisor']) {
  const a: any = askAgent(id, ctx);
  ok(a && a.confidence === 0, id + ' declines with confidence 0 (no fabricated expertise)');
  ok(a.evidence.length > 0 && !!a.alternative && /expert|officer|specialist/i.test(a.alternative), id + ' still explains + points to a human');
}

// Every agent in the full panel explains reason/evidence/confidence/alternative.
const panel: any = askAllAgents(ctx);
ok(panel.length === 12, 'full panel returns all agents');
ok(panel.every((p: any) => typeof p.reason === 'string' && p.evidence.length > 0 && typeof p.confidence === 'number' && !!p.alternative), 'every advice has reason+evidence+confidence+alternative');
ok(askAgent('nonexistent', ctx) === null, 'unknown agent → null (not a fabricated answer)');

const ah = agentRegistryHealth();
ok(ah.live === 3 && ah.declinesNeverFabricateConfidence === true, 'agent health attests 3 live + declines never fabricate');

// ── Capability Registry ──
ok(V14_CAPABILITIES.length >= 16, 'registry covers the v14 domain/infra asks (' + V14_CAPABILITIES.length + ')');
ok(V14_CAPABILITIES.every(c => c.basis && c.basis.length > 10), 'every capability names a basis or requirement');
const live = new Set(V14_CAPABILITIES.filter(c => c.status === 'live').map(c => c.id));
for (const id of ['ai_yield_engine', 'global_market_engine', 'banking_engine', 'climate_engine', 'precision_agriculture', 'twin_multi_horizon'])
  ok(!live.has(id), 'not fabricated-as-live: ' + id);
for (const id of ['multi_agent_ai', 'global_digital_twin'])
  ok(live.has(id), 'real capability marked live: ' + id);
const ch = v14CapabilityHealth();
ok(ch.nothingFabricatedAsLive === true, 'registry health attests nothing fabricated as live');

console.log('[test:v14] PASS — ' + passed + ' assertions (3 live agents advise from real engines; 9 decline with confidence 0; registry declares the truth — nothing predictive/market/banking dressed up as live).');
