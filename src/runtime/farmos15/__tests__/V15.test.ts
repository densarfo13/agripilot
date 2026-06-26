/**
 * V15.test.ts — Farroway v15. Self-running: `tsx V15.test.ts`.
 * Proves the Farmer Copilot routes real questions to real engines and DECLINES
 * profit (confidence 0, never a fabricated number), and the capability registry
 * dresses nothing optimization/financial/soil-lab up as "live".
 */
import { askCopilot, classifyQuestion, farmerCopilotHealth } from '../FarmerCopilot';
import { V15_CAPABILITIES, v15CapabilityHealth } from '../V15CapabilityRegistry';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── Intent routing (deterministic + explainable) ──
ok(classifyQuestion('what should I do today?') === 'today_plan', 'routes today plan');
ok(classifyQuestion('when should I harvest my maize?') === 'harvest_timing', 'routes harvest timing');
ok(classifyQuestion('will rain affect spraying?') === 'spray_weather', 'routes spray weather');
ok(classifyQuestion('why is my maize yellow?') === 'diagnose_plant', 'routes diagnose');
ok(classifyQuestion('estimate my profit') === 'profit_estimate', 'routes profit');
ok(classifyQuestion('asdf qwerty') === 'help', 'unknown → help (not a fabricated answer)');

// ── Real answers from real engines ──
const today: any = askCopilot('what should I do today?', { crop: 'maize' });
ok(today.canAnswer === true && today.evidence.length > 0, 'today plan answers with evidence');
const harvest: any = askCopilot('when should I harvest?', { crop: 'maize', plantingDate: '2026-05-01', nowMs: Date.now() });
ok(harvest.intent === 'harvest_timing' && !!harvest.source, 'harvest routes to crop calendar');
const harvestNoDate: any = askCopilot('when should I harvest?', { crop: 'maize' });
ok(harvestNoDate.canAnswer === false && /planting date/i.test(harvestNoDate.answer), 'harvest without planting date → honest ask, not a guess');

// ── Honest declines (NEVER fabricate) ──
const profit: any = askCopilot('estimate my profit this season', {});
ok(profit.canAnswer === false && profit.confidence === 0, 'profit is declined at confidence 0 (never fabricated)');
ok(/won.?t guess|prices|costs/i.test(profit.answer) && !!profit.alternative, 'profit decline explains + offers an alternative');
const diagnose: any = askCopilot('why is my maize yellow?', {});
ok(diagnose.canAnswer === false && /photo|scan/i.test(diagnose.answer), 'diagnose routes to a photo scan (not a worded guess)');

// Every reply is explainable.
for (const q of ['what should I do today?', 'will rain affect spraying?', 'estimate my profit', 'asdf']) {
  const r: any = askCopilot(q, { crop: 'maize', weather: { tempC: 30 } });
  ok(r.evidence.length > 0 && !!r.source && !!r.alternative && typeof r.confidence === 'number', 'explainable reply: ' + q);
}

const ch = farmerCopilotHealth();
ok(ch.routesSampleQuestions === true && ch.profitNeverFabricated === true, 'copilot health attests routing + profit-never-fabricated');

// ── Capability Registry ──
ok(V15_CAPABILITIES.length >= 14, 'registry covers the v15 asks (' + V15_CAPABILITIES.length + ')');
ok(V15_CAPABILITIES.every(c => c.basis && c.basis.length > 10), 'every capability names a basis');
const live = new Set(V15_CAPABILITIES.filter(c => c.status === 'live').map(c => c.id));
for (const id of ['farmbrain_optimization', 'autonomous_roi_plan', 'digital_soil_lab', 'financial_engine', 'disease_surveillance'])
  ok(!live.has(id), 'not fabricated-as-live: ' + id);
for (const id of ['farmer_copilot', 'farmbrain_daily_plan'])
  ok(live.has(id), 'real capability marked live: ' + id);
ok(v15CapabilityHealth().nothingFabricatedAsLive === true, 'registry health attests nothing fabricated as live');

console.log('[test:v15] PASS — ' + passed + ' assertions (copilot routes real questions to real engines; profit/diagnose decline honestly; registry declares the truth).');
