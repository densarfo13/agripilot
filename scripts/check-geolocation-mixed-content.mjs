/**
 * check-geolocation-mixed-content.mjs — locks the IP-geolocation mixed-content fix
 * (priority #2 location detection) + runs its test.
 *
 * Invariant: geolocation.js must never issue an UNGUARDED http:// fetch. The free
 * ip-api.com provider is HTTP-only and is mixed-content-blocked on the HTTPS production
 * origin, so it must sit behind the _httpProviderAllowed(protocol) guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const F = 'src/utils/geolocation.js';
const T = 'src/utils/__tests__/geolocationHttpProvider.test.ts';
const s = rd(F);
if (!s) E.push('missing: ' + F);
if (!fs.existsSync(path.join(R, T))) E.push('missing: ' + T);

if (!s.includes('export function _httpProviderAllowed')) {
  E.push('geolocation.js must export _httpProviderAllowed (the mixed-content guard)');
}

// Every http:// fetch must be guarded: an _httpProviderAllowed( reference must appear
// before it in the source.
let idx = s.indexOf("fetch('http://");
while (idx !== -1) {
  if (s.lastIndexOf('_httpProviderAllowed(', idx) === -1) {
    E.push("unguarded http:// fetch at offset " + idx + " — wrap it in if (_httpProviderAllowed(protocol))");
  }
  idx = s.indexOf("fetch('http://", idx + 1);
}

if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + T, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('geolocation http-provider test did not PASS: ' + out.trim());
  } catch (err) { E.push('geolocation test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:geolocation-mixed-content] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:geolocation-mixed-content] PASS — the HTTP-only ip-api provider is guarded by '
  + '_httpProviderAllowed; HTTPS pages issue no mixed-content fetch; test green.');
