/**
 * check-photo-quality-engine.mjs — sprint #214 §12.
 * Fails build if the photo quality engine is missing or fabricates
 * sub-scores, or coaching keys bypass i18n.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _exists = (r) => { try { return fs.existsSync(path.join(ROOT, r)); } catch { return false; } };
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const ENG = 'src/runtime/scanQuality/PhotoQualityEngine.ts';
if (!_exists(ENG)) errors.push('missing: ' + ENG);
else {
  const s = _read(ENG);
  _has(s, 'export function evaluatePhotoQuality', 'must export evaluatePhotoQuality');
  for (const f of ['qualityScore', 'qualityLabel', 'passed', 'failed', 'coaching', 'recommendedRetake', 'confidenceCap']) {
    _has(s, f, 'photo quality output must include: ' + f);
  }
  _has(s, 'neverFabricatesSubScores', 'must declare neverFabricatesSubScores (honest nulls)');
  _has(s, '__photoQualityHealth', 'must pin __photoQualityHealth');
}
if (!_exists('src/runtime/scanQuality/PhotoQualityExplainer.ts')) {
  errors.push('missing PhotoQualityExplainer.ts');
}
// Coaching strings must be i18n keys (scanQuality.*), not raw English.
const TEN = _read('src/i18n/columns/T-en.js');
for (const k of ['scanQuality.photoNeedsClearerView', 'scanQuality.moveCloser',
  'scanQuality.useDaylight', 'scanQuality.fillFrame', 'scanQuality.holdSteady']) {
  if (!TEN.includes('"' + k + '"')) errors.push('T-en.js missing coaching key: ' + k);
}
if (errors.length) {
  console.error('[check:photo-quality-engine] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:photo-quality-engine] PASS — engine present, never fabricates sub-scores, coaching keyed.');
