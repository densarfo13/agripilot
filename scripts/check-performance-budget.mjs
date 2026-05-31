#!/usr/bin/env node
/**
 * scripts/check-performance-budget.mjs — perf gate.
 * Structural performance-budget guardrails (build-time; the live
 * byte budget is measured by window.__bundleHealth at runtime):
 *   • vite enforces a chunk-size warning ceiling + manualChunks
 *   • the composite __performanceHealth() exists with a verdict
 *   • the scan shell renders synchronously (not behind a spinner gate)
 *   • diagnostics are deferred (dynamic-imported at boot)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const vite = read('vite.config.js');
if (!/chunkSizeWarningLimit/.test(vite)) F.push('vite must set chunkSizeWarningLimit (budget signal)');
else P.push('vite chunkSizeWarningLimit set');
if (!/manualChunks/.test(vite)) F.push('vite must use manualChunks');
else P.push('vite manualChunks present');

const perf = read('src/runtime/performance/PerformanceHealthRuntime.ts');
for (const tok of ['__performanceHealth', 'verdict', 'GOOD', 'NEEDS_WORK', 'CRITICAL']) {
  if (!new RegExp(`\\b${tok}\\b`).test(perf)) F.push(`__performanceHealth must expose "${tok}"`);
}
if (!F.some((m) => m.includes('__performanceHealth'))) P.push('__performanceHealth composite + verdict present');

// Diagnostics deferred (App dynamic-imports the perf globals at boot).
const app = read('src/App.jsx');
if (!/await import\(['"]\.\/runtime\/performance\/PerformanceHealthRuntime['"]\)/.test(app))
  F.push('App.jsx must dynamic-import the performance diagnostics at boot (deferred)');
else P.push('performance diagnostics deferred (dynamic import)');

// Scan shell is synchronous (no fullscreen spinner gate before shell).
const scanPage = read('src/pages/ScanPage.jsx');
if (/if\s*\(\s*!\s*mounted\s*\)\s*\{[\s\S]{0,400}?farroway-spin/.test(scanPage))
  F.push('ScanPage must not gate the shell behind a fullscreen !mounted spinner');
else P.push('scan shell renders synchronously (no spinner gate)');

if (F.length) { console.error('[check:performance-budget] FAIL'); F.forEach((m)=>console.error('  ✗ '+m)); process.exit(1); }
console.log('[check:performance-budget] PASS — budget guardrails + perf composite intact.');
P.forEach((m)=>console.log('  ✓ '+m));
