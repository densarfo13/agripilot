#!/usr/bin/env node
/**
 * scripts/check-retention-policy.mjs — Asserts retentionPolicy.ts
 * exists, RETENTION_POLICY covers all 8 spec category keys, and
 * autoDeleteEnabled is false (no surprise hard-deletes).
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

const FILE = path.join(ROOT, 'src/config/retentionPolicy.ts');
const raw = read(FILE);
if (!raw) {
  fail('retention: missing src/config/retentionPolicy.ts');
}
const code = stripComments(raw);

if (raw) {
  if (!/RETENTION_POLICY\s*[:=]/.test(code) &&
      !/const\s+RETENTION_POLICY\b/.test(code)) {
    fail('retention: RETENTION_POLICY object not declared');
  } else {
    pass('retention: RETENTION_POLICY declared');
  }
}

const SPEC_KEYS = [
  'scan_photos',
  'plant_records',
  'audit_events',
  'monitoring_events',
  'consent_records',
  'review_submissions',
  'crash_reports',
  'session_tokens',
];
let missing = 0;
for (const k of SPEC_KEYS) {
  const re = new RegExp("(['\"]?)" + k + "\\1\\s*:");
  if (!re.test(code)) {
    fail(`retention: RETENTION_POLICY missing key "${k}"`);
    missing++;
  }
}
if (raw && missing === 0) {
  pass('retention: 8 spec category keys present');
}

// autoDeleteEnabled:false constant
if (raw) {
  if (!/autoDeleteEnabled\s*:\s*false\b/.test(code) &&
      !/autoDeleteEnabled\s*=\s*false\b/.test(code)) {
    fail('retention: autoDeleteEnabled must be set to false (no surprise hard-deletes)');
  } else {
    pass('retention: autoDeleteEnabled:false verified');
  }
}

if (FAILED.length > 0) {
  console.error('[check:retention-policy] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:retention-policy] PASS — retentionPolicy.ts present, 8 keys covered, autoDeleteEnabled:false.');
