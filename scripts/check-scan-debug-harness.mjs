/**
 * check-scan-debug-harness.mjs — verifies the Scan Debug Harness is wired: recorder +
 * 15 steps + globals, the safeTrackEvent tap, the /admin/scan-debug route + Export button,
 * and the server correlationId echo. Runs the recorder test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const rec = rd('src/lib/scanTraceRecorder.js');
if (!rec) E.push('missing src/lib/scanTraceRecorder.js');
for (const g of ['__scanTrace', '__lastScanCorrelationId', 'exportScanDebug', 'recordScanStep'])
  if (!rec.includes(g)) E.push('recorder missing global/export: ' + g);
if ((rec.match(/'[a-z_]+'/g) || []).length < 15) E.push('recorder should define 15 steps');

const an = rd('src/lib/analytics.js');
if (!/recordTelemetryStep/.test(an)) E.push('safeTrackEvent tap missing (recordTelemetryStep)');

const page = rd('src/pages/admin/ScanDebugPage.jsx');
if (!page) E.push('missing ScanDebugPage.jsx');
if (!/Export Debug JSON/.test(page)) E.push('debug page missing Export Debug JSON button');
if (!/last-trace/.test(page)) E.push('debug page must fetch /api/admin/scan/last-trace');

const app = rd('src/App.jsx');
if (!/\/admin\/scan-debug/.test(app)) E.push('route /admin/scan-debug not registered');

const srv = rd('server/src/app.js');
if (!/correlationId/.test(srv)) E.push('server last-trace must expose correlationId');

if (E.length === 0) {
  try {
    const out = execSync('node src/lib/__tests__/scanTraceRecorder.test.mjs', { cwd: R, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
    if (!/PASS/.test(out)) E.push('recorder test did not PASS');
  } catch (err) { E.push('recorder test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:scan-debug-harness] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-debug-harness] PASS — 15-step trace recorder + safeTrackEvent tap + /admin/scan-debug '
  + '(Export Debug JSON) + server correlationId echo all wired; test green.');
