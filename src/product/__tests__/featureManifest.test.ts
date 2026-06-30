/**
 * featureManifest.test.ts — locks the Feature Governor contract. Self-running: `tsx …`.
 */
import { REQUIRED_FIELDS, validateFeatureManifest, FEATURE_REGISTRY } from '../featureManifest.js';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// 12 required fields.
ok(REQUIRED_FIELDS.length === 12, 'exactly 12 governance fields');

// Every registered (real, shipped) feature has a complete manifest.
for (const [name, m] of Object.entries(FEATURE_REGISTRY)) {
  const r = validateFeatureManifest(m as any);
  ok(r.ok, `registered feature "${name}" has a complete manifest (missing: ${r.missing.join(',')})`);
}

// Validator rejects an incomplete manifest (the governance teeth).
const bad = validateFeatureManifest({ problem: 'a real farmer problem' } as any);
ok(!bad.ok && bad.missing.length === 11, 'incomplete manifest is rejected with the 11 missing fields listed');
ok(validateFeatureManifest(null as any).ok === false, 'null manifest → rejected, never throws');

// A field that is present but trivially short does not satisfy the contract.
ok(validateFeatureManifest({ ...FEATURE_REGISTRY.sellDecision, problem: '' } as any).missing.includes('problem'),
  'empty field counts as missing');

console.log('[featureManifest] PASS — ' + passed + ' assertions. 12-field contract; all registered features '
  + 'complete; incomplete/empty manifests rejected (never throws).');
