/**
 * check-evidence-conflict.mjs — cross-source ConflictEngine (FIP).
 * Locks: the engine only flags a TRUE opposite-polarity disagreement between DIFFERENT
 * sources (never a false alarm), recommends verification (never picks one), and is
 * surfaced as a self-hiding advisory on the scan result. Runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/intelligence/evidenceConflict.ts';
const TEST = 'src/runtime/intelligence/__tests__/evidenceConflict.test.ts';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const eng = rd(ENG);

has(eng, 'export function detectEvidenceConflict', 'must export detectEvidenceConflict');
has(eng, "recommendation: 'verify'", 'a conflict must recommend verify (never pick one side)');
has(eng, 'a.source === b.source', 'must require DIFFERENT sources (a source cannot conflict with itself)');
has(eng, 'OPPOSITES', 'must only flag opposite-polarity claims (no false alarms on agreement)');

// Surfaced as a self-hiding advisory on the scan result.
const card = rd('src/components/scan/ScanResultCard.jsx');
has(card, 'detectEvidenceConflict', 'ScanResultCard must consume detectEvidenceConflict');
has(card, 'data-testid="scan-evidence-conflict"', 'ScanResultCard must render the conflict advisory');
if (!/!_cf\.hasConflict\) return null/.test(card)) E.push('conflict advisory must self-hide when there is no conflict');

// Run the test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('evidence-conflict test did not PASS: ' + out.trim());
  } catch (err) { E.push('evidence-conflict test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:evidence-conflict] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:evidence-conflict] PASS — cross-source conflicts (opposite claims from different sources) are surfaced + recommend verification; '
  + 'agreement / single-source never false-alarm; self-hiding advisory on the scan result; test green.');
