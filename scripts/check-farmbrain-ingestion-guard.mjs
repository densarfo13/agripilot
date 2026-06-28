/**
 * check-farmbrain-ingestion-guard.mjs — Quality Gate: "never update the Digital Twin
 * from a failed scan." Verifies the ingestion guard blocks every failure mode, the
 * plant-known check is in its refactor-safe (non-precedence-trap) form, and runs the test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const ENG = 'src/runtime/farmBrain/FarmBrainScanIngestion.ts';
const TEST = 'src/runtime/farmBrain/__tests__/FarmBrainScanIngestion.test.ts';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const eng = rd(ENG);

// Every failure mode must be a blocker.
for (const b of ['plant_unknown', 'confidence_below_70', 'trust_gate_failed', 'provider_auth_failed',
                 'photo_quality_failed', 'review_only', 'provider_unavailable'])
  has(eng, "'" + b + "'", 'ingestion guard must block on ' + b);

// shouldIngest only when there are NO blockers.
has(eng, 'blockers.length === 0', 'must ingest only when there are zero blockers');

// The plant-known check must be the refactor-safe form (no mixed &&/?: precedence trap).
has(eng, 'const nameKnown =', 'plantKnown must use the explicit refactor-safe form (nameKnown && candidatesNotEmpty)');
has(eng, 'candidatesNotEmpty', 'plantKnown must guard against an empty candidate list explicitly');
if (/!unknownTokens\.includes\(plantName\)\s*\n?\s*&&\s*Array\.isArray\([^)]*\)\s*\?/.test(eng))
  E.push('plantKnown still uses the && / ?: precedence trap — use the explicit form');

// Run the test.
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('farmbrain-ingestion test did not PASS: ' + out.trim());
  } catch (err) { E.push('farmbrain-ingestion test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:farmbrain-ingestion-guard] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farmbrain-ingestion-guard] PASS — the Digital Twin ingests ONLY a confident, known, trusted scan; '
  + 'every failure mode (unknown / low-confidence / trust-failed / auth-failed / bad-photo / review-only / provider-down) is held; '
  + 'plant-known check is refactor-safe; test green.');
