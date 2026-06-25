/**
 * check-scan-platform-v10.mjs — Scan Intelligence v10.
 *
 * Locks the genuine v10 deltas: the 8 extended object classes, the completed scan
 * API surface, and the no-fabrication invariant (ripeness/grade/storage stay
 * honest advisors, never fabricated CV scores). Runs the classifier test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// 8 extended object classes in the classifier + routing.
const CL = rd('src/runtime/scan/AgriculturalObjectClassifier.ts');
for (const t of ['herb', 'seed', 'grass', 'shrub', 'houseplant', 'hydroponic', 'greenhouse', 'weed']) {
  h(CL, "'" + t + "'", 'classifier must support object class: ' + t);
  if (!new RegExp(t + ':\\s*Object\\.freeze').test(CL)) E.push('classifier must route object class: ' + t);
}

// Completed scan API surface.
const APP = rd('server/src/app.js');
for (const route of ["app.post('/api/scan'", "'/api/scan/statistics'", "'/api/scan/providers'",
  "'/api/scan/review'", "'/api/scan/bulk'"])
  h(APP, route, 'must mount scan API: ' + route);

// No-fabrication: the specialized engines must not emit fabricated ripeness/grade
// CV scores (assessed:false / value:null is the honest contract).
const SE = rd('src/runtime/scan/ScanSpecializedEngines.ts');
if (SE && /(ripeness|grade|storage)[^\n]*[:=]\s*(\d{2,3})\b/i.test(SE))
  E.push('specialized engines must not fabricate a ripeness/grade/storage score');

// 4 reports.
for (const doc of ['SCAN_PLATFORM_REPORT.md', 'FIELD_VALIDATION_REPORT.md',
  'PRODUCTION_SCORECARD.md', 'WORLD_CLASS_SCAN_REPORT.md'])
  if (!x(doc)) E.push('missing report: ' + doc);

// Classifier test (no regression + new classes).
if (E.length === 0) {
  try {
    const out = execSync('npx tsx src/runtime/scan/universal/__tests__/AgriClassifier.test.ts',
      { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('classifier test did not PASS: ' + out.trim());
  } catch (err) { E.push('classifier test failed: ' + ((err && (err.stdout || err.message)) || '?')); }
}

if (E.length) {
  console.error('[check:scan-platform-v10] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-platform-v10] PASS — 8 extended object classes (herb/seed/grass/shrub/houseplant/'
  + 'hydroponic/greenhouse/weed) + routing; scan API surface complete; no fabricated ripeness/grade; classifier test green.');
