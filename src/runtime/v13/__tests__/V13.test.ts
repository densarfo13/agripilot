/**
 * V13.test.ts — Farroway v13. Self-running: `tsx V13.test.ts`.
 * Proves the honest core: the twin tracks last-known state and never fabricates a
 * forward estimate without a basis; the farm agent only acts on real signals and
 * never invents urgency; the capability registry dresses NOTHING predictive/market/
 * satellite up as "live".
 */
import { createTwinNode, applyScanToTwin, twinStaleness, rollUpHealth, digitalTwinHealth, TWIN_NODE_TYPES } from '../DigitalTwin';
import { buildMorningPlan, decideForNode, farmAgentHealth } from '../FarmAgent';
import { V13_CAPABILITIES, v13CapabilityHealth } from '../V13CapabilityRegistry';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── Digital Twin ──
ok(TWIN_NODE_TYPES.length === 8, 'twin supports the full 8-level hierarchy');
const plant = createTwinNode({ id: 'p1', type: 'plant', crop: 'maize' });
ok(plant.lastHealth === 'unknown' && plant.observationCount === 0, 'new node starts unknown/0 (no fabricated state)');
const scanned = applyScanToTwin(plant, { nodeId: 'p1', scanMs: 1000, health: 'watch' });
ok(scanned.observationCount === 1 && scanned.lastHealth === 'watch', 'scan updates last-known state');
ok(scanned.lastScanMs === 1000, 'scan records observation time');
// A forward estimate WITHOUT a basis is dropped (never fabricated).
const noBasis = applyScanToTwin(plant, { nodeId: 'p1', scanMs: 1000, estimatedHarvestDate: '2026-09-01' });
ok(noBasis.estimatedHarvestDate === null, 'forward estimate without a basis is NOT carried (no fabrication)');
// WITH a basis it is honestly carried.
const withBasis = applyScanToTwin(plant, { nodeId: 'p1', scanMs: 1000, estimatedHarvestDate: '2026-09-01', estimateBasis: 'crop-calendar' });
ok(withBasis.estimatedHarvestDate === '2026-09-01' && withBasis.estimateBasis === 'crop-calendar', 'estimate carried only WITH a named basis');
ok(twinStaleness(plant, 5000) === 'never_scanned', 'staleness honest for never-scanned');
ok(twinStaleness(scanned, 1000 + 40 * 86400000) === 'stale', 'staleness is elapsed-time only');
ok(rollUpHealth([scanned, plant]) === 'watch', 'roll-up returns worst OBSERVED health');
const th = digitalTwinHealth();
ok(th.predictionNeverFabricated === true, 'twin health attests no fabricated prediction');

// ── Farm Agent ──
const frost = decideForNode({ nodeId: 'a', frostRiskNext48h: true });
ok(frost.priority === 'now' && frost.evidence.length > 0, 'frost risk → now, with evidence');
const harvest = decideForNode({ nodeId: 'b', daysToHarvest: 0 });
ok(harvest.action === 'harvest', 'calendar at harvest → harvest action');
const blank = decideForNode({ nodeId: 'c' });
ok((blank.action === 'wait' || blank.action === 'inspect') && blank.priority !== 'now', 'no signal → honest hold/inspect, never fabricated urgency');
const plan = buildMorningPlan([{ nodeId: 'a' }, { nodeId: 'b', frostRiskNext48h: true }]);
ok(plan[0].priority === 'now', 'morning plan sorts most-urgent first');
ok(plan.every(d => d.evidence.length > 0 && typeof d.reason === 'string'), 'every decision carries evidence + reason');
const ah = farmAgentHealth();
ok(ah.noSignalNeverFabricated === true && ah.prioritized === true, 'agent health attests honest prioritization');

// ── Capability Registry ──
ok(V13_CAPABILITIES.length >= 20, 'registry covers the full v13 ask (' + V13_CAPABILITIES.length + ' capabilities)');
ok(V13_CAPABILITIES.every(c => c.basis && c.basis.length > 10), 'every capability names a real basis or requirement');
// Nothing predictive/market/satellite is marked live.
const live = new Set(V13_CAPABILITIES.filter(c => c.status === 'live').map(c => c.id));
for (const id of ['market_ai', 'satellite_layer', 'drone_layer', 'disease_prediction', 'pest_forecasting', 'carbon_engine', 'biodiversity_engine'])
  ok(!live.has(id), 'not fabricated-as-live: ' + id);
// The things we DID build are live.
for (const id of ['digital_twin', 'farm_agent', 'scan_v12'])
  ok(live.has(id), 'real capability marked live: ' + id);
const ch = v13CapabilityHealth();
ok(ch.nothingFabricatedAsLive === true, 'registry health attests nothing fabricated as live');
ok(ch.total === V13_CAPABILITIES.length, 'health total matches registry');

console.log('[test:v13] PASS — ' + passed + ' assertions (twin no-fabricated-prediction; agent honest urgency; registry declares the truth — nothing predictive/market/satellite dressed up as live).');
