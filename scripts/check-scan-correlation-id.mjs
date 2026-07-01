/**
 * check-scan-correlation-id.mjs — locks the Scan spec rule "Log every failure with
 * a correlation ID". Asserts the correlation module exists + exports the contract,
 * the scan error boundary threads a correlationId into crash details + telemetry,
 * and runs the correlation test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const MOD = 'src/lib/scanCorrelationId.js';
const TEST = 'src/lib/__tests__/scanCorrelationId.test.mjs';
const BOUNDARY = 'src/components/scan/ScanErrorBoundary.jsx';
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const mod = rd(MOD);
if (!mod) E.push('missing: ' + MOD);
for (const fn of ['newScanCorrelationId', 'beginScanCorrelation', 'getScanCorrelationId', 'clearScanCorrelation'])
  if (!new RegExp('export function ' + fn).test(mod)) E.push(MOD + ' must export ' + fn);

const b = rd(BOUNDARY);
if (!/getScanCorrelationId/.test(b)) E.push(BOUNDARY + ' must import getScanCorrelationId');
if (!/correlationId/.test(b)) E.push(BOUNDARY + ' must include correlationId in crash details/telemetry');

if (E.length === 0) {
  try {
    const out = execSync('node ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('correlation test did not PASS: ' + out.trim());
  } catch (err) { E.push('correlation test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}
if (E.length) { console.error('[check:scan-correlation-id] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:scan-correlation-id] PASS — every scan failure carries a correlation id '
  + '(module + boundary crash details + telemetry); test green.');
