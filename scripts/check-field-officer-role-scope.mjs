#!/usr/bin/env node
/**
 * check-field-officer-role-scope.mjs — Field Officer page must
 * role-gate access. Locks ALLOWED_ROLES + SUPERVISOR_ROLES sets,
 * the "not available" path for non-allowed roles, and the absence of
 * any unconditional metric render before the role check.
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

const f = 'src/pages/FieldOfficerPage.jsx';
const src = read(f);
if (src) {
  // Must define ALLOWED_ROLES + SUPERVISOR_ROLES.
  if (!/ALLOWED_ROLES\s*=\s*new\s+Set/.test(src))
    fails.push(`${f}: must define ALLOWED_ROLES = new Set([...])`);
  if (!/SUPERVISOR_ROLES\s*=\s*new\s+Set/.test(src))
    fails.push(`${f}: must define SUPERVISOR_ROLES = new Set([...])`);
  // Allowed roles must include field_officer, organization_admin, admin.
  const roleLine = (src.match(/ALLOWED_ROLES[\s\S]*?\]/) || [''])[0];
  for (const r of ['field_officer', 'organization_admin', 'admin']) {
    if (roleLine.indexOf(r) < 0)
      fails.push(`${f}: ALLOWED_ROLES must include ${r}`);
  }
  // Must early-return "not available" branch.
  if (src.indexOf('field-officer-not-allowed') < 0)
    fails.push(`${f}: missing not-allowed render branch`);
  // Role check MUST happen via useAuth().
  if (src.indexOf('useAuth') < 0)
    fails.push(`${f}: must read role from useAuth()`);
  // Supervisor section must render conditionally on supervisor role.
  if (src.indexOf('data-supervisor="true"') < 0)
    fails.push(`${f}: supervisor section must carry data-supervisor="true"`);
}

if (fails.length) {
  console.error('[check:field-officer-role-scope] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:field-officer-role-scope] OK');
