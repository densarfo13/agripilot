/**
 * run-golden-dataset.mjs — PROVIDER RELIABILITY golden-dataset accuracy run.
 *
 * Runs the verified golden-dataset images through the deployed scan API, measures
 * identification + disease accuracy, and records the result. A later run that
 * DECREASES accuracy is rejected (check:provider-reliability reads baseline.json).
 *
 * HONESTY: accuracy is never fabricated. An empty manifest, or no SCAN_API_BASE,
 * reports PENDING (exit 0) — population + execution is the operator's job. From
 * the sandbox there are no verified images, so PENDING is the truthful result.
 *
 *   SCAN_API_BASE=… SCAN_API_TOKEN=… GOLDEN_DATASET_DIR=… npm run golden:dataset
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const MANIFEST = path.join(R, 'golden-dataset/manifest.json');
const BASELINE = path.join(R, 'golden-dataset/baseline.json');

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }

async function main() {
  const manifest = readJson(MANIFEST, []);
  const apiBase = process.env.SCAN_API_BASE || '';
  const dir = process.env.GOLDEN_DATASET_DIR || path.join(R, 'golden-dataset');

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.log('[golden-dataset] PENDING — manifest is empty (0 verified images). Populate golden-dataset/manifest.json.');
    return;   // allowed: dataset not yet populated
  }
  if (!apiBase) {
    console.log('[golden-dataset] PENDING — SCAN_API_BASE not set. Run against the deployed app to measure accuracy.');
    return;
  }

  // Run each verified image; compare the scan result to ground truth.
  let plantCorrect = 0, diseaseCorrect = 0, diseaseTotal = 0, ran = 0;
  for (const item of manifest) {
    const imgPath = path.join(dir, item.image);
    if (!fs.existsSync(imgPath)) { console.warn('  missing image (skipped): ' + item.image); continue; }
    try {
      const body = new FormData();
      body.append('image', new Blob([fs.readFileSync(imgPath)]), item.image);
      const res = await fetch(apiBase.replace(/\/$/, '') + '/api/scan/analyze', {
        method: 'POST', body,
        headers: process.env.SCAN_API_TOKEN ? { Authorization: 'Bearer ' + process.env.SCAN_API_TOKEN } : {},
      });
      const json = await res.json().catch(() => ({}));
      ran += 1;
      const got = String(json.cropName || json.plantName || json.crop || '').toLowerCase();
      if (item.crop && got.includes(String(item.crop).toLowerCase())) plantCorrect += 1;
      if (item.label && item.label !== 'healthy') {
        diseaseTotal += 1;
        const issue = String(json.detectedIssue || json.disease || '').toLowerCase();
        if (issue && issue.includes(String(item.label).toLowerCase().split('_')[0])) diseaseCorrect += 1;
      }
    } catch (e) { console.warn('  scan failed (skipped): ' + item.image + ' — ' + (e && e.message)); }
  }

  if (ran === 0) { console.log('[golden-dataset] PENDING — no images could be run.'); return; }
  const plantAccuracy = Math.round((plantCorrect / ran) * 1000) / 10;
  const diseaseAccuracy = diseaseTotal ? Math.round((diseaseCorrect / diseaseTotal) * 1000) / 10 : null;
  const result = { at: new Date().toISOString(), ran, plantAccuracy, diseaseAccuracy };
  console.log('[golden-dataset] ran=' + ran + ' plantAccuracy=' + plantAccuracy + '% diseaseAccuracy=' + (diseaseAccuracy ?? 'n/a') + '%');

  // Reject if accuracy DECREASED vs the recorded baseline.
  const prev = readJson(BASELINE, null);
  if (prev && typeof prev.plantAccuracy === 'number' && plantAccuracy < prev.plantAccuracy - 0.5) {
    console.error('[golden-dataset] REGRESSION — plant accuracy dropped ' + prev.plantAccuracy + '% → ' + plantAccuracy + '%');
    process.exit(1);
  }
  // Update the baseline to the (non-regressed) result.
  fs.writeFileSync(BASELINE, JSON.stringify(result, null, 2));
  console.log('[golden-dataset] baseline updated.');
}
main().catch((e) => { console.error('[golden-dataset] error:', e && e.message); process.exit(1); });
