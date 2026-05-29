#!/usr/bin/env node
/**
 * scripts/check-backup-docs.mjs — Asserts the production backup
 * & restore runbook exists and covers the 6 spec sections.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const DOC = path.join(ROOT, 'docs/PRODUCTION_BACKUP_RESTORE.md');
const doc = read(DOC);
if (!doc) {
  fail('backup: missing docs/PRODUCTION_BACKUP_RESTORE.md');
} else {
  pass('backup: PRODUCTION_BACKUP_RESTORE.md present');
}

const SPEC_SECTIONS = [
  { name: 'postgres backup', patterns: [/postgres\s+backup/i, /pg_dump/i, /Postgres\s+Backup/] },
  { name: 'restore test',    patterns: [/restore\s+test/i, /restore\s+drill/i] },
  { name: 'cloudinary',      patterns: [/cloudinary/i] },
  { name: 'env vars',        patterns: [/env(?:ironment)?\s+variable/i, /env\s+var/i] },
  { name: 'rollback plan',   patterns: [/rollback\s+plan/i, /Rollback\s+Plan/] },
  { name: 'release rollback',patterns: [/release\s+rollback/i, /Release\s+Rollback/] },
];
let missing = 0;
for (const sec of SPEC_SECTIONS) {
  const hit = sec.patterns.some((re) => re.test(doc));
  if (!hit) {
    fail(`backup: PRODUCTION_BACKUP_RESTORE.md missing section "${sec.name}"`);
    missing++;
  }
}
if (doc && missing === 0) {
  pass('backup: 6 spec sections present');
}

if (FAILED.length > 0) {
  console.error('[check:backup-docs] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:backup-docs] PASS — backup runbook present, 6 spec sections covered.');
