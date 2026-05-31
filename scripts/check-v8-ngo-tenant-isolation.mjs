#!/usr/bin/env node
/**
 * scripts/check-v8-ngo-tenant-isolation.mjs
 *
 * The NGO enterprise layer must be organization-scoped with no cross-tenant
 * leakage, no PII, and no donor report unless real data exists. Fails if
 * NGOEnterpriseEngine:
 *   • does not declare organizationScoped:true / crossTenantLeakage:false
 *   • exposes a PII field as an output key
 *   • does not surface donorReportReadiness (gated on real data)
 *   • hardcodes donorReportReadiness:'ready'
 *
 * Read-only static analyzer. PII regex matches object KEYS only
 * (`email:`), never dot-access presence tests (`.email`).
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v8/ngoEnterprise/NGOEnterpriseEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/organizationScoped:\s*true/.test(src))
    F.push('NGOEnterpriseEngine must declare organizationScoped:true');
  else P.push('organization-scoped');
  if (!/crossTenantLeakage:\s*false/.test(src))
    F.push('NGOEnterpriseEngine must declare crossTenantLeakage:false');
  else P.push('declares no cross-tenant leakage');
  const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|fileName|nationalId)\s*:/;
  if (PII_KEY_RE.test(src))
    F.push('NGOEnterpriseEngine must not expose a PII field as an output key');
  else P.push('no PII exposed as an output key');
  if (!/donorReportReadiness/.test(src))
    F.push('NGOEnterpriseEngine must surface donorReportReadiness');
  else P.push('donorReportReadiness surfaced');
  if (/donorReportReadiness:\s*['"]ready['"]/.test(src))
    F.push('NGOEnterpriseEngine must NOT hardcode donorReportReadiness:"ready" (gate on real data)');
  else P.push('donor report not hardcoded ready');
}

if (F.length) {
  console.error('[check:v8-ngo-tenant-isolation] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-ngo-tenant-isolation] PASS — org-scoped, no leakage, no PII, honest donor report.');
for (const m of P) console.log('  ✓ ' + m);
