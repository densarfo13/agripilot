/**
 * check-scan-last-trace.mjs — the admin last-scan-trace diagnostic.
 * Locks: the recorder redacts by construction (no image bytes / secrets), the
 * /api/admin/scan/last-trace endpoint is admin-gated, and the scan route records a
 * trace. Runs the vitest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const REC = 'server/src/ml/scanLastTrace.js';
const TEST = 'server/src/__tests__/scanLastTrace.test.js';
for (const f of [REC, TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);
const rec = rd(REC);

has(rec, 'export function recordScanTrace', 'must export recordScanTrace');
has(rec, 'export function getLastScanTrace', 'must export getLastScanTrace');
// Redaction by construction: the recorder must NOT reference image-byte / secret fields.
for (const leak of ['imageBase64', 'apiKey', 'Authorization', 'rawProviderResponse', 'imageUrl'])
  if (rec.includes(leak)) E.push('recorder must not reference ' + leak + ' (redaction is by whitelist — never store it)');

// Admin endpoint, admin-gated.
const app = rd('server/src/app.js');
has(app, "'/api/admin/scan/last-trace'", 'app.js must expose GET /api/admin/scan/last-trace');
if (!/\/api\/admin\/scan\/last-trace'[^]*?_requireAdmin\(req, res\)/.test(app))
  E.push('/api/admin/scan/last-trace must be admin-gated via _requireAdmin');
// Scan route records the trace.
has(app, 'recordScanTrace(', '/api/scan/analyze must record the scan trace');

// Run the vitest.
if (E.length === 0) {
  try {
    const out = execSync('npx vitest run src/__tests__/scanLastTrace.test.js', {
      cwd: path.join(R, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!/Tests\s+\d+ passed/.test(out) || /failed/.test(out)) E.push('scanLastTrace vitest did not pass:\n' + out.slice(-500));
  } catch (err) { E.push('scanLastTrace vitest failed: ' + ((err && (err.stdout || err.message)) || '?').slice(-500)); }
}

if (E.length) {
  console.error('[check:scan-last-trace] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-last-trace] PASS — admin /api/admin/scan/last-trace exposes the last scan trace '
  + '(provider status/latency, candidate counts, top candidate, rejection reason, verdict); redacts secrets + image bytes; admin-gated; vitest green.');
