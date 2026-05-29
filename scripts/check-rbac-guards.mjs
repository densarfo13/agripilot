#!/usr/bin/env node
/**
 * scripts/check-rbac-guards.mjs — RBAC runtime + permission
 * matrix sanity.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const FILES = [
  ['src/runtime/security/roleContracts.ts',     'farroway-rbac-v1', 'RBAC_VERSION'],
  ['src/runtime/security/permissionMatrix.ts',  'ROLE_PERMISSIONS', 'ROLE_PERMISSIONS'],
  ['src/runtime/security/RBACRuntime.ts',       'farroway-rbac-v1', 'RBAC_VERSION'],
];
const sources = {};
for (const [f, lit, c] of FILES) {
  const s = read(path.join(ROOT, f));
  sources[f] = s;
  if (!s) FAILED.push(`rbac: missing ${f}`);
  else if (!s.includes(lit) && !s.includes(c)) {
    FAILED.push(`rbac: ${f} missing "${lit}" or "${c}"`);
  }
}
if (Object.values(sources).every(Boolean)) PASSED.push(`rbac: 3 files present`);

const roles = sources['src/runtime/security/roleContracts.ts'] || '';
const SPEC_ROLES = ['farmer','gardener','grower','buyer',
  'field_officer','ngo_admin','organization_admin','admin'];
for (const r of SPEC_ROLES) {
  if (!new RegExp("'" + r + "'").test(roles)) {
    FAILED.push(`rbac: ROLES missing "${r}"`);
  }
}
const SPEC_ACTIONS = ['scan:create','plant:create','plant:read','plant:update',
  'task:complete','artifact:create','sell:mark_ready','buyer:send_interest',
  'organization:read','organization:write','program:read','program:write',
  'intervention:read','intervention:write','report:read','report:export',
  'internal:read','godmode:read'];
for (const a of SPEC_ACTIONS) {
  if (!new RegExp("'" + a.replace(/:/g, ':') + "'").test(roles)) {
    FAILED.push(`rbac: ACTIONS missing "${a}"`);
  }
}
PASSED.push(`rbac: 8 spec roles + 18 spec actions present`);

const runtime = sources['src/runtime/security/RBACRuntime.ts'] || '';
for (const sym of ['hasPermission', 'isRole', 'rbacHealth',
                    'installRBACGlobal', 'failClosed']) {
  if (!runtime.includes(sym)) FAILED.push(`rbac: missing "${sym}"`);
}
PASSED.push(`rbac: runtime exports hasPermission + isRole + rbacHealth + failClosed`);

if (FAILED.length > 0) {
  console.error('[check:rbac-guards] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:rbac-guards] PASS — RBAC runtime + role + action coverage complete.');
