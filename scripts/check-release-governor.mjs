/**
 * check-release-governor.mjs — Release Governor gate.
 *
 * Runs the governor in CI (it exits non-zero only on BLOCKED), then verifies the
 * 5 scorecards exist and the verdict logic is honest: block rules can BLOCK, warn
 * rules only WARN, and the verdict is computed (not hardcoded PASS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

if (!x('scripts/release-governor.mjs')) E.push('missing: scripts/release-governor.mjs');
const gov = rd('scripts/release-governor.mjs');
// Honest verdict logic: must distinguish BLOCKED / PASS_WITH_WARNINGS / PASS.
for (const v of ['BLOCKED', 'PASS_WITH_WARNINGS', 'PASS'])
  if (!gov.includes("'" + v + "'")) E.push('governor must define the ' + v + ' verdict');
if (!/blockedFails\.length\s*\?\s*'BLOCKED'/.test(gov))
  E.push('governor must BLOCK only on block-rule failures (warn rules must not block)');
if (!/secureNoSecretLeak/.test(gov)) E.push('governor must include a secret-leak (Rule 10) check');

// Run the governor — it writes the scorecards + exits 1 only if BLOCKED.
if (E.length === 0) {
  try {
    const out = execSync('node scripts/release-governor.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/VERDICT:/.test(out)) E.push('governor did not emit a verdict');
    if (/VERDICT: BLOCKED/.test(out)) E.push('release is BLOCKED by the governor: ' + out.split('\n').find((l) => /BLOCKED/.test(l)));
  } catch (err) {
    E.push('governor reported BLOCKED / failed: ' + ((err && (err.stdout || err.message)) || '?'));
  }
}

// The 5 scorecards must exist (the governor writes them).
for (const doc of ['RELEASE_SCORECARD.md', 'PERFORMANCE_SCORECARD.md',
  'RELIABILITY_SCORECARD.md', 'TRUST_SCORECARD.md', 'PILOT_GATE_REPORT.md'])
  if (!x(doc)) E.push('missing scorecard: ' + doc);
// The release scorecard must carry a computed verdict.
if (x('RELEASE_SCORECARD.md') && !/Verdict:\s*(PASS|PASS_WITH_WARNINGS|BLOCKED)/.test(rd('RELEASE_SCORECARD.md')))
  E.push('RELEASE_SCORECARD must carry the computed verdict');

if (E.length) {
  console.error('[check:release-governor] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:release-governor] PASS — governor runs (not BLOCKED); 5 scorecards present; '
  + 'honest verdict logic (block rules block, field-evidence rules warn).');
