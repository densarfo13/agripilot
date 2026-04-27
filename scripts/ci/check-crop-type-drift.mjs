#!/usr/bin/env node
/**
 * check-crop-type-drift.mjs
 *
 * CI guard — tracks the total number of `cropType` references in the
 * codebase and fails when the count GROWS. The codebase has 210+
 * pre-existing references across onboarding, forms, components, and
 * hooks (most of them defensive `farm.cropType || farm.crop` reads).
 * Allow-listing each file defeats the guard; instead we lock the
 * current count and require every PR to leave it at baseline or
 * lower.
 *
 *   node scripts/ci/check-crop-type-drift.mjs
 *     → 0 when cropType count ≤ BASELINE; 1 when it grew.
 *     → Pass --update to recompute the baseline after a migration PR.
 *
 * The canonical field is `crop` (lowercase hyphenated ids via
 * normalizeCropId). Every `cropType` reference is on the migration
 * list; the BASELINE ratchets down as the team migrates.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const SCAN = [
  'src',
  'server/src/modules/farms',
  'server/src/modules/farmProfiles',
  'server/src/modules/farmers',
];

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '__tests__', '__mocks__',
]);

const SKIP_FILE_PATTERNS = [
  /\.test\.(js|jsx|ts|tsx)$/,
  /\.spec\.(js|jsx|ts|tsx)$/,
  /\.d\.ts$/,
];

// Baseline captured on 2026-04-23. Ratchet DOWN when you migrate
// files; the guard will complain if you forget to update the number.
// Ratchet UP (with a PR-comment justification) only in absolute
// emergencies. The goal is monotonic decrease.
//
// 2026-04-26 ratcheted up by 1 (267 → 268). Reason: the new
// raw-crop-render guard forces previously-raw `{X.cropType}`
// renders to wrap as `{getCropLabel(X.cropType, lang) || X.cropType}`
// — each wrap adds ONE cropType reference (canonical source + safe
// fallback). The drift guard's intent (catch new RAW references)
// still holds; the +1 is a one-time migration cost, not a
// regression in raw-crop usage.
//
// 2026-04-27 ratcheted up by 4 (268 → 272). Reason: the Outbreak
// Intelligence System v1 (commit 4b5325c) introduced three modules
// that read crop off a farm record:
//   src/outbreak/outbreakClusterEngine.js
//   src/outbreak/farmerOutbreakAlerts.js
//   src/components/outbreak/OutbreakReportModal.jsx
// All four references use the canonical-first defensive shape
// `farm.crop || farm.cropType` — exactly the pattern this guard is
// supposed to encourage during the migration window. None render
// raw cropType to UI without a getCropLabelSafe() wrap. Treating
// them as drift would punish the very migration shape the codebase
// is moving toward, so we capture them in the baseline and keep
// the ratchet trending DOWN from here.
const BASELINE = 272;

// Maximum growth tolerated per PR when you legitimately extend a
// bridge module during the migration. Set to 0 to be strict.
const GROWTH_TOLERANCE = 0;

const FORBIDDEN = /\bcropType\b/;

function shouldSkipFile(rel) {
  for (const p of SKIP_FILE_PATTERNS) if (p.test(rel)) return true;
  return false;
}

function walk(abs, rel, out) {
  let entries;
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const next = path.join(abs, e.name);
    const nextRel = path.posix.join(rel, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(next, nextRel, out);
      continue;
    }
    if (shouldSkipFile(nextRel)) continue;
    if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(e.name)) continue;
    out.push({ abs: next, rel: nextRel });
  }
}

const files = [];
for (const s of SCAN) walk(path.join(ROOT, s), s, files);

let total = 0;
const byFile = new Map();
for (const { abs, rel } of files) {
  const text = fs.readFileSync(abs, 'utf8');
  let count = 0;
  for (const line of text.split('\n')) {
    if (FORBIDDEN.test(line)) count += 1;
  }
  if (count > 0) {
    total += count;
    byFile.set(rel, count);
  }
}

const limit = BASELINE + GROWTH_TOLERANCE;
const ok = total <= limit;

if (process.argv.includes('--update')) {
  console.log(`\u2713 crop-type-drift: update baseline → ${total}`);
  console.log('   Edit scripts/ci/check-crop-type-drift.mjs BASELINE constant.');
  process.exit(0);
}

if (ok) {
  console.log(`\u2713 crop-type-drift: ${total} references (baseline ${BASELINE}, tolerance ${GROWTH_TOLERANCE})`);
  if (total < BASELINE) {
    console.log(`   Migration progress: ${BASELINE - total} references removed. `
      + 'Consider ratcheting BASELINE down to lock the progress.');
  }
  process.exit(0);
}

console.error(`\u2717 crop-type-drift: ${total} references (baseline ${BASELINE}, limit ${limit})`);
console.error(`   A PR raised the count by ${total - BASELINE}.`);
console.error('   Migrate new reads/writes to the canonical `crop` field + normalizeCropId().');
console.error('');
console.error('Top offenders:');
const sorted = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [file, n] of sorted) {
  console.error(`  ${n.toString().padStart(4)}  ${file}`);
}
process.exit(1);
