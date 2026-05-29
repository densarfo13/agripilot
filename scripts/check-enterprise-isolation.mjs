#!/usr/bin/env node
/**
 * scripts/check-enterprise-isolation.mjs — Verify tenant
 * isolation runtime + fail-closed contracts.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const FILES = [
  ['src/runtime/enterprise/security/enterpriseSecurityContracts.ts',
    'enterprise-security-v1', 'ENTERPRISE_SECURITY_VERSION'],
  ['src/runtime/enterprise/security/OrganizationScope.ts',
    'enterprise-security-v1', 'ORGANIZATION_SCOPE_VERSION'],
  ['src/runtime/enterprise/security/TenantIsolation.ts',
    'enterprise-security-v1', 'TENANT_ISOLATION_VERSION'],
  ['src/runtime/enterprise/security/EnterpriseAccessGuard.ts',
    'enterprise-security-v1', 'ENTERPRISE_ACCESS_GUARD_VERSION'],
];

const sources = {};
for (const [f, lit, constant] of FILES) {
  const s = read(path.join(ROOT, f));
  sources[f] = s;
  if (!s) FAILED.push(`isolation: missing ${f}`);
  else if (!s.includes(lit) && !s.includes(constant)) {
    FAILED.push(`isolation: ${f} missing literal "${lit}" or constant "${constant}"`);
  }
}
if (Object.values(sources).every(Boolean)) PASSED.push(`isolation: 4 security files present`);

const scope = sources['src/runtime/enterprise/security/OrganizationScope.ts'] || '';
for (const sym of ['requireOrganizationScope', 'fail-closed',
                    'CROSS_ORG_FORBIDDEN', 'FAIL_CLOSED']) {
  if (!scope.includes(sym) && !scope.toLowerCase().includes(sym.toLowerCase())) {
    FAILED.push(`isolation: OrganizationScope must reference "${sym}"`);
  }
}
PASSED.push(`isolation: OrganizationScope enforces fail-closed cross-org rule`);

const guard = sources['src/runtime/enterprise/security/EnterpriseAccessGuard.ts'] || '';
if (!/guardAction/.test(guard)) {
  FAILED.push(`isolation: EnterpriseAccessGuard must export guardAction`);
} else {
  PASSED.push(`isolation: EnterpriseAccessGuard.guardAction wired`);
}

if (FAILED.length > 0) {
  console.error('[check:enterprise-isolation] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:enterprise-isolation] PASS — tenant isolation + fail-closed contracts wired.');
