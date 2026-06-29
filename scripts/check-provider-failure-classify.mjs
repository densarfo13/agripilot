/**
 * check-provider-failure-classify.mjs — provider-failure classification (priority #3 provider
 * reliability) + runs its vitest. Locks: the classifier combines reason/status/error/message
 * and recovers an http_NNN status, and the per-scan metric writer passes ALL of those signals
 * (incl. plant.id's consensus.sources[].error) — so real failures are never silently UNKNOWN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG  = 'server/src/services/scan/certification/providerFailure.js';
const TEST = 'server/src/__tests__/providerFailureClassify.test.js';
const APP  = 'server/src/app.js';
for (const f of [ENG, TEST, APP]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const eng = rd(ENG);
if (!/\bi\.error\b/.test(eng) || !/\bi\.message\b/.test(eng)) E.push('classifier must combine error + message signals (not just reason/status)');
if (!eng.includes('http[_')) E.push('classifier must recover an http_NNN status from the text');

const app = rd(APP);
if (!/classifyProviderFailure\(\{[^]*?message:/.test(app)) E.push('app.js must pass message to classifyProviderFailure (timeout/abort signal)');
if (!/reason:\s*r\.reason\s*\|\|\s*r\.error/.test(app)) E.push('app.js must pass reason || error (consensus adapters use error)');
if (!/r\.sources/.test(app)) E.push('app.js must surface plant.id per-source errors (consensus.sources[].error)');

if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/providerFailureClassify.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('providerFailureClassify vitest did not pass:\n' + out.slice(-400));
  } catch (err) { E.push('providerFailureClassify vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-400)); }
}

if (E.length) { console.error('[check:provider-failure-classify] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:provider-failure-classify] PASS — provider failures classify into the right category '
  + '(http_NNN + timeout/network from message), across reason/error/message/sources; never silently UNKNOWN; vitest green.');
