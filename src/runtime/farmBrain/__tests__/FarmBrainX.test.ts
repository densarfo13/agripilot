/**
 * FarmBrainX.test.ts — FarmBrain X certification verdict logic.
 * Self-running: `tsx FarmBrainX.test.ts`. Proves the verdict is COMPUTED from
 * section statuses (not hardcoded) and that §4's cost/risk bands stay honest.
 */
import { certifyFarmBrainX, FARMBRAIN_X_SECTIONS, SectionCert } from '../FarmBrainXRuntime';
import { recommendation } from '../FarmBrainStateContracts';

let passed = 0;
function eq(a: any, b: any, m: string) {
  if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); process.exit(1); }
  passed++;
}
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// Current honest reality → LIMITED_PILOT.
const now = certifyFarmBrainX();
eq(now.verdict, 'LIMITED_PILOT', 'current state certifies LIMITED_PILOT');
ok(now.reasons.length > 0, 'limited pilot lists honest blockers');
ok(now.counts.honest_null >= 2, 'market + funding counted as honest_null');

// Flip consensus + pilot to ready → READY_FOR_100_FARMERS.
const set = (name: string, status: SectionCert['status'], list: SectionCert[]) =>
  list.map((s) => (s.name === name ? { ...s, status } : s));
let scaled = FARMBRAIN_X_SECTIONS.slice() as SectionCert[];
scaled = set('Multi-Provider Consensus', 'ready', scaled);
scaled = set('Pilot Acceptance', 'ready', scaled);
eq(certifyFarmBrainX(scaled).verdict, 'READY_FOR_100_FARMERS', 'consensus+pilot ready → 100 farmers');

// + market + funding live → READY_FOR_SCALE.
scaled = set('Market Engine', 'ready', scaled);
scaled = set('Funding Engine', 'ready', scaled);
eq(certifyFarmBrainX(scaled).verdict, 'READY_FOR_SCALE', 'all live → READY_FOR_SCALE');

// A missing CORE section → NOT_READY.
const broken = set('Trust & Safety', 'missing', FARMBRAIN_X_SECTIONS.slice() as SectionCert[]);
eq(certifyFarmBrainX(broken).verdict, 'NOT_READY', 'missing core → NOT_READY');

// §4 — cost/risk bands are honest; an invalid band becomes null (never fabricated).
const r = recommendation({ action: 'Spray', reason: 'thrips', confidence: 90,
  cost: 'low' as any, risk: 'high' as any, nextReviewDate: '2026-07-01' });
eq(r.cost, 'low', 'valid cost band kept');
eq(r.risk, 'high', 'valid risk band kept');
eq(r.nextReviewDate, '2026-07-01', 'next review date kept');
const bad = recommendation({ action: 'x', cost: '₵500' as any, risk: 'apocalyptic' as any });
eq(bad.cost, null, 'invalid cost → null (no fabricated currency)');
eq(bad.risk, null, 'invalid risk → null');

console.log('[test:farmbrain-x] PASS — ' + passed + ' assertions (verdict computed, bands honest).');
