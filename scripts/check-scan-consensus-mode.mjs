/**
 * check-scan-consensus-mode.mjs — locks the server consensusMode fix (priority #3 provider
 * reliability) + runs its vitest. Guards against the both-failed early return regressing to
 * the key-based ternary that mislabeled a total failure as 'multi'/'single'.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG = 'server/src/ml/scanConsensusEngine.js';
const TEST = 'server/src/__tests__/scanConsensusMode.test.js';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const s = rd(ENG);
if (!s.includes('function _consensusMode(')) E.push('must define the _consensusMode helper');
if (!/_internal\s*=\s*Object\.freeze\(\{[^]*_consensusMode/.test(s)) E.push('_consensusMode must be exported via _internal (for testing)');
// The both-failed early return must use the helper, NOT the old key-based ternary.
if (/consensusMode:\s*havePlantId\s*&&\s*havePlantNet\s*\?/.test(s)) {
  E.push("both-failed early return regressed to the key-based ternary — use _consensusMode(pidParsed, pntParsed)");
}

if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/scanConsensusMode.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('consensusMode vitest did not pass:\n' + out.slice(-400));
  } catch (err) { E.push('consensusMode vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-400)); }
}

if (E.length) { console.error('[check:scan-consensus-mode] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-consensus-mode] PASS — consensusMode derives from PARSED results (not configured keys) via one '
  + 'shared helper; a both-failed scan reports rule, not multi/single; vitest green.');
