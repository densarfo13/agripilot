/**
 * PilotCertification.test.ts — FARROWAY PILOT CERTIFICATION v1.0 verdict logic.
 * Self-running: `tsx PilotCertification.test.ts`. Proves the verdict is computed
 * (honestly capped at LIMITED_PILOT while live field evidence is PENDING) and
 * composes the real scan certification.
 */
import { certifyPilot, pilotCertificationHealth, assessPilotPhases } from '../PilotCertificationRuntime';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function eq(a: any, b: any, m: string) { if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}`); process.exit(1); } passed++; }

const phases = assessPilotPhases();
eq(phases.length, 7, '7 phases assessed');
ok(phases.find((p) => p.n === 1)?.status === 'partial', 'Phase 1 partial (live accuracy pending)');
ok(phases.find((p) => p.n === 2)?.status === 'certified', 'Phase 2 recommendation quality certified');
ok(phases.find((p) => p.n === 4)?.status === 'certified', 'Phase 4 trust engine certified');
ok(phases.find((p) => p.n === 7)?.status === 'certified', 'Phase 7 production gates certified');

const cert = certifyPilot();
eq(cert.verdict, 'LIMITED_PILOT', 'verdict honestly capped at LIMITED_PILOT (live field evidence pending)');
ok(cert.blockers.some((b) => /live crop-photo/i.test(b)), 'blocker names the live photo gap');
ok(cert.blockers.some((b) => /adoption/i.test(b)), 'blocker names missing farmer adoption data');

const h = pilotCertificationHealth();
eq(h.featureFreeze, true, 'feature freeze attested (mission)');
eq(h.liveFieldEvidence, 'PENDING', 'live field evidence is PENDING (never fabricated)');
ok(h.verdict !== 'READY_FOR_1000_FARMERS' && h.verdict !== 'READY_FOR_100_FARMERS', 'never over-claims readiness from sandbox');

console.log('[test:pilot-certification] PASS — ' + passed + ' assertions (verdict computed; field evidence PENDING, not faked).');
