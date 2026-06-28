/**
 * check-scan-confidence-normalize.mjs — the overloaded-confidence normalizer (priority #1
 * scan identification) + runs its test. Locks: the normalizer exists, ScanCommandCard uses
 * it (not the raw `_num(result.confidence)` that mis-rendered string-tone confidence), and
 * the reproducing test stays green.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const F = 'src/runtime/scan/confidence/normalizeScanConfidence.ts';
const T = 'src/runtime/scan/confidence/__tests__/NormalizeScanConfidence.test.ts';
const CARD = 'src/components/scan/ScanCommandCard.jsx';
for (const f of [F, T, CARD]) if (!x(f)) E.push('missing: ' + f);

const s = rd(F);
h(s, 'export function normalizeScanConfidence', 'must export normalizeScanConfidence');
h(s, 'export function bandFromPct', 'must export bandFromPct');

// The consumer must USE the normalizer — guard against regressing to the raw `_num` read
// that swallowed string-tone confidence.
const card = rd(CARD);
h(card, 'normalizeScanConfidence', 'ScanCommandCard must use normalizeScanConfidence');
if (/const\s+confidencePct\s*=\s*_num\(\s*result\.confidence\s*\)/.test(card)) {
  E.push('ScanCommandCard regressed to _num(result.confidence) — string-tone confidence renders as low');
}

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + T, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('normalize test did not PASS: ' + out.trim());
  } catch (err) { E.push('normalize test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:scan-confidence-normalize] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-confidence-normalize] PASS — confidence normalizer resolves string-tone / 0–1 float / '
  + '0–100 number to an honest { pct, band }; ScanCommandCard uses it; reproducing test green.');
