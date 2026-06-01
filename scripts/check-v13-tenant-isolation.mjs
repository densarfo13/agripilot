#!/usr/bin/env node
/**
 * scripts/check-v13-tenant-isolation.mjs — V13 must be org-scoped, privacy-
 * filtered, and expose no PII.
 *
 * Fails if:
 *   • the governance runtime does not surface orgScoping + buyerPrivacy +
 *     exportPrivacy readiness
 *   • the analytics export runtime does not assert organizationScoped +
 *     privacyFiltered
 *   • any V13 runtime exposes a PII field as an output key
 *
 * Read-only static analyzer. PII regex matches object KEYS only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const DIR = 'src/runtime/v13';
function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel));
    else if (e.name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

// Governance surfaces org/buyer/export privacy.
const gov = read(`${DIR}/governance/DataGovernanceRuntime.ts`);
if (!gov) F.push('DataGovernanceRuntime.ts: missing');
else {
  for (const flag of ['orgScopingReady', 'buyerPrivacyReady', 'exportPrivacyReady']) {
    if (!gov.includes(flag)) F.push(`DataGovernanceRuntime must surface ${flag}`);
  }
  if (!F.some((m) => m.includes('orgScopingReady') || m.includes('buyerPrivacyReady') || m.includes('exportPrivacyReady')))
    P.push('governance surfaces org/buyer/export privacy readiness');
}

// Analytics export org-scoped + privacy-filtered.
const exp = read(`${DIR}/exports/AnalyticsExportRuntime.ts`);
if (!exp) F.push('AnalyticsExportRuntime.ts: missing');
else {
  if (!/organizationScoped:\s*true/.test(exp)) F.push('AnalyticsExportRuntime must assert organizationScoped:true');
  if (!/privacyFiltered:\s*true/.test(exp)) F.push('AnalyticsExportRuntime must assert privacyFiltered:true');
  if (!F.some((m) => m.includes('organizationScoped') || m.includes('privacyFiltered')))
    P.push('analytics export is org-scoped + privacy-filtered');
}

// No PII exposed as an output key anywhere in V13.
const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|fileName|nationalId)\s*:/;
let exposed = 0;
for (const rel of walk(DIR)) {
  const src = strip(read(rel));
  if (src && PII_KEY_RE.test(src)) { F.push(`${rel}: exposes a PII field as an output key`); exposed++; }
}
if (!exposed) P.push('no V13 runtime exposes a PII field as an output key');

if (F.length) {
  console.error('[check:v13-tenant-isolation] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-tenant-isolation] PASS — org-scoped, privacy-filtered, no PII exposure.');
for (const m of P) console.log('  ✓ ' + m);
