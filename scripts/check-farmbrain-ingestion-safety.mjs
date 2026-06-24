/**
 * check-farmbrain-ingestion-safety.mjs — sprint #214 §12.
 * Fails build if the FarmBrain ingestion guard is missing or the
 * persistence bridge doesn't consult it.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _exists = (r) => { try { return fs.existsSync(path.join(ROOT, r)); } catch { return false; } };
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const G = 'src/runtime/scanTrust/FarmBrainIngestionGuard.ts';
if (!_exists(G)) errors.push('missing: ' + G);
else {
  const s = _read(G);
  _has(s, 'export function shouldIngestScan', 'must export shouldIngestScan');
  _has(s, 'FarmBrainIngestionSkipped', 'must emit FarmBrainIngestionSkipped reason');
  _has(s, '__farmBrainIngestionHealth', 'must pin __farmBrainIngestionHealth');
  _has(s, '__farrowayShouldIngestScan', 'must pin __farrowayShouldIngestScan for core bridge');
}
const B = 'src/core/scan/scanPersistenceBridge.js';
if (!_exists(B)) errors.push('missing: ' + B);
else {
  const s = _read(B);
  _has(s, '__farrowayShouldIngestScan', 'persistScanToJournal must consult the ingestion guard');
  _has(s, 'ingest.skipped', 'persistScanToJournal must skip a blocked scan');
}
if (errors.length) {
  console.error('[check:farmbrain-ingestion-safety] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farmbrain-ingestion-safety] PASS — ingestion guard present; persistence bridge consults it.');
