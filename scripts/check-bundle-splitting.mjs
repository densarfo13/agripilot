#!/usr/bin/env node
/**
 * scripts/check-bundle-splitting.mjs — perf gate.
 * Fails if heavy/internal surfaces leave the lazy graph, or if the
 * critical scan shell becomes lazy-blocking.
 *   • internal/NGO/buyer/scan-result pages must be React.lazy
 *   • vite manualChunks must split heavy vendors
 *   • scan safe shell (ScanHub / PlainUploadFallback) must NOT be lazy
 *   • __bundleHealth diagnostic present
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const app = read('src/App.jsx');

// Heavy/internal pages must be lazy().
const MUST_BE_LAZY = [
  'NGOPilotPage', 'PerformancePage', 'FounderDashboard', 'MetricsDashboard',
  'ScanResultPage', 'GodmodePage',
];
for (const name of MUST_BE_LAZY) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*lazy\\(`);
  if (new RegExp(`\\b${name}\\b`).test(app) && !re.test(app))
    F.push(`${name} must be React.lazy() (kept out of the initial bundle)`);
}
if (!F.some((m) => m.includes('React.lazy'))) P.push('internal/NGO/buyer/scan-result pages are lazy');

// Vite manualChunks must split heavy vendors.
const vite = read('vite.config.js');
if (!/manualChunks/.test(vite) || !/vendor-recharts|vendor-leaflet/.test(vite))
  F.push('vite must manualChunks heavy vendors (recharts/leaflet/i18n)');
else P.push('vite manualChunks splits heavy vendors');

// The scan safe shell must NOT be lazy (it is the immediate-render path).
if (/const\s+ScanHub\s*=\s*lazy\(/.test(app)
    || /const\s+PlainUploadFallback\s*=\s*lazy\(/.test(app))
  F.push('scan safe shell (ScanHub / PlainUploadFallback) must NOT be lazy');
else P.push('scan safe shell stays in the initial path (not lazy)');
// ScanHub + PlainUploadFallback are statically imported by ScanPage.
const scanPage = read('src/pages/ScanPage.jsx');
if (!/import\s+ScanHub\s+from/.test(scanPage) || !/import\s+PlainUploadFallback\s+from/.test(scanPage))
  F.push('ScanPage must STATICALLY import ScanHub + PlainUploadFallback (no lazy gate on the shell)');

const perf = read('src/runtime/performance/PerformanceHealthRuntime.ts');
if (!/__bundleHealth/.test(perf)) F.push('__bundleHealth diagnostic missing');
else P.push('__bundleHealth present');

if (F.length) { console.error('[check:bundle-splitting] FAIL'); F.forEach((m)=>console.error('  ✗ '+m)); process.exit(1); }
console.log('[check:bundle-splitting] PASS — heavy surfaces lazy, vendors split, scan shell eager.');
P.forEach((m)=>console.log('  ✓ '+m));
