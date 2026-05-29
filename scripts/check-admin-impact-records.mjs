#!/usr/bin/env node
/**
 * scripts/check-admin-impact-records.mjs — Verify the admin
 * impact record system stays honest + scoped.
 *
 * Hard blockers:
 *   A. 7 runtime files exist with version constants
 *      (literal OR named import).
 *   B. AGE_RANGES + GENDERS include "prefer_not_to_say" — the
 *      contract guarantees demographics stay optional.
 *   C. FarmerProfileRuntime.upsert accepts profiles without
 *      ageRange / gender — checked structurally (no
 *      "ageRange_required" reason path).
 *   D. ImpactLedger + ReportRecord declare fakeData: false.
 *   E. Empty-state honesty string ("Not enough data yet")
 *      present in contracts.
 *   F. Pending Prisma migration staged at
 *      server/prisma/_pending-migrations/admin_impact_demographics/
 *      with the spec'd models. NOT inside prisma/migrations/.
 *   G. App.jsx wires installAdminImpactGlobal().
 *   H. No fake-revenue / sample-traction tokens in admin/.
 *   I. Demographic protected fields list present.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
                       .replace(/\/\/[^\n]*/g, '')
                       .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ─── A. Files exist ───────────────────────────────────────────
const FILES = [
  ['src/runtime/admin/adminImpactContracts.ts',         'farroway-admin-impact-v1', 'ADMIN_IMPACT_VERSION'],
  ['src/runtime/admin/FarmerProfileRuntime.ts',         'farmer-profile-runtime-v1', 'FARMER_PROFILE_VERSION'],
  ['src/runtime/admin/OrganizationRecordRuntime.ts',    'organization-record-runtime-v1', 'ORG_RECORD_RUNTIME_VERSION'],
  ['src/runtime/admin/ImpactLedgerRuntime.ts',          'impact-ledger-runtime-v1', 'IMPACT_LEDGER_VERSION'],
  ['src/runtime/admin/ReportRecordRuntime.ts',          'report-record-runtime-v1', 'REPORT_RECORD_VERSION'],
  ['src/runtime/admin/AdminImpactRuntime.ts',           'farroway-admin-impact-v1', 'ADMIN_IMPACT_VERSION'],
  ['src/runtime/admin/index.ts',                        'farroway-admin-impact-v1', 'ADMIN_IMPACT_VERSION'],
];
const sources = {};
for (const [f, lit, c] of FILES) {
  const s = read(path.join(ROOT, f));
  sources[f] = s;
  if (!s) FAILED.push(`admin-impact: missing ${f}`);
  else if (!s.includes(lit) && !s.includes(c)) {
    FAILED.push(`admin-impact: ${f} missing "${lit}" or "${c}"`);
  }
}
if (Object.values(sources).every(Boolean)) {
  PASSED.push(`admin-impact: 7 runtime files wired`);
}

// ─── B. Demographics include prefer_not_to_say ────────────────
const contracts = sources['src/runtime/admin/adminImpactContracts.ts'] || '';
for (const enumName of ['AGE_RANGES', 'GENDERS']) {
  // We just check the enum's vicinity contains 'prefer_not_to_say'.
  const re = new RegExp(enumName + '[\\s\\S]{0,400}prefer_not_to_say');
  if (!re.test(contracts)) {
    FAILED.push(`demographics: ${enumName} must include "prefer_not_to_say"`);
  }
}
PASSED.push(`demographics: AGE_RANGES + GENDERS include prefer_not_to_say`);

// ─── C. FarmerProfile accepts profiles without demographics ──
const farmer = sources['src/runtime/admin/FarmerProfileRuntime.ts'] || '';
// No required-demographics validation paths.
if (/ageRange_required|gender_required|demographics_required/.test(strip(farmer))) {
  FAILED.push(`demographics: FarmerProfileRuntime must NOT require ageRange / gender`);
}
// And the helper must explicitly handle "safeAge = undefined" when invalid.
if (!/safeAge[\s\S]{0,200}undefined/.test(farmer)) {
  FAILED.push(`demographics: FarmerProfileRuntime must keep ageRange undefined when missing`);
}
PASSED.push(`demographics: FarmerProfile accepts profiles without age/gender`);

