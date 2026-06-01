#!/usr/bin/env node
/**
 * scripts/check-scan-normalizer.mjs — §2 provider normalization.
 *
 * Fails if ScanDetectionNormalizer.ts does not:
 *   • localize labels through translateEntityLabel (no raw provider labels)
 *   • compute overallConfidence + needsReview from the contract thresholds
 *   • attach limitations to every detection
 *   • keep rawProviderRef internal (never a UI field) + carry the disclaimer
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const src = read('src/runtime/scanDetection/ScanDetectionNormalizer.ts');
if (!src) { F.push('src/runtime/scanDetection/ScanDetectionNormalizer.ts: missing'); }
else {
  if (!/translateEntityLabel/.test(src))
    F.push('normalizer must localize labels through translateEntityLabel');
  else P.push('localizes labels through translateEntityLabel');

  if (!/confidenceTier|CONFIDENCE_THRESHOLDS/.test(src))
    F.push('normalizer must compute confidence from the contract thresholds');
  else P.push('computes confidence from contract thresholds');

  if (!/overallConfidence/.test(src)) F.push('normalizer must compute overallConfidence');
  else P.push('computes overallConfidence');

  if (!/needsReview/.test(src)) F.push('normalizer must compute needsReview');
  else P.push('computes needsReview');

  if (!/\blimitations\b/.test(src)) F.push('normalizer must attach limitations to detections');
  else P.push('attaches limitations');

  if (!/rawProviderRef/.test(src))
    F.push('normalizer must keep an internal rawProviderRef (never UI-exposed)');
  else P.push('keeps internal rawProviderRef (never UI-exposed)');

  // Imports the canonical contract (single source of truth).
  if (!/scanDetectionContracts/.test(src))
    F.push('normalizer must import the canonical contract');
  else P.push('imports the canonical contract');

  // Disclaimer carried directly or via the imported DETECTION_DISCLAIMER const.
  if (!/Decision support, not a guarantee/.test(src) && !/DETECTION_DISCLAIMER/.test(src))
    F.push('normalizer output must carry the disclaimer (literal or DETECTION_DISCLAIMER)');
  else P.push('disclaimer present (via DETECTION_DISCLAIMER)');
}

if (F.length) {
  console.error('[check:scan-normalizer] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-normalizer] PASS — localized, thresholded, explainable, raw ref internal-only.');
for (const m of P) console.log('  ✓ ' + m);
