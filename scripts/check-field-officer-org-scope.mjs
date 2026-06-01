#!/usr/bin/env node
/**
 * check-field-officer-org-scope.mjs — Field Officer page MUST NOT
 * cross organization boundaries. Locks that runtimes read existing
 * tenant-scoped probes only and declare noCrossOrgLeakage literal-true.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

// Dashboard runtime must declare orgScoped + noCrossOrgLeakage literal-true.
{
  const f = 'src/runtime/fieldOfficer/FieldOfficerDashboardRuntime.ts';
  const src = read(f);
  if (src) {
    if (src.indexOf('orgScoped: true as const') < 0)
      fails.push(`${f}: must declare orgScoped: true as const`);
    if (src.indexOf('noCrossOrgLeakage: true as const') < 0)
      fails.push(`${f}: must declare noCrossOrgLeakage: true as const`);
  }
}

// Supervisor metrics runtime must declare orgScoped literal-true.
{
  const f = 'src/runtime/fieldOfficer/FieldOfficerSupervisorMetrics.ts';
  const src = read(f);
  if (src && src.indexOf('orgScoped: true as const') < 0)
    fails.push(`${f}: must declare orgScoped: true as const`);
}

// Page must carry data-org-scoped="true" marker.
{
  const f = 'src/pages/FieldOfficerPage.jsx';
  const src = read(f);
  if (src && src.indexOf('data-org-scoped="true"') < 0)
    fails.push(`${f}: must carry data-org-scoped="true"`);
}

// Runtimes must compose existing probes only — no direct DB / network calls.
const checkFiles = [
  'src/runtime/fieldOfficer/FieldOfficerDashboardRuntime.ts',
  'src/runtime/fieldOfficer/FieldOfficerSupervisorMetrics.ts',
];
for (const f of checkFiles) {
  const src = read(f);
  if (!src) continue;
  // No `fetch(` calls — supervisor data flows through upstream probes.
  if (/\bfetch\s*\(/.test(src))
    fails.push(`${f}: must NOT call fetch() directly — use upstream probes`);
  // No `prisma` / `axios` direct imports either.
  if (/from\s+['"](prisma|axios|node:fs)['"]/.test(src))
    fails.push(`${f}: must NOT import server/DB libs`);
}

if (fails.length) {
  console.error('[check:field-officer-org-scope] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:field-officer-org-scope] OK');
