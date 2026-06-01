#!/usr/bin/env node
/**
 * scripts/check-pilot-readiness-metrics.mjs — Pilot Readiness Lock contracts.
 *
 * Fails if the pilot readiness metrics + dashboard composite are not present
 * with their spec keys, or if any metric fabricates data.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const pr = read('src/runtime/pilotReadiness/PilotReadinessRuntime.ts');
if (!pr) { F.push('PilotReadinessRuntime.ts: missing'); }
else {
  const src = strip(pr);
  // §1 dashboard composite + 5 installed globals.
  for (const g of ['__outcomeMetrics', '__ngoPilotMetrics', '__languageQualityHealth', '__retentionMetrics', '__pilotReadiness']) {
    if (!pr.includes(g)) F.push(`PilotReadinessRuntime must install ${g}`);
  }
  if (!F.some((m) => m.includes('must install'))) P.push('installs all 5 pilot-readiness globals');
  // §1 — 12 subsystems + status vocabulary + verdict.
  const SUB = ['Authentication', 'Scan', 'UploadAnalysis', 'Camera', 'Localization',
    'Tasks', 'Activity', 'OutcomeCapture', 'Invites', 'Notifications', 'OfflineSync', 'NGOReporting'];
  const missingSub = SUB.filter((s) => !pr.includes(s));
  if (missingSub.length) F.push(`pilot readiness dashboard missing subsystems: ${missingSub.join(', ')}`);
  else P.push('12 subsystems present');
  if (!/GREEN/.test(pr) || !/YELLOW/.test(pr) || !/RED/.test(pr)) F.push('dashboard must use GREEN/YELLOW/RED');
  else P.push('GREEN/YELLOW/RED status vocabulary');
  // §4/§5 metric keys.
  for (const k of ['recommendationsIssued', 'tasksCompleted', 'followUpScans', 'outcomesRecorded', 'outcomeCaptureRate']) {
    if (!pr.includes(k)) F.push(`__outcomeMetrics must surface ${k}`);
  }
  for (const k of ['organizations', 'farmersEnrolled', 'activeFarmers', 'scansCompleted']) {
    if (!pr.includes(k)) F.push(`__ngoPilotMetrics must surface ${k}`);
  }
  for (const k of ['missingTranslations', 'fallbackUsage', 'translatorReviewQueue']) {
    if (!pr.includes(k)) F.push(`__languageQualityHealth must surface ${k}`);
  }
  for (const k of ['dau', 'wau', 'mau', 'd1', 'd7', 'd30']) {
    if (!new RegExp(`\\b${k}\\b`).test(pr)) F.push(`__retentionMetrics must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('outcome/ngo/language/retention metric keys present');
  // No fabrication.
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('pilot readiness metrics must not fabricate / call the network');
  else P.push('no fabrication, no network call');
  if (!/NEEDS_DATA/.test(pr)) F.push('metrics must return NEEDS_DATA honestly');
  else P.push('honest NEEDS_DATA');
}

// §2 scan operations metrics keys.
const scan = read('src/runtime/scanMetrics/ScanMetricsRuntime.ts');
for (const k of ['scanAttempts', 'scanSuccesses', 'scanFailures', 'uploadScans', 'cameraScans', 'retryCount']) {
  if (!scan.includes(k)) F.push(`__scanMetrics must surface ${k}`);
}
if (!F.some((m) => m.includes('__scanMetrics must surface'))) P.push('__scanMetrics surfaces §2 operations keys');

// §7 reliability metrics keys.
const rel = read('src/runtime/reliability/ReliabilityRuntime.ts');
for (const k of ['routeErrors', 'authFailures', 'scanFailures', 'offlineSyncFailures', 'notificationFailures']) {
  if (!rel.includes(k)) F.push(`__reliabilityHealth must surface ${k}`);
}
if (!F.some((m) => m.includes('__reliabilityHealth must surface'))) P.push('__reliabilityHealth surfaces §7 reliability keys');

if (F.length) {
  console.error('[check:pilot-readiness-metrics] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:pilot-readiness-metrics] PASS — scan/retention/outcome/ngo/language/reliability metrics + 12-subsystem dashboard.');
for (const m of P) console.log('  ✓ ' + m);
