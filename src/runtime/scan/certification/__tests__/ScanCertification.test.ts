/**
 * ScanCertification.test.ts — deterministic scan-pipeline certification.
 * Self-running: `tsx ScanCertification.test.ts`. Exercises the REAL ingestion
 * gate + classifier (no mocks). Covers Phase 3 (resilience), Phase 4 (confidence
 * degrades with evidence), Phase 5 (unknown/non-plant rejection).
 */
import { runSafetyCertifications, scanCertificationHealth, PROVIDER_CERT } from '../ScanCertificationRuntime';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function eq(a: any, b: any, m: string) { if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}`); process.exit(1); } passed++; }

const s = runSafetyCertifications();
ok(s.strongScanIngests, 'strong scan (known + ≥70% + trust + auth) ingests');
ok(s.weakScanHeld, 'weak scan (low confidence) is HELD, not ingested');           // Phase 4
ok(s.unknownPlantHeld, 'unknown plant is HELD (plant_unknown blocker)');           // Phase 5
ok(s.providerFailureDoesNotIngest, 'a provider failure does not ingest (no crash)'); // Phase 3
ok(s.nonPlantRejected, 'non-plant objects (shoe/person/table/wall/vehicle) → not a supported plant'); // Phase 5
ok(s.confidenceDegradesWithEvidence, 'confidence degrades as evidence decreases'); // Phase 4

// Sentinel Hub honestly reported as not integrated (no fabricated provider).
const sentinel = PROVIDER_CERT.find((p) => p.provider === 'sentinel_hub');
eq(sentinel?.verdict, 'NOT_INTEGRATED', 'Sentinel Hub honestly NOT_INTEGRATED');

// Overall certification: live accuracy is PENDING (never fabricated); verdict is
// READY_FOR_PILOT (not PRODUCTION_READY) until the operator photo run lands.
const cert = scanCertificationHealth();
ok(cert.safetyCertified === true, 'deterministic safety certified');
eq(cert.liveProviderAccuracy, 'PENDING_OPERATOR_RUN', 'live accuracy is PENDING, never fabricated');
eq(cert.overall, 'READY_FOR_PILOT', 'overall READY_FOR_PILOT (not PRODUCTION_READY from sandbox)');
ok(cert.blockers.some((b: string) => /Sentinel/i.test(b)), 'blockers name the Sentinel gap honestly');

console.log('[test:scan-certification] PASS — ' + passed + ' assertions (real ingestion+classifier; live accuracy PENDING, not faked).');
