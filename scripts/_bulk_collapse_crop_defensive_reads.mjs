#!/usr/bin/env node
/**
 * One-shot bulk migrator for defensive-read patterns of the form
 *   `(record.crop || record.cropType ...)` or
 *   `(record.cropType || record.crop ...)`
 * to
 *   `normalizeCrop(record)`
 *
 * normalizeCrop() in src/config/crops.js was extended to accept a
 * record (object) input — it reads `record.crop` then `record.cropType`,
 * then runs the value through the existing string normalization chain
 * (alias collapse, hyphenated/underscored/spaced variants, etc.).
 *
 * The script:
 *   1. Walks a curated list of files known to have defensive-read
 *      patterns (see TARGETS). Refuses to touch anything outside.
 *   2. For each match, replaces the pattern with normalizeCrop(<rec>).
 *      Preserves any additional `|| <other-expr>` tail outside the
 *      crop-vs-cropType pair (so `farm.crop || farm.cropType || crop`
 *      becomes `normalizeCrop(farm) || crop`).
 *   3. If the file makes any change AND does not already import
 *      `normalizeCrop` from src/config/crops.js, adds an import.
 *   4. Reports the diff summary per file.
 *
 * SAFETY:
 *   - Only TARGETS in the list are touched (no glob, no recursion).
 *   - Only the exact `<id>.crop || <id>.cropType[...]` shape (or the
 *     reverse order) is rewritten — partial matches are skipped, not
 *     guessed at.
 *   - Pattern uses a backreference so the two `<id>` MUST be the
 *     same identifier — protects against `farm.crop || other.cropType`
 *     which is structurally different (rare but real).
 *   - String coercion + .toLowerCase() + .trim() that wrap the
 *     defensive read are NOT auto-stripped — left in place so a
 *     human can review. normalizeCrop() already lowercases; the
 *     extra coercion is redundant but harmless.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// Curated target list — only these files are touched. Second-pass
// targets (optional-chaining variants like `profile?.cropType ||
// profile?.crop`) added below.
const TARGETS = [
  'src/components/farmer/YieldBadge.jsx',
  'src/components/FarmerHeader.jsx',
  'src/components/FarmForm.jsx',
  'src/components/FarmSnapshotCard.jsx',
  'src/components/outbreak/OutbreakReportModal.jsx',
  'src/components/TodaysInsights.jsx',
  'src/context/ForecastContext.jsx',
  'src/core/dailyIntelligenceEngine.js',
  'src/core/multiFarm/farmToCropFitAnswers.js',
  'src/core/multiFarm/recommendationContext.js',
  'src/core/welcome/selectBestCrop.js',
  'src/engine/decisionEngine.js',
  'src/hooks/useDailyNotifications.js',
  'src/hooks/useFarmDecision.js',
  'src/hooks/useFarmerLoop.js',
  'src/lib/api.js',
  'src/lib/harvest/harvestSummaryEngine.js',
  'src/lib/intelligence/estimateYield.js',
  'src/lib/intelligence/farmActionPlan.js',
  'src/lib/intelligence/farrowayScoreEngine.js',
  'src/lib/intelligence/smartAlertEngine.js',
  'src/lib/journey/journeySignals.js',
  'src/lib/ngo/analytics.js',
  'src/lib/ngo/reportFilters.js',
  'src/lib/ngo/verificationSignals.js',
  'src/lib/progress/milestoneEngine.js',
  'src/lib/signals/farmerSignalEngine.js',
  'src/lib/tasks/taskEngine.js',
  'src/lib/verification/trustSignals.js',
  'src/outbreak/farmerOutbreakAlerts.js',
  'src/outbreak/outbreakClusterEngine.js',
  'src/utils/farmScore.js',
];

// Pattern A: `<id>.crop || <id>.cropType[...]`           (canonical-first)
// Pattern B: `<id>.cropType || <id>.crop[...]`           (legacy-first)
// Pattern C: `<id>?.crop || <id>?.cropType[...]`         (optional chain)
// Pattern D: `<id>?.cropType || <id>?.crop[...]`         (optional chain rev)
// The identifier must match across both sides (backreference).
//
// `[A-Za-z_$][\w$]*` is the conservative JS identifier regex.
const PATTERN_A = /([A-Za-z_$][\w$]*)\.crop\s*\|\|\s*\1\.cropType\b/g;
const PATTERN_B = /([A-Za-z_$][\w$]*)\.cropType\s*\|\|\s*\1\.crop\b/g;
const PATTERN_C = /([A-Za-z_$][\w$]*)\?\.crop\s*\|\|\s*\1\?\.cropType\b/g;
const PATTERN_D = /([A-Za-z_$][\w$]*)\?\.cropType\s*\|\|\s*\1\?\.crop\b/g;

const HELPER_IMPORT_LINE = (relPath) =>
  `import { normalizeCrop } from '${relPath}';`;

function relPathToCrops(fileRel) {
  const fileAbs = resolve(ROOT, fileRel);
  const targetAbs = resolve(ROOT, 'src/config/crops.js');
  let r = relative(dirname(fileAbs), targetAbs).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

function alreadyImportsNormalizeCrop(text) {
  // Match `import { ..., normalizeCrop, ... } from '<...>config/crops...'`
  // or default-style imports — anything with normalizeCrop pulled from a
  // crops module. Skip injecting when an import already covers it.
  return /import\s*\{[^}]*\bnormalizeCrop\b[^}]*\}\s*from\s*['"][^'"]*config\/crops/.test(text);
}

function injectImport(text, relPath) {
  // Insert after the last existing `import ... from ...;` line so the
  // helper sits with its peers and tooling that orders imports
  // alphabetically can re-sort later.
  const importBlockRe = /^import [^\n]+;\s*$/gm;
  let lastEnd = -1;
  let m;
  while ((m = importBlockRe.exec(text))) {
    lastEnd = m.index + m[0].length;
  }
  const insertion = '\n' + HELPER_IMPORT_LINE(relPath);
  if (lastEnd < 0) return null; // no import block — caller decides
  return text.slice(0, lastEnd) + insertion + text.slice(lastEnd);
}

const summary = [];

for (const fileRel of TARGETS) {
  const fileAbs = resolve(ROOT, fileRel);
  let text;
  try { text = readFileSync(fileAbs, 'utf8'); }
  catch (err) {
    summary.push({ file: fileRel, status: 'READ-FAIL', reason: err.message });
    continue;
  }

  const before = text;
  // All four patterns collapse to `normalizeCrop(<id>)`. Capture the
  // identifier and substitute. normalizeCrop is null-safe so the
  // optional-chain cases (PATTERN_C / PATTERN_D) lose the `?.`
  // without changing behaviour — passing undefined returns ''.
  let after = before.replace(PATTERN_A, 'normalizeCrop($1)');
  after = after.replace(PATTERN_B, 'normalizeCrop($1)');
  after = after.replace(PATTERN_C, 'normalizeCrop($1)');
  after = after.replace(PATTERN_D, 'normalizeCrop($1)');

  if (after === before) {
    summary.push({ file: fileRel, status: 'no-match', changes: 0 });
    continue;
  }

  // Count how many distinct lines changed for the per-file diff log.
  const beforeLines = before.split('\n');
  const afterLines  = after.split('\n');
  let changedLines = 0;
  for (let i = 0; i < beforeLines.length; i++) {
    if (beforeLines[i] !== afterLines[i]) changedLines += 1;
  }

  // Inject import if needed.
  if (!alreadyImportsNormalizeCrop(after)) {
    const relPath = relPathToCrops(fileRel);
    const injected = injectImport(after, relPath);
    if (injected == null) {
      summary.push({
        file: fileRel,
        status: 'SKIP-NO-IMPORT-BLOCK',
        changes: changedLines,
      });
      continue;
    }
    after = injected;
  }

  writeFileSync(fileAbs, after, 'utf8');
  summary.push({ file: fileRel, status: 'updated', changes: changedLines });
}

console.log('[bulk-collapse-crop-defensive-reads] summary:');
for (const r of summary) {
  const tag = r.status.padEnd(20);
  const cnt = (r.changes != null ? r.changes.toString().padStart(3) : '   ');
  console.log(`  ${tag} ${cnt}  ${r.file}`);
}
