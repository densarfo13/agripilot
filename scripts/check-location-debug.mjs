/**
 * check-location-debug.mjs — the admin location-debug endpoint (RC item 2 observability).
 * Locks: the recorder redacts by construction (no precise coords / secrets), the client
 * reporter POSTs to /api/location/attempt, and GET /api/admin/location/debug is admin-gated.
 * Runs the vitest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const REC = 'server/src/ml/locationLastAttempt.js';
const TEST = 'server/src/__tests__/locationLastAttempt.test.js';
for (const f of [REC, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const rec = rd(REC);
if (!rec.includes('export function recordLocationDebug')) E.push('must export recordLocationDebug');
if (!rec.includes('export function getLocationDebug')) E.push('must export getLocationDebug');
// Redaction by whitelist: precise-coord / secret fields must never be referenced.
for (const leak of ['latitude', 'longitude', 'apiKey', 'Authorization', 'imageBase64'])
  if (rec.includes(leak)) E.push('recorder must not reference ' + leak + ' (redaction is by whitelist — coarse coords only)');

// Routes: client reporter POST + admin-gated debug GET.
const app = rd('server/src/app.js');
if (!app.includes("'/api/location/attempt'")) E.push('app.js must expose POST /api/location/attempt');
if (!app.includes("'/api/admin/location/debug'")) E.push('app.js must expose GET /api/admin/location/debug');
if (!/\/api\/admin\/location\/debug'[^]*?_requireAdmin\(req, res\)/.test(app))
  E.push('/api/admin/location/debug must be admin-gated via _requireAdmin');

// Client reports the attempt.
const ld = rd('src/components/LocationDetect.jsx');
if (!/api\.post\(\s*['"]\/location\/attempt['"]/.test(ld)) E.push('LocationDetect must report the attempt to /location/attempt');

if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/locationLastAttempt.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('locationLastAttempt vitest did not pass:\n' + out.slice(-400));
  } catch (err) { E.push('locationLastAttempt vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-400)); }
}

if (E.length) { console.error('[check:location-debug] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:location-debug] PASS — GET /api/admin/location/debug exposes recent location attempts '
  + '(verdict/permission/https/browser/latency/accuracy/coarse coords); redacts precise coords + secrets; admin-gated; client reports; vitest green.');
