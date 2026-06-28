/**
 * check-outcome-rank.mjs — locks the recommendation-ranking fix (evidence integrity) +
 * runs its vitest. Guards against the comparator regressing to `|| -1`, which collapses a
 * proven 0% success rate into the same rank as an unknown one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG = 'server/src/ml/outcomeIntelligenceEngine.js';
const TEST = 'server/src/__tests__/outcomeRank.test.js';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const s = rd(ENG);
if (!s.includes('function _rankBySuccess(')) E.push('must define the _rankBySuccess comparator');
if (!/_internal\s*=\s*Object\.freeze\(\{[^]*_rankBySuccess/.test(s)) E.push('_rankBySuccess must be exported via _internal (for testing)');
// Regression guard: the comparator must use ?? not || (|| masks a legitimate 0).
if (/successRate\s*\|\|\s*-?\d/.test(s)) {
  E.push("ranking regressed to `successRate || N` — use ?? so a proven 0% is not tied with unknown");
}

if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/outcomeRank.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('outcomeRank vitest did not pass:\n' + out.slice(-400));
  } catch (err) { E.push('outcomeRank vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-400)); }
}

if (E.length) { console.error('[check:outcome-rank] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:outcome-rank] PASS — recommendation ranking uses ?? so a proven 0% success rate ranks above an '
  + 'unknown (not tied with it); vitest green.');
