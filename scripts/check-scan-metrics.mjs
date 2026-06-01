#!/usr/bin/env node
/**
 * scripts/check-scan-metrics.mjs — §P2 scan reliability metrics contract.
 *
 * Fails if __scanMetrics does not surface the P2 contract keys, does not
 * compute from real on-device stores, or fabricates a success rate (must be
 * null / NEEDS_DATA when no scans exist).
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/scanMetrics/ScanMetricsRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const KEYS = ['successRate', 'avgAnalysisTime', 'failures', 'retries', 'uploadUsage', 'cameraUsage'];
  const missing = KEYS.filter((k) => !raw.includes(k));
  if (missing.length) F.push(`__scanMetrics missing P2 keys: ${missing.join(', ')}`);
  else P.push('__scanMetrics surfaces all 6 P2 keys');
  // Computed from real stores.
  if (!/farroway_scan_history_v1/.test(raw) || !/farroway_event_log/.test(raw))
    F.push('__scanMetrics must compute from real on-device stores');
  else P.push('computes from real on-device stores');
  // Honest: NEEDS_DATA / null success rate when no scans.
  if (!/NEEDS_DATA/.test(raw)) F.push('__scanMetrics must return NEEDS_DATA when no scans exist');
  else P.push('honest NEEDS_DATA fallback');
  // No fabrication.
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('__scanMetrics must not fabricate / call the network');
  else P.push('no fabrication, no network call');
}

if (F.length) {
  console.error('[check:scan-metrics] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-metrics] PASS — real scan reliability metrics; honest NEEDS_DATA; no fabrication.');
for (const m of P) console.log('  ✓ ' + m);
