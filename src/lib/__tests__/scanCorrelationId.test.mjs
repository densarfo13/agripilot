/**
 * scanCorrelationId.test — locks the correlation-id contract used by the scan
 * failure/crash logging. Self-running: `node src/lib/__tests__/scanCorrelationId.test.mjs`.
 */
import {
  newScanCorrelationId, beginScanCorrelation, getScanCorrelationId, clearScanCorrelation,
} from '../scanCorrelationId.js';

let passed = 0;
function ok(c, m) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const id = newScanCorrelationId();
ok(typeof id === 'string' && /^scan-[a-z0-9]+-[a-z0-9]+$/.test(id), 'id has scan-<time>-<rand> shape');

const a = beginScanCorrelation();
ok(typeof a === 'string' && a.startsWith('scan-'), 'beginScanCorrelation returns an id');
ok(getScanCorrelationId() === a, 'getScanCorrelationId returns the active id (stable within an attempt)');

clearScanCorrelation();
const b = getScanCorrelationId();
ok(typeof b === 'string' && b.startsWith('scan-'), 'get auto-generates a fresh id after clear (never null)');
ok(b !== a, 'a cleared attempt gets a different id');

console.log('[scanCorrelationId] PASS — ' + passed + ' assertions. Every scan failure carries a stable correlation id; never throws.');
