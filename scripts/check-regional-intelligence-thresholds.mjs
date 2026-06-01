#!/usr/bin/env node
/**
 * scripts/check-regional-intelligence-thresholds.mjs — §3 regional signals
 * need ≥2 farms + a scan threshold; no single-farmer outbreak; anonymized.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/runtime/intelligence/regional/RegionalIntelligenceRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  if (!/MIN_REGIONAL_FARMS\s*=\s*2|MIN_REGIONAL_FARMS\s*=\s*[2-9]/.test(raw))
    F.push('must require a minimum of ≥2 farms (MIN_REGIONAL_FARMS)');
  else P.push('min-farm threshold ≥ 2 enforced');
  if (!/MIN_REGIONAL_SCANS/.test(raw)) F.push('must require a minimum scan threshold (MIN_REGIONAL_SCANS)');
  else P.push('min-scan threshold enforced');
  for (const k of ['regionSignalsReady', 'minFarmThresholdEnforced', 'minScanThresholdEnforced', 'anonymized', 'noFakeOutbreaks']) {
    if (!raw.includes(k)) F.push(`must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('§3 readiness keys present');
  if (!/farmCount\s*>=\s*MIN_REGIONAL_FARMS/.test(raw))
    F.push('a regional signal must require farmCount >= MIN_REGIONAL_FARMS (no single-farmer signal)');
  else P.push('no single-farmer outbreak (farmCount gate)');
  if (!/NEEDS_DATA/.test(raw)) F.push('must return NEEDS_DATA below threshold');
  else P.push('honest NEEDS_DATA below threshold');
}

if (F.length) {
  console.error('[check:regional-intelligence-thresholds] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:regional-intelligence-thresholds] PASS — ≥2 farms + scan threshold; anonymized; no fake outbreak.');
for (const m of P) console.log('  ✓ ' + m);
