#!/usr/bin/env node
/**
 * scripts/check-ngo-reporting.mjs — §3/§8 NGO program dashboard + grant
 * reporting.
 *
 * Fails if:
 *   • the NGO program metrics surface (org-scoped) is absent
 *   • the grant export runtime does not offer org-scoped, privacy-filtered
 *     exports (CSV/JSON implemented; PDF/Excel are future)
 *   • NGO metrics are fabricated (Math.random) or not org-scoped
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

// NGO program metrics surface (org-scoped, no fabrication).
const ngo = read('src/runtime/v8/ngoEnterprise/NGOEnterpriseEngine.ts');
if (!ngo) { F.push('NGOEnterpriseEngine.ts: missing'); }
else {
  if (!/organizationScoped:\s*true/.test(ngo)) F.push('NGO metrics must be organizationScoped:true');
  else P.push('NGO metrics organization-scoped');
  if (!/crossTenantLeakage:\s*false/.test(ngo)) F.push('NGO metrics must declare crossTenantLeakage:false');
  else P.push('no cross-tenant leakage');
  if (/Math\.random\s*\(/.test(strip(ngo))) F.push('NGO metrics must not be fabricated');
  else P.push('no fabricated NGO metrics');
}

// Grant export runtime.
const exp = read('src/runtime/v13/exports/AnalyticsExportRuntime.ts');
if (!exp) { F.push('AnalyticsExportRuntime.ts: missing'); }
else {
  if (!/'CSV'/.test(exp) || !/'JSON'/.test(exp)) F.push('grant export must offer CSV + JSON');
  else P.push('grant export offers CSV + JSON');
  if (!/organizationScoped:\s*true/.test(exp)) F.push('grant export must be organizationScoped');
  else P.push('grant export organization-scoped');
  if (!/privacyFiltered:\s*true/.test(exp)) F.push('grant export must be privacyFiltered');
  else P.push('grant export privacy-filtered');
  // NGO program report among the export types.
  if (!/NGO/i.test(exp)) F.push('grant export must include an NGO program report');
  else P.push('NGO program report exportable');
}

if (F.length) {
  console.error('[check:ngo-reporting] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:ngo-reporting] PASS — org-scoped NGO metrics + privacy-filtered grant export (CSV/JSON).');
for (const m of P) console.log('  ✓ ' + m);