// ─── D. fakeData: false declared ──────────────────────────────
const ledger = sources['src/runtime/admin/ImpactLedgerRuntime.ts'] || '';
const reports = sources['src/runtime/admin/ReportRecordRuntime.ts'] || '';
for (const [f, src] of [['ImpactLedgerRuntime.ts', ledger],
                          ['ReportRecordRuntime.ts', reports]]) {
  if (!/fakeData\s*:\s*false/.test(strip(src))) {
    FAILED.push(`fakeData: ${f} must declare fakeData: false`);
  }
}
PASSED.push(`fakeData: ImpactLedger + ReportRecord both declare fakeData:false`);

// ─── E. Empty-state honesty string ───────────────────────────
if (!/Not enough data yet/.test(contracts)) {
  FAILED.push(`honesty: ADMIN_EMPTY_STATE must equal "Not enough data yet"`);
} else {
  PASSED.push(`honesty: "Not enough data yet" empty-state present`);
}

// ─── F. Pending migration staged correctly ───────────────────
const PENDING_DIR = 'server/prisma/_pending-migrations/admin_impact_demographics';
const schemaFrag = read(path.join(ROOT, PENDING_DIR, 'schema_fragment.prisma'));
const readme     = read(path.join(ROOT, PENDING_DIR, 'README.md'));
if (!schemaFrag) FAILED.push(`prisma-stage: ${PENDING_DIR}/schema_fragment.prisma missing`);
if (!readme)     FAILED.push(`prisma-stage: ${PENDING_DIR}/README.md missing`);
if (schemaFrag) {
  const MODELS = ['FarmerProfile', 'Organization', 'Program',
    'ProgramEnrollment', 'Intervention', 'InterventionParticipant',
    'ImpactRecord', 'ReportRecord'];
  for (const m of MODELS) {
    if (!new RegExp('model\\s+' + m + '\\s*\\{').test(schemaFrag)) {
      FAILED.push(`prisma-stage: schema_fragment missing model "${m}"`);
    }
  }
}
// Also assert the migration is NOT inside prisma/migrations/.
const MIGRATIONS_DIR = path.join(ROOT, 'server/prisma/migrations');
if (fs.existsSync(MIGRATIONS_DIR)) {
  const danger = fs.readdirSync(MIGRATIONS_DIR).filter((e) =>
    /admin[\s_-]?impact|demographic/i.test(e));
  if (danger.length > 0) {
    FAILED.push(`prisma-stage: admin_impact_demographics must NOT exist in prisma/migrations/ (found ${danger.join(', ')}). Production deploy will crash.`);
  }
}
PASSED.push(`prisma-stage: 8 models staged at _pending-migrations/ (not inside migrations/)`);

// ─── G. App.jsx boot install ─────────────────────────────────
const app = read(path.join(ROOT, 'src/App.jsx'));
if (!/installAdminImpactGlobal/.test(app)) {
  FAILED.push(`boot: App.jsx must call installAdminImpactGlobal()`);
} else {
  PASSED.push(`boot: App.jsx wires installAdminImpactGlobal()`);
}

// ─── H. No fake-metric tokens in admin/ ──────────────────────
const FAKE_PATTERNS = [
  /\bsample[\s_-]?revenue\b/i,
  /\bfake[\s_-]?ngo[\s_-]?metric/i,
  /\bplaceholder[\s_-]?traction\b/i,
  /["'](?:1234|9999)["']/, // hardcoded fake counts
];
for (const [f, src] of Object.entries(sources)) {
  if (!src) continue;
  const s = strip(src);
  for (const re of FAKE_PATTERNS) {
    if (re.test(s)) {
      FAILED.push(`fake-metric: ${f} contains forbidden ${re}`);
    }
  }
}
PASSED.push(`fake-metric: admin/ runtime has no fake-metric / sample-revenue tokens`);

// ─── I. Protected fields list present ────────────────────────
if (!/DEMOGRAPHIC_PROTECTED_FIELDS/.test(contracts)) {
  FAILED.push(`protection: adminImpactContracts must declare DEMOGRAPHIC_PROTECTED_FIELDS`);
} else {
  PASSED.push(`protection: DEMOGRAPHIC_PROTECTED_FIELDS list present`);
}

if (FAILED.length > 0) {
  console.error('[check:admin-impact-records] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:admin-impact-records] PASS — admin impact record system honest + scoped.');
console.log('  7 runtime files · 8 Prisma models staged at _pending-migrations/ · demographics optional · no fake metrics.');
