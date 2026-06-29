/**
 * check-scan-id-benchmark.mjs — P0-1 release gate. Runs the scan-identification benchmark
 * vitest and locks its shape: a representative supported-crop set (>= 12) run through the
 * real consensus internals must yield confident named IDs at >= 95%, and weak/empty inputs
 * must stay non-confident. Prevents the pipeline-side "supported crop returns Unknown"
 * regression. (Real-image CV accuracy is out of scope — that needs the production scan.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const TEST = 'server/src/__tests__/scanIdentificationBenchmark.test.js';
if (!fs.existsSync(path.join(R, TEST))) E.push('missing: ' + TEST);

const t = rd(TEST);
if (!/toBeGreaterThanOrEqual\(0\.95\)/.test(t)) E.push('benchmark must assert >= 0.95 success rate');
if (!/_pickTopIdentification/.test(t)) E.push('benchmark must exercise the real _pickTopIdentification pipeline');
// At least 12 supported-crop rows so the >=95% bar is meaningful.
const rows = (t.match(/crop:\s*'/g) || []).length;
if (rows < 12) E.push('benchmark must cover >= 12 supported crops (found ' + rows + ')');

if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/scanIdentificationBenchmark.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('scan-id benchmark vitest did not pass:\n' + out.slice(-500));
  } catch (err) { E.push('scan-id benchmark vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-500)); }
}

if (E.length) { console.error('[check:scan-id-benchmark] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-id-benchmark] PASS — >=12 supported crops, confident provider data yields a confident named '
  + 'ID at >=95% through the real pipeline (no Unknown collapse); weak/empty stay non-confident; vitest green.');
