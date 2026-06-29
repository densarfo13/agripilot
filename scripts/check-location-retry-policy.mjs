/**
 * check-location-retry-policy.mjs — GPS acquisition reliability (priority #2 location
 * detection) + runs its test. Locks: a pure retry policy exists, getCurrentPosition gained
 * an automatic balanced-accuracy retry via acquireLocation, and the main flow uses it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const POL  = 'src/runtime/location/locationRetryPolicy.ts';
const TEST = 'src/runtime/location/__tests__/LocationRetryPolicy.test.ts';
const GEO  = 'src/utils/geolocation.js';
for (const f of [POL, TEST, GEO]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const pol = rd(POL);
for (const fn of ['shouldRetry', 'attemptOptions', 'accuracyVerdict'])
  if (!pol.includes('export function ' + fn)) E.push('policy must export ' + fn);

const geo = rd(GEO);
if (!geo.includes('export async function acquireLocation')) E.push('geolocation.js must export acquireLocation (the retry wrapper)');
if (!geo.includes('shouldRetry(')) E.push('acquireLocation must consult shouldRetry');
// The main flow must use the retry wrapper, not a single getCurrentPosition.
if (!/detectAndResolveLocation[^]*?await acquireLocation\(\)/.test(geo))
  E.push('detectAndResolveLocation must use acquireLocation() so the retry path is live');

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('retry-policy test did not PASS: ' + out.trim());
  } catch (err) { E.push('retry-policy test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:location-retry-policy] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:location-retry-policy] PASS — GPS acquisition retries once with balanced accuracy on '
  + 'timeout/unavailable (never on a denial); non-blocking accuracy verdict; main flow uses acquireLocation; test green.');
