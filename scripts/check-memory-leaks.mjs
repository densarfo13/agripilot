#!/usr/bin/env node
/**
 * scripts/check-memory-leaks.mjs — perf gate.
 * Fails if a known leak class regresses:
 *   • camera MediaStream tracks not stopped on unmount
 *   • object URLs not revoked
 *   • the scan trace ring buffer is unbounded
 *   • intervals/timeouts not cleared in effect cleanup
 *   • __memoryHealth diagnostic missing
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Camera tracks stopped — the MediaStream lifecycle is owned by the
// canonical cameraRuntimeManager (LiveCameraScanner delegates to it),
// which is where getTracks().stop() must live.
const cam = read('src/components/scan/LiveCameraScanner.jsx');
const camMgr = read('src/core/camera/cameraRuntimeManager.js');
if ((!/getTracks\(\)/.test(camMgr) || !/\.stop\(\)/.test(camMgr))
    && (!/getTracks\(\)/.test(cam) || !/\.stop\(\)/.test(cam)))
  F.push('camera lifecycle must stop MediaStream tracks (getTracks().forEach(t=>t.stop()))');
else P.push('camera tracks stopped on cleanup (cameraRuntimeManager)');

// Object URLs revoked somewhere in the scan capture path.
const capture = read('src/components/scan/ScanCapture.jsx');
if (!/revokeObjectURL/.test(capture) && !/revokeObjectURL/.test(cam))
  F.push('scan capture path must revokeObjectURL on cleanup');
else P.push('object URLs revoked');

// Scan trace ring buffer bounded.
const startup = read('src/runtime/scanStartup/ScanStartupHealthRuntime.ts');
if (!/TRACE_CAP/.test(startup) || !/_trace\.shift\(\)/.test(startup))
  F.push('scan trace must be a bounded ring buffer (TRACE_CAP + shift)');
else P.push('scan trace bounded (TRACE_CAP)');

// Effect cleanup clears timers in the polling components.
for (const f of ['src/components/scan/ScanHub.jsx',
                 'src/components/system/OfflineQueueBanner.jsx',
                 'src/components/scan/ScanStartupBanner.jsx']) {
  const src = read(f);
  if (/setInterval|setTimeout/.test(src) && !/clearInterval|clearTimeout/.test(src))
    F.push(`${f}: timer must be cleared in the effect cleanup`);
}
if (!F.some((m) => m.includes('cleared in the effect'))) P.push('polling timers cleared on unmount');

// ScanPage abandons publication after unmount.
const scanPage = read('src/pages/ScanPage.jsx');
if (!/_unmountedRef/.test(scanPage))
  F.push('ScanPage must guard post-await setState with an unmount ref');
else P.push('ScanPage abandons analysis publication after unmount');

const perf = read('src/runtime/performance/PerformanceHealthRuntime.ts');
if (!/__memoryHealth/.test(perf)) F.push('__memoryHealth diagnostic missing');
else P.push('__memoryHealth present');

if (F.length) { console.error('[check:memory-leaks] FAIL'); F.forEach((m)=>console.error('  ✗ '+m)); process.exit(1); }
console.log('[check:memory-leaks] PASS — camera/objectURL/timer/trace cleanup intact.');
P.forEach((m)=>console.log('  ✓ '+m));
