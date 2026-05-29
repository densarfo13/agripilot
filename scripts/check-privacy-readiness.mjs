#!/usr/bin/env node
/**
 * scripts/check-privacy-readiness.mjs — Asserts the App Store
 * privacy checklist doc covers all 7 spec data types and that
 * the app surfaces /privacy or /terms links somewhere.
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

const DOC = path.join(ROOT, 'docs/APP_STORE_PRIVACY_CHECKLIST.md');
const doc = read(DOC);
if (!doc) {
  fail('privacy: missing docs/APP_STORE_PRIVACY_CHECKLIST.md');
} else {
  pass('privacy: APP_STORE_PRIVACY_CHECKLIST.md present');
}

const SPEC_DATA_TYPES = [
  'Contact info',
  'User content',
  'Photos',
  'Location',
  'Identifiers',
  'Diagnostics',
  'Usage data',
];
let typesMissing = 0;
for (const t of SPEC_DATA_TYPES) {
  if (!doc.includes(t)) {
    fail(`privacy: APP_STORE_PRIVACY_CHECKLIST.md missing data type "${t}"`);
    typesMissing++;
  }
}
if (doc && typesMissing === 0) {
  pass(`privacy: 7 spec data types documented`);
}

// Search src/pages and src/components for /privacy or /terms literal
function walk(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) acc.push(full);
  }
  return acc;
}
const candidates = [
  ...walk(path.join(ROOT, 'src/pages')),
  ...walk(path.join(ROOT, 'src/components')),
];
let privacyFound = false, termsFound = false;
for (const file of candidates) {
  const code = stripComments(read(file));
  if (/['"`]\/privacy(['"`?/#])/.test(code) ||
      /to\s*=\s*['"`]\/privacy['"`]/.test(code) ||
      /href\s*=\s*['"`]\/privacy['"`]/.test(code) ||
      /['"`]\/privacy['"`]/.test(code)) {
    privacyFound = true;
  }
  if (/['"`]\/terms(['"`?/#])/.test(code) ||
      /to\s*=\s*['"`]\/terms['"`]/.test(code) ||
      /href\s*=\s*['"`]\/terms['"`]/.test(code) ||
      /['"`]\/terms['"`]/.test(code)) {
    termsFound = true;
  }
  if (privacyFound && termsFound) break;
}
if (!privacyFound && !termsFound) {
  fail('privacy: no "/privacy" or "/terms" link reference found in src/pages or src/components');
} else {
  pass(`privacy: link reference present (privacy=${privacyFound}, terms=${termsFound})`);
}

if (FAILED.length > 0) {
  console.error('[check:privacy-readiness] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:privacy-readiness] PASS — privacy checklist documents 7 data types and app links to /privacy or /terms.');
