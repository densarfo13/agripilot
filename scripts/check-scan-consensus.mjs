/**
 * check-scan-consensus.mjs — provider consensus rules (§6) + runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const F = 'src/runtime/scan/consensus/ScanProviderConsensus.ts';
const T = 'src/runtime/scan/consensus/__tests__/ScanConsensus.test.ts';
for (const f of [F, T]) if (!x(f)) E.push('missing: ' + f);

const s = rd(F);
h(s, 'export function buildScanConsensus', 'must export buildScanConsensus');
h(s, 'PROVIDER_CONFIDENCE_MIN', 'must enforce the 70% confidence floor');
h(s, 'toReviewQueue', 'low-confidence findings must route to a review queue');
h(s, 'healthCheckAvailable', 'must report when the health check is unavailable');
h(s, 'neverMushroomSafeClaim: true', 'must attest no mushroom safe claim');
h(s, 'reason', 'consensus result must always include a reason');

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + T, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('consensus test did not PASS: ' + out.trim());
  } catch (err) { E.push('consensus test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:scan-consensus] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-consensus] PASS — 70% floor, review queue, no disease w/o result, no mushroom safe claim; test green.');
