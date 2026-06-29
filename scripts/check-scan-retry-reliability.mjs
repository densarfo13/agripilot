/**
 * check-scan-retry-reliability.mjs — Scan Reliability: provider-interaction resilience.
 * Locks the retry primitive's terminal/transient discipline + runs its 9-mode regression.
 * Resilience rule: retrying a terminal failure (auth/credits/malformed/empty) cannot
 * succeed and wastes the farmer's time — the engine must give up immediately on those.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG  = 'src/core/scan/scanRetryEngine.js';
const TEST = 'src/core/scan/__tests__/scanRetryEngine.test.ts';
for (const f of [ENG, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const eng = rd(ENG);
if (!eng.includes('export function isRetriableScanFailure')) E.push('must export isRetriableScanFailure');
if (!/shouldRetry/.test(eng)) E.push('withScanRetry must honor a shouldRetry predicate');
if (!/gaveUp/.test(eng)) E.push('terminal failures must mark the verdict (gaveUp)');
// The predicate must treat auth/credits/malformed/empty as terminal (return false).
for (const term of ['unauthor', 'credit', 'malformed', 'candidate'])
  if (!eng.includes(term)) E.push('isRetriableScanFailure missing terminal class: ' + term);

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('scan-retry test did not PASS: ' + out.trim());
  } catch (err) { E.push('scan-retry test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:scan-retry-reliability] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-retry-reliability] PASS — transient failures (timeout/network/5xx/429) retry; terminal '
  + '(auth/credits/malformed/empty) give up immediately; cancellation honored; never throws/fabricates; test green.');
