#!/usr/bin/env node
/**
 * scripts/check-audit-logging.mjs — Audit runtime sanity +
 * append-only + PII drop-list assertion.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const FILES = [
  ['src/runtime/audit/auditContracts.ts',   'farroway-audit-runtime-v1', 'AUDIT_RUNTIME_VERSION'],
  ['src/runtime/audit/AuditEventWriter.ts', 'farroway-audit-runtime-v1', 'AUDIT_WRITER_VERSION'],
  ['src/runtime/audit/AuditEventReader.ts', 'farroway-audit-runtime-v1', 'AUDIT_READER_VERSION'],
  ['src/runtime/audit/AuditRuntime.ts',     'farroway-audit-runtime-v1', 'AUDIT_RUNTIME_VERSION'],
  ['src/runtime/audit/index.ts',            'farroway-audit-runtime-v1', 'AUDIT_RUNTIME_VERSION'],
];
const sources = {};
for (const [f, lit, c] of FILES) {
  const s = read(path.join(ROOT, f));
  sources[f] = s;
  if (!s) FAILED.push(`audit: missing ${f}`);
  else if (!s.includes(lit) && !s.includes(c)) {
    FAILED.push(`audit: ${f} missing "${lit}" or "${c}"`);
  }
}
if (Object.values(sources).every(Boolean)) PASSED.push(`audit: 5 files present`);

const contracts = sources['src/runtime/audit/auditContracts.ts'] || '';
const SPEC_ACTIONS = ['login','logout','scan_created','plant_created',
  'task_completed','artifact_created','sell_ready_marked',
  'buyer_interest_sent','organization_created','program_created',
  'cohort_created','intervention_created','intervention_completed',
  'report_exported','role_changed','permission_denied'];
for (const a of SPEC_ACTIONS) {
  if (!new RegExp("'" + a + "'").test(contracts)) {
    FAILED.push(`audit: AUDIT_ACTIONS missing "${a}"`);
  }
}
PASSED.push(`audit: 16 spec actions covered`);

// PII drop-list
const REQUIRED_PII = ['password','token','apiKey','secret',
  'authorization','cookie','phone','email','fullName',
  'fileName','gpsExact'];
for (const f of REQUIRED_PII) {
  if (!new RegExp("'" + f + "'").test(contracts)) {
    FAILED.push(`audit: AUDIT_PII_DROP_LIST missing "${f}"`);
  }
}
PASSED.push(`audit: PII drop-list covers ${REQUIRED_PII.length} fields`);

// Writer must be append-only — strip comments, then assert no
// in-place mutation of _events array beyond push().
const writer = sources['src/runtime/audit/AuditEventWriter.ts'] || '';
const stripped = writer.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
if (/_events\s*\[\s*\d+\s*\]\s*=/.test(stripped)) {
  FAILED.push(`audit: AuditEventWriter mutates _events by index — must be append-only`);
}
if (!/\.push\s*\(/.test(stripped)) {
  FAILED.push(`audit: AuditEventWriter must append via .push()`);
}
PASSED.push(`audit: writer is append-only (push-only on _events)`);

if (FAILED.length > 0) {
  console.error('[check:audit-logging] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:audit-logging] PASS — audit runtime + append-only + PII drop-list verified.');
