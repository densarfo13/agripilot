#!/usr/bin/env node
/**
 * scripts/check-enterprise-readiness.mjs — Static-side checks
 * the EnterpriseReadinessGate depends on. Fails CI if any of
 * the underlying runtimes are missing.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const REQUIRED_RUNTIMES = [
  'src/runtime/enterprise/security/enterpriseSecurityContracts.ts',
  'src/runtime/enterprise/security/OrganizationScope.ts',
  'src/runtime/enterprise/security/TenantIsolation.ts',
  'src/runtime/enterprise/security/EnterpriseAccessGuard.ts',
  'src/runtime/security/RBACRuntime.ts',
  'src/runtime/audit/AuditRuntime.ts',
  'src/runtime/artifacts/EvidenceChain.ts',
  'src/runtime/reports/ReportRuntime.ts',
  'src/runtime/outcomes/OutcomeRuntime.ts',
  'src/runtime/reliability/ReliabilityRuntime.ts',
  'src/runtime/enterprise/EnterpriseReadinessGate.ts',
];
for (const f of REQUIRED_RUNTIMES) {
  if (!read(path.join(ROOT, f))) {
    FAILED.push(`enterprise-readiness: missing required runtime ${f}`);
  }
}
if (FAILED.length === 0) {
  PASSED.push(`enterprise-readiness: 11 required runtimes present`);
}

const gate = read(path.join(ROOT,
  'src/runtime/enterprise/EnterpriseReadinessGate.ts'));
for (const sym of ['enterpriseReadiness',
                    'installEnterpriseReadinessGlobal',
                    'organizationIsolation', 'rbac', 'auditLogs',
                    'evidenceChain', 'reportRuntime',
                    'outcomeTracking', 'reliabilityDiagnostics',
                    'fakeDataAbsent', 'roleGuards', 'offlineCore',
                    "'READY'", "'CONDITIONAL'", "'NOT_READY'"]) {
  if (!gate.includes(sym)) {
    FAILED.push(`enterprise-readiness: EnterpriseReadinessGate missing "${sym}"`);
  }
}
PASSED.push(`enterprise-readiness: gate emits all 10 spec checks + 3 verdict states`);

// Boot install referenced in App.jsx
const app = read(path.join(ROOT, 'src/App.jsx'));
if (!/installEnterpriseReadinessGlobal/.test(app)) {
  FAILED.push(`enterprise-readiness: App.jsx must wire installEnterpriseReadinessGlobal()`);
}
for (const installer of ['installRBACGlobal', 'installAuditRuntimeGlobal',
                          'installEvidenceChainGlobal',
                          'installReportRuntimeGlobal',
                          'installOutcomeRuntimeGlobal',
                          'installReliabilityRuntimeGlobal']) {
  if (!app.includes(installer)) {
    FAILED.push(`enterprise-readiness: App.jsx must call ${installer}()`);
  }
}
PASSED.push(`enterprise-readiness: 7 boot installs wired into App.jsx`);

if (FAILED.length > 0) {
  console.error('[check:enterprise-readiness] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:enterprise-readiness] PASS — gate + 11 sub-runtimes + 7 boot installs wired.');
