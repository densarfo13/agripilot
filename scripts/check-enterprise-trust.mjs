#!/usr/bin/env node
/**
 * scripts/check-enterprise-trust.mjs — Wave-40 governance gate.
 *
 * Statically enforces the enterprise trust + operations
 * hardening contract:
 *
 *   • AuditRuntime extends AUDIT_ACTIONS with the 18 wave-40
 *     canonical events + emits coverage attestation.
 *   • TenantIsolationHealthRuntime ships + installs the global.
 *   • BackupHealthRuntime ships + reads operator flags +
 *     attests runbook presence.
 *   • SecurityHealthRuntime ships + composes 8 attestations.
 *   • ProgramEvidenceHealthRuntime ships + composes the
 *     5-step evidence chain.
 *   • EnterpriseReadinessRuntime ships + emits the 4-tier
 *     verdict ladder.
 *   • App.jsx wires the 5 new installers + markBackupRunbookPresent.
 *   • docs/BACKUP_RUNBOOK.md ships with all 6 spec sections.
 *   • ReleaseLockRuntime surfaces the 5 new readiness flags:
 *     auditReady, securityReady, backupReady, monitoringReady,
 *     evidenceReady.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}
function requireFile(rel, label) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fail(`${label}: ${rel} must exist`);
    return '';
  }
  pass(`${label}: ${rel} present`);
  return read(full);
}
function requireFields(src, fields, label) {
  for (const f of fields) {
    const re = new RegExp(`\\b${f}\\b`);
    if (!re.test(src)) fail(`${label}: missing token "${f}"`);
  }
}

// ─── 1. Audit runtime canonical coverage ───────────────────────
const auditContractsSrc = requireFile(
  'src/runtime/audit/auditContracts.ts', 'audit');
requireFields(auditContractsSrc, [
  'AUDIT_EVENT_COVERAGE',
  'failed_login', 'mfa_enrolled',
  'farmer_created', 'farmer_updated', 'farmer_deleted',
  'scan_completed', 'enrollment_created',
  'listing_created', 'invite_sent', 'invite_accepted',
  'admin_action',
], 'audit');
const auditRuntimeSrc = requireFile(
  'src/runtime/audit/AuditRuntime.ts', 'audit');
requireFields(auditRuntimeSrc, [
  'canonicalEventsCovered', 'eventCoverage',
], 'audit');

// ─── 2. Tenant isolation global ────────────────────────────────
const tenantSrc = requireFile(
  'src/runtime/enterprise/security/TenantIsolationHealthRuntime.ts',
  'tenant');
requireFields(tenantSrc, [
  '__tenantIsolationHealth', 'noCrossTenantLeakage',
  'organizationScopedDataReady', 'buyerIsolationReady',
  'ngoIsolationReady', 'adminRoleSeparationReady',
], 'tenant');

// ─── 3. Backup runtime ─────────────────────────────────────────
const backupSrc = requireFile(
  'src/runtime/backup/BackupHealthRuntime.ts', 'backup');
requireFields(backupSrc, [
  '__backupHealth', 'databaseBackupConfigured',
  'artifactBackupConfigured', 'restoreProcedureDocumented',
  'FARROWAY_DB_BACKUP_CONFIGURED',
  'FARROWAY_ARTIFACT_BACKUP_CONFIGURED',
  'markBackupRunbookPresent',
], 'backup');

// ─── 4. Security runtime ───────────────────────────────────────
const securitySrc = requireFile(
  'src/runtime/security/SecurityHealthRuntime.ts', 'security');
requireFields(securitySrc, [
  '__securityHealth', 'secretsNotExposed',
  'jwtExpirationEnforced', 'inviteTokenHashing',
  'rateLimitingActive', 'apiAuthorizationGuarded',
  'routeGuardsActive', 'cspHeadersActive', 'secureCookiesActive',
], 'security');

// ─── 5. Program evidence runtime ───────────────────────────────
const evidenceSrc = requireFile(
  'src/runtime/evidence/ProgramEvidenceHealthRuntime.ts',
  'evidence');
requireFields(evidenceSrc, [
  '__programEvidenceHealth',
  'farmerOnboardingEvidenced', 'interventionAssigned',
  'taskCompletionEvidenced', 'scanCompletionEvidenced',
  'outcomeCaptured', 'exportable', 'evidenceReady',
], 'evidence');

// ─── 6. Enterprise readiness runtime ───────────────────────────
const readinessSrc = requireFile(
  'src/runtime/enterprise/EnterpriseReadinessRuntime.ts',
  'enterprise-readiness');
requireFields(readinessSrc, [
  '__enterpriseReadiness',
  'NOT_READY', 'PILOT_READY', 'PRODUCTION_READY', 'ENTERPRISE_READY',
  'attestations', 'auditReady', 'tenantIsolationReady',
  'securityReady', 'backupReady', 'monitoringReady',
  'evidenceReady', 'persistenceReady',
], 'enterprise-readiness');

// ─── 7. App.jsx wires + runbook flag set ───────────────────────
const appSrc = requireFile('src/App.jsx', 'wiring');
for (const fn of [
  'installTenantIsolationHealthGlobal',
  'installBackupHealthGlobal',
  'installSecurityHealthGlobal',
  'installProgramEvidenceHealthGlobal',
  'installEnterpriseReadinessGlobal',
  'markBackupRunbookPresent',
]) {
  if (!new RegExp(fn).test(appSrc)) {
    fail(`wiring: App.jsx must wire ${fn}`);
  }
}

// ─── 8. Backup runbook present + sections ──────────────────────
const runbookSrc = requireFile('docs/BACKUP_RUNBOOK.md', 'docs');
const requiredSections = [
  /## 1\.\s+Database backups/i,
  /## 2\.\s+Evidence artifact backups/i,
  /## 3\.\s+Restore procedure \(database\)/i,
  /## 4\.\s+Restore procedure \(artifacts\)/i,
  /## 5\.\s+Rehearsal cadence/i,
  /## 7\.\s+Wave-40 readiness contract/i,
];
for (const re of requiredSections) {
  if (!re.test(runbookSrc)) {
    fail(`docs: BACKUP_RUNBOOK.md missing required section ${re}`);
  }
}

// ─── 9. ReleaseLock surfaces the 5 new flags ───────────────────
const releaseSrc = requireFile(
  'src/runtime/release/ReleaseLockRuntime.ts', 'release-lock');
for (const flag of [
  'auditReady', 'securityReady', 'backupReady',
  'monitoringReady', 'evidenceReady',
]) {
  if (!new RegExp(`\\b${flag}\\b`).test(releaseSrc)) {
    fail(`release-lock: must surface ${flag}`);
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:enterprise-trust] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:enterprise-trust] PASS — wave-40 enterprise trust contracts intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
