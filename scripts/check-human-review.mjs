#!/usr/bin/env node
/**
 * scripts/check-human-review.mjs — Human review runtime sanity:
 * 4 spec files + ReviewPage.jsx, REVIEW_TYPES covers 5 types,
 * /internal/review route mounted in src/App.jsx.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const DIR = path.join(ROOT, 'src/runtime/review');
const SPEC_FILES = [
  'reviewContracts.ts',
  'ReviewQueue.ts',
  'ReviewRuntime.ts',
  'index.ts',
];
const sources = {};
for (const f of SPEC_FILES) {
  const s = read(path.join(DIR, f));
  sources[f] = s;
  if (!s) fail(`review: missing src/runtime/review/${f}`);
}
const pagePath = path.join(ROOT, 'src/runtime/review/ReviewPage.jsx');
const pageSrc = read(pagePath);
if (!pageSrc) fail('review: missing src/runtime/review/ReviewPage.jsx');
if (Object.values(sources).every(Boolean) && pageSrc) {
  pass('review: 4 spec files + ReviewPage.jsx present');
}

const SPEC_TYPES = [
  'scan_low_confidence',
  'scan_user_flagged',
  'plant_misidentified',
  'content_report',
  'safety_concern',
];
const contracts = stripComments(sources['reviewContracts.ts'] || '');
let missing = 0;
for (const t of SPEC_TYPES) {
  if (!new RegExp("'" + t + "'").test(contracts) &&
      !new RegExp('"' + t + '"').test(contracts)) {
    fail(`review: REVIEW_TYPES missing "${t}"`);
    missing++;
  }
}
if (missing === 0) pass('review: 5 spec types covered in REVIEW_TYPES');

const appPath = path.join(ROOT, 'src/App.jsx');
const app = stripComments(read(appPath));
if (!app) {
  fail('review: src/App.jsx not found');
} else {
  const hasRoute =
    /['"`]\/internal\/review['"`]/.test(app) ||
    /path\s*=\s*['"`]\/internal\/review['"`]/.test(app);
  const mounts =
    /<\s*ReviewPage\b/.test(app);
  if (!hasRoute) {
    fail('review: src/App.jsx does not declare a /internal/review route');
  }
  if (!mounts) {
    fail('review: src/App.jsx does not mount <ReviewPage>');
  }
  if (hasRoute && mounts) {
    pass('review: /internal/review route mounts <ReviewPage> in src/App.jsx');
  }
}

if (FAILED.length > 0) {
  console.error('[check:human-review] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:human-review] PASS — review runtime present, 5 types covered, /internal/review route mounted.');
