/**
 * check-scan-candidate-merge.mjs — locks the candidate-merge common-name fix (priority #1
 * scan identification) + runs its vitest. A low-literacy farmer must never lose the
 * human-readable common name just because the higher-scoring provider returned only a
 * Latin name for the same species.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG = 'server/src/ml/scanConsensusEngine.js';
const TEST = 'server/src/__tests__/scanCandidateMerge.test.js';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const s = rd(ENG);
if (!s.includes('function _withBestCommonName(')) E.push('must define _withBestCommonName (the common-name backfill)');
if (!s.includes('_withBestCommonName(winner, loser)')) E.push('_mergeCandidates must backfill the common name onto the higher-score winner');
// PlantNet candidates + top-pick must be chosen by SCORE, not array position.
if (!s.includes('function _sortedPlantnetResults(')) E.push('must define _sortedPlantnetResults (choose by score, not array position)');
if (!/_plantnetCandidates[^]*?_sortedPlantnetResults\(parsed\)\.slice\(0, 5\)/.test(s))
  E.push('_plantnetCandidates must slice the SORTED results (top-5 by score)');
if (!/_pickTopIdentification[^]*?_sortedPlantnetResults\(plantNetParsed\)\[0\]/.test(s))
  E.push('_pickTopIdentification must pick the highest-score PlantNet result, not results[0] by position');

if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/scanCandidateMerge.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('candidate-merge vitest did not pass:\n' + out.slice(-400));
  } catch (err) { E.push('candidate-merge vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-400)); }
}

if (E.length) { console.error('[check:scan-candidate-merge] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-candidate-merge] PASS — merging two providers keeps the higher score AND a human-readable '
  + 'common name (never collapses to the Latin name); never fabricates a name; vitest green.');
