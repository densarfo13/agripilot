/**
 * check-provider-adapters.mjs — client provider contracts + normalizers.
 * The browser layer must NOT call provider APIs (keys are server-side); it must
 * normalize the server response into the ProviderResult contract with the full
 * status taxonomy.
 */
import fs from 'node:fs';
import path from 'node:path';
const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const D = 'src/runtime/scan/providers/';
for (const f of ['ProviderContracts.ts', 'CropHealthProvider.ts', 'MushroomProvider.ts'])
  if (!x(D + f)) E.push('missing: ' + D + f);

const c = rd(D + 'ProviderContracts.ts');
for (const st of ['READY', 'NO_RESULT', 'UNSUPPORTED', 'AUTH_FAILED', 'CREDITS_EXHAUSTED', 'RATE_LIMITED', 'TIMEOUT', 'PROVIDER_ERROR'])
  h(c, "'" + st + "'", 'status taxonomy missing: ' + st);
for (const f of ['provider', 'status', 'httpStatus', 'confidence', 'candidates', 'findings', 'recommendations', 'failureReason', 'latencyMs'])
  h(c, f, 'ProviderResult must include: ' + f);

// Client normalizers must NOT call an external provider API (key-leak guard).
for (const f of ['CropHealthProvider.ts', 'MushroomProvider.ts']) {
  const s = rd(D + f);
  if (/fetch\(/.test(s) || /kindwise/i.test(s)) E.push(f + ' must NOT call a provider API from the client (key leak)');
}

if (E.length) { console.error('[check:provider-adapters] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:provider-adapters] PASS — client contracts + normalizers; full status taxonomy; no client-side API calls.');
