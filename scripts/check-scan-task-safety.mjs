#!/usr/bin/env node
/**
 * scripts/check-scan-task-safety.mjs — §7 task generation safety.
 *
 * Fails if the scan task-candidate builder:
 *   • emits a hardcoded chemical dosage (unsafe treatment advice)
 *   • does not default treatment candidates to un-vetted (vettedTreatment
 *     false / dosage null) — a treatment task is allowed ONLY when a vetted
 *     catalog supplies it
 *   • does not localize task text
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/scanDetection/ScanDetectionNormalizer.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  if (!/buildScanTaskCandidates/.test(raw))
    F.push('normalizer must export buildScanTaskCandidates');
  else P.push('buildScanTaskCandidates present');

  const code = strip(raw);
  // No hardcoded chemical dosage anywhere in task generation.
  if (/\b\d+\s?(ml|l|g|kg)\s*\/\s*(l|litre|liter|acre|ha)\b/i.test(code))
    F.push('task generation must NOT emit a chemical dosage (unsafe treatment advice)');
  else P.push('no hardcoded chemical dosage in task generation');

  // Treatment candidates default to un-vetted.
  if (!/vettedTreatment:\s*false/.test(code))
    F.push('task candidates must default vettedTreatment:false (no auto-prescribed treatment)');
  else P.push('treatment candidates default to un-vetted (no auto-prescription)');
  if (!/dosage:\s*null/.test(code))
    F.push('task candidates must default dosage:null');
  else P.push('task candidate dosage defaults to null');

  // Localized task text.
  if (!/translateEntityLabel/.test(raw))
    F.push('task text must be localized through translateEntityLabel');
  else P.push('task text localized through translateEntityLabel');
}

if (F.length) {
  console.error('[check:scan-task-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-task-safety] PASS — no unsafe chemical advice; treatment vetted-only; localized.');
for (const m of P) console.log('  ✓ ' + m);
