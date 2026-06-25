/**
 * EnterpriseCertification.test.ts — Phases 2/3 quality engines + 13-phase verdict.
 * Self-running: `tsx EnterpriseCertification.test.ts`.
 */
import { scoreDataQuality } from '../DataQualityEngine';
import { assessDecisionQuality, rejectWeakRecommendations } from '../DecisionQualityEngine';
import { certifyEnterprise, enterpriseCertificationHealth } from '../EnterpriseCertificationRuntime';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function eq(a: any, b: any, m: string) { if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}`); process.exit(1); } passed++; }

// Phase 2 — data quality.
const rich = scoreDataQuality({ crop: 'Onion', plantingDate: '2026-05-01', location: {}, hasScan: true,
  scanCount: 3, taskCount: 2, lastUpdatedAt: 100, nowMs: 100, farmBrainState: { hasFirstScan: true, confidence: 85 } });
eq(rich.band, 'high', 'rich, fresh data → HIGH quality');
ok(!rich.recommendNextScan, 'high quality does not nag a rescan');
const thin = scoreDataQuality({});
eq(thin.band, 'low', 'no data → LOW quality');
ok(thin.recommendNextScan, 'low quality → recommend next scan');
ok(/scan/i.test(thin.reason), 'low-quality reason points to scanning');

// Phase 3 — decision quality rejects weak, accepts strong.
const strongRec = { action: 'Inspect 10 onion plants', reason: 'Scan showed mild leaf stress.',
  evidence: ['✓ Onion'], crop: 'Onion', stage: 'vegetative', weatherAware: true, confidence: 88,
  expectedBenefit: 'Prevents yield loss.', timeRequiredMin: 4 };
ok(assessDecisionQuality(strongRec).passes, 'complete, evidenced recommendation passes');
ok(assessDecisionQuality({ action: 'Check your crop' }).passes === false, 'generic recommendation rejected');
ok(assessDecisionQuality({ action: 'Spray', reason: 'x', confidence: 0 }).passes === false, 'no confidence → rejected');
ok(assessDecisionQuality({ action: 'Spray now', reason: 'thrips detected on leaves', confidence: 80,
  expectedBenefit: 'saves crop', timeRequiredMin: 10, contradicts: true }).passes === false, 'contradiction → rejected');
eq(rejectWeakRecommendations([strongRec, { action: 'Check your crop' } as any]).length, 1, 'filter keeps only strong recs');

// 13-phase verdict — computed, honestly capped.
const cert = certifyEnterprise();
eq(cert.phases.length, 13, '13 phases assessed');
eq(cert.verdict, 'LIMITED_PILOT', 'verdict honestly capped at LIMITED_PILOT');
ok(cert.phases.find((p) => p.n === 8)?.status === 'honest_null', 'Phase 8 business is honest_null (no fabrication)');
const h = enterpriseCertificationHealth();
eq(h.liveFieldEvidence, 'PENDING', 'live field evidence PENDING (never fabricated)');
ok(h.verdict !== 'READY_FOR_GLOBAL_SCALE' && h.verdict !== 'READY_FOR_NATIONAL_DEPLOYMENT', 'never over-claims from sandbox');

console.log('[test:enterprise-certification] PASS — ' + passed + ' assertions (data+decision quality real; verdict capped honestly).');
