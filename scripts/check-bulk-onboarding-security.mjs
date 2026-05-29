#!/usr/bin/env node
/**
 * scripts/check-bulk-onboarding-security.mjs
 *
 * Wave 17 — Bulk farmer onboarding hard-gate.
 *
 * Validates that the bulk onboarding sprint is wired safely:
 *
 *   A. Runtime files exist: 7 spec .ts files + barrel in
 *      src/runtime/organization/onboarding/.
 *   B. Each runtime file declares the spec version constants.
 *   C. No file under that runtime imports React, fetches, or writes
 *      to localStorage directly (it is a pure composition layer).
 *   D. No console.log/info/warn/error of "phone" / "email" /
 *      "fullName" / raw "rawData" outside the runtime registry
 *      itself (PII must never appear in client logs).
 *   E. BULK_ONBOARDING_VERSION + canonical contract list match the
 *      spec (17 CSV columns total).
 *   F. Server route module exists; write endpoints return 503 with
 *      a PENDING_REASON until the supervised Prisma migration
 *      deploys; GET endpoints accept organizationId scope.
 *   G. CSV template generator exists; header row contains all 17
 *      spec columns; example rows contain no real-looking
 *      phone/email values.
 *   H. Pending Prisma fragment defines EnrollmentBatch +
 *      EnrollmentBatchRow and does NOT redefine FarmerProfile /
 *      ProgramEnrollment / Organization / Program / Cohort /
 *      Intervention (those live in admin_impact_demographics).
 *   I. App.jsx wires installBulkOnboardingGlobal() AND mounts all
 *      5 new /organization/onboarding/* routes under <RoleRoute>
 *      with the spec roles (ngo_admin, organization_admin,
 *      field_officer, admin) — NEVER farmer/gardener/grower/buyer.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
};
const exists = (f) => {
  try { return fs.existsSync(f); } catch { return false; }
};
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// ─── A. Runtime files exist ────────────────────────────────────
const RUNTIME_DIR = path.join(ROOT, 'src/runtime/organization/onboarding');
const SPEC_FILES = [
  'onboardingContracts.ts',
  'CsvParser.ts',
  'CsvValidator.ts',
  'DuplicateDetector.ts',
  'FarmerProvisioner.ts',
  'BatchRuntime.ts',
  'BulkOnboardingAudit.ts',
];
const BARREL = 'index.ts';

const runtimeSources = {};
let runtimeMissing = 0;
for (const f of SPEC_FILES) {
  const p = path.join(RUNTIME_DIR, f);
  const s = read(p);
  runtimeSources[f] = s;
  if (!s) {
    fail(`bulk-onboarding: missing runtime file src/runtime/organization/onboarding/${f}`);
    runtimeMissing++;
  }
}
const barrelPath = path.join(RUNTIME_DIR, BARREL);
const barrelSrc = read(barrelPath);
runtimeSources[BARREL] = barrelSrc;
if (!barrelSrc) {
  fail('bulk-onboarding: missing barrel src/runtime/organization/onboarding/index.ts');
  runtimeMissing++;
}
if (runtimeMissing === 0) {
  pass('bulk-onboarding: 7 spec files + barrel present in src/runtime/organization/onboarding/');
}

// ─── B. Spec version constants ─────────────────────────────────
const VERSION_RE = /BULK_ONBOARDING_VERSION\s*=\s*['"`]farroway-bulk-onboarding-v1['"`]/;
const contractsSrc = runtimeSources['onboardingContracts.ts'] || '';
if (contractsSrc && !VERSION_RE.test(contractsSrc)) {
  fail('bulk-onboarding: onboardingContracts.ts does not declare BULK_ONBOARDING_VERSION = "farroway-bulk-onboarding-v1"');
} else if (contractsSrc) {
  pass('bulk-onboarding: BULK_ONBOARDING_VERSION present');
}

// Each non-contract runtime file should reference the version
// constant or export a *_RUNTIME_VERSION matching the sprint.
const VERSION_REF_RE = /BULK_ONBOARDING_VERSION|_RUNTIME_VERSION\s*=\s*['"`]farroway-bulk-onboarding/;
let versionMissing = 0;
for (const f of SPEC_FILES.concat([BARREL])) {
  const s = runtimeSources[f];
  if (!s) continue;
  if (f === 'onboardingContracts.ts') continue;
  if (!VERSION_REF_RE.test(s)) {
    fail(`bulk-onboarding: ${f} does not reference BULK_ONBOARDING_VERSION or *_RUNTIME_VERSION`);
    versionMissing++;
  }
}
if (versionMissing === 0 && Object.values(runtimeSources).every(Boolean)) {
  pass('bulk-onboarding: every runtime file declares a spec version constant');
}

// ─── C. Runtime purity ─────────────────────────────────────────
// No React, no fetch, no localStorage writes in any file under
// src/runtime/organization/onboarding/.
const REACT_RE = /\bfrom\s+['"`]react['"`]/;
const FETCH_RE = /\bfetch\s*\(/;
const LS_WRITE_RE = /localStorage\s*\.\s*(setItem|removeItem|clear)\s*\(/;
let purityFails = 0;
for (const f of SPEC_FILES.concat([BARREL])) {
  const s = runtimeSources[f];
  if (!s) continue;
  const clean = stripComments(s);
  if (REACT_RE.test(clean)) {
    fail(`bulk-onboarding: ${f} imports React (runtime must stay pure)`);
    purityFails++;
  }
  if (FETCH_RE.test(clean)) {
    fail(`bulk-onboarding: ${f} calls fetch() (runtime must stay transport-free)`);
    purityFails++;
  }
  if (LS_WRITE_RE.test(clean)) {
    fail(`bulk-onboarding: ${f} writes to localStorage (runtime must stay storage-free)`);
    purityFails++;
  }
}
if (purityFails === 0 && Object.values(runtimeSources).every(Boolean)) {
  pass('bulk-onboarding: no runtime file imports React / fetches / writes to localStorage');
}

// ─── D. No PII in console outside the runtime registry ─────────
// Scan src/ excluding the runtime registry itself for console
// calls that mention "phone", "email", "fullName", or "rawData".
const REGISTRY_PREFIX = path.join('src', 'runtime', 'organization', 'onboarding') + path.sep;
const PII_TOKENS = ['phone', 'email', 'fullName', 'rawData'];
const CONSOLE_RE = /console\s*\.\s*(log|info|warn|error|debug)\s*\(([^)]*)\)/g;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(full, out);
    } else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const srcFiles = walk(path.join(ROOT, 'src'));
let piiHits = 0;
for (const f of srcFiles) {
  const rel = path.relative(ROOT, f);
  if (rel.startsWith(REGISTRY_PREFIX)) continue;
  const s = read(f);
  if (!s) continue;
  const clean = stripComments(s);
  let m;
  CONSOLE_RE.lastIndex = 0;
  while ((m = CONSOLE_RE.exec(clean)) !== null) {
    const args = m[2] || '';
    for (const tok of PII_TOKENS) {
      const re = new RegExp(`(?:^|[^a-zA-Z_])${tok}(?:[^a-zA-Z_]|$)`, 'i');
      if (re.test(args)) {
        fail(`bulk-onboarding: ${rel} logs PII token "${tok}" via console (line ~${(clean.slice(0, m.index).match(/\n/g) || []).length + 1})`);
        piiHits++;
        break;
      }
    }
    if (piiHits > 25) break;
  }
  if (piiHits > 25) break;
}
if (piiHits === 0) {
  pass('bulk-onboarding: no console.* call leaks phone / email / fullName / rawData outside the runtime registry');
}

// ─── E. Canonical contract list matches spec ───────────────────
if (contractsSrc) {
  const clean = stripComments(contractsSrc);
  const required = (clean.match(/REQUIRED_CSV_COLUMNS\s*=\s*Object\.freeze\(\{[\s\S]*?\}\)/) || [''])[0];
  const optional = (clean.match(/OPTIONAL_CSV_COLUMNS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]/) || ['', ''])[1];
  const reqList = (required.match(/['"][a-z_]+['"]/g) || []).map((s) => s.slice(1, -1));
  const optList = (optional.match(/['"][a-z_]+['"]/g) || []).map((s) => s.slice(1, -1));
  const total = new Set([...reqList, ...optList]);
  if (total.size !== 17) {
    fail(`bulk-onboarding: canonical CSV column list has ${total.size} entries, spec requires 17`);
  } else {
    pass('bulk-onboarding: canonical CSV column list matches spec (17 columns)');
  }
}

// ─── F. Server route module ────────────────────────────────────
const ROUTES_PATH = path.join(
  ROOT,
  'server/src/modules/organization/onboarding/routes.js'
);
const routesSrc = read(ROUTES_PATH);
if (!routesSrc) {
  fail('bulk-onboarding: missing server/src/modules/organization/onboarding/routes.js');
} else {
  const clean = stripComments(routesSrc);
  const has503 = /\b503\b/.test(clean);
  const hasPending = /PENDING_REASON/.test(clean);
  const hasUpload   = /\bupload\b/i.test(clean);
  const hasValidate = /\bvalidate\b/i.test(clean);
  const hasImport   = /\bimport\b/i.test(clean);
  const hasAssign   = /\bassign\b/i.test(clean);
  const hasOrgScope = /organizationId/.test(clean);

  if (!has503)      fail('bulk-onboarding: routes.js does not return 503 for pending write endpoints');
  if (!hasPending)  fail('bulk-onboarding: routes.js does not reference PENDING_REASON');
  if (!hasUpload)   fail('bulk-onboarding: routes.js missing upload endpoint');
  if (!hasValidate) fail('bulk-onboarding: routes.js missing validate endpoint');
  if (!hasImport)   fail('bulk-onboarding: routes.js missing import endpoint');
  if (!hasAssign)   fail('bulk-onboarding: routes.js missing assign endpoint');
  if (!hasOrgScope) fail('bulk-onboarding: routes.js does not scope GET endpoints by organizationId');
  if (has503 && hasPending && hasUpload && hasValidate && hasImport && hasAssign && hasOrgScope) {
    pass('bulk-onboarding: server route module exposes upload/validate/import/assign returning 503+PENDING_REASON and scopes by organizationId');
  }
}

// ─── G. CSV template generator ─────────────────────────────────
const TEMPLATE_PATH = path.join(
  ROOT,
  'server/src/modules/organization/onboarding/csvTemplate.js'
);
const templateSrc = read(TEMPLATE_PATH);
if (!templateSrc) {
  fail('bulk-onboarding: missing server/src/modules/organization/onboarding/csvTemplate.js');
} else {
  const clean = stripComments(templateSrc);
  const SPEC_COLS = [
    'first_name', 'last_name', 'phone', 'email',
    'age_range', 'gender', 'country', 'region',
    'district', 'village', 'farm_size', 'primary_crop',
    'secondary_crop', 'program', 'cohort',
    'field_officer_email', 'consent_for_program_reporting',
  ];
  let colsMissing = 0;
  for (const c of SPEC_COLS) {
    if (!new RegExp(`['"\\b]${c}['"\\b,]`).test(clean)) {
      fail(`bulk-onboarding: csvTemplate.js missing column "${c}"`);
      colsMissing++;
    }
  }
  // Example rows must not contain real-looking phone/email
  // (E.164 numbers or actual @gmail/@yahoo addresses).
  const REAL_PHONE_RE = /\+?\d{10,15}/;
  const REAL_EMAIL_RE = /[a-z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail|icloud)\.[a-z]+/i;
  if (REAL_PHONE_RE.test(clean)) {
    fail('bulk-onboarding: csvTemplate.js example rows contain a real-looking phone number');
  }
  if (REAL_EMAIL_RE.test(clean)) {
    fail('bulk-onboarding: csvTemplate.js example rows contain a real-looking email address');
  }
  if (colsMissing === 0 && !REAL_PHONE_RE.test(clean) && !REAL_EMAIL_RE.test(clean)) {
    pass('bulk-onboarding: csvTemplate.js header row contains all 17 spec columns and uses safe placeholder examples');
  }
}

// ─── H. Pending Prisma fragment ────────────────────────────────
const FRAG_PATH = path.join(
  ROOT,
  'server/prisma/_pending-migrations/bulk_onboarding_batches/schema_fragment.prisma'
);
const fragSrc = read(FRAG_PATH);
if (!fragSrc) {
  fail('bulk-onboarding: missing server/prisma/_pending-migrations/bulk_onboarding_batches/schema_fragment.prisma');
} else {
  const hasBatch = /\bmodel\s+EnrollmentBatch\b/.test(fragSrc);
  const hasRow   = /\bmodel\s+EnrollmentBatchRow\b/.test(fragSrc);
  if (!hasBatch) fail('bulk-onboarding: pending fragment missing EnrollmentBatch model');
  if (!hasRow)   fail('bulk-onboarding: pending fragment missing EnrollmentBatchRow model');
  const FORBIDDEN = ['FarmerProfile', 'ProgramEnrollment', 'Organization', 'Program', 'Cohort', 'Intervention'];
  let redef = 0;
  for (const m of FORBIDDEN) {
    if (new RegExp(`\\bmodel\\s+${m}\\b`).test(fragSrc)) {
      fail(`bulk-onboarding: pending fragment redefines ${m} (lives in admin_impact_demographics)`);
      redef++;
    }
  }
  if (hasBatch && hasRow && redef === 0) {
    pass('bulk-onboarding: Prisma fragment defines EnrollmentBatch + EnrollmentBatchRow without redefining shared models');
  }
}

// ─── I. App.jsx wiring ─────────────────────────────────────────
const APP_PATH = path.join(ROOT, 'src/App.jsx');
const appSrc = read(APP_PATH);
if (!appSrc) {
  fail('bulk-onboarding: src/App.jsx not found');
} else {
  const clean = stripComments(appSrc);
  const wired = /installBulkOnboardingGlobal\s*\(/.test(clean);
  if (!wired) {
    fail('bulk-onboarding: src/App.jsx does not invoke installBulkOnboardingGlobal()');
  }
  const ROUTES = [
    'organization/onboarding',
    'organization/onboarding/import',
    'organization/onboarding/batches',
    'organization/onboarding/batches/:batchId',
    'organization/onboarding/add-farmer',
  ];
  let routesMissing = 0;
  for (const r of ROUTES) {
    const re = new RegExp(`path=["'\`]${r.replace(/:/g, ':').replace(/\//g, '\\/')}["'\`]`);
    if (!re.test(clean)) {
      fail(`bulk-onboarding: src/App.jsx missing route "${r}"`);
      routesMissing++;
    }
  }
  // Forbidden roles for these routes.
  const FORBIDDEN_ROLES = ['farmer', 'gardener', 'grower', 'buyer'];
  // Find each /organization/onboarding route declaration block
  // and check the roles array.
  const routeBlockRe = /<Route\s+path=["'`]organization\/onboarding[^"'`]*["'`][\s\S]*?\/>/g;
  let badRole = 0;
  let m;
  while ((m = routeBlockRe.exec(clean)) !== null) {
    const block = m[0];
    for (const r of FORBIDDEN_ROLES) {
      if (new RegExp(`['"\`]${r}['"\`]`).test(block)) {
        fail(`bulk-onboarding: an /organization/onboarding route grants forbidden role "${r}"`);
        badRole++;
      }
    }
    // Each route must wrap a <RoleRoute>.
    if (!/<RoleRoute\b/.test(block)) {
      fail('bulk-onboarding: an /organization/onboarding route is not wrapped in <RoleRoute>');
      badRole++;
    }
  }
  if (wired && routesMissing === 0 && badRole === 0) {
    pass('bulk-onboarding: src/App.jsx wires installBulkOnboardingGlobal() and mounts all 5 onboarding routes under spec-compliant <RoleRoute>');
  }
}

// ─── Summary ───────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:bulk-onboarding-security] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(
  `[check:bulk-onboarding-security] PASS — ${PASSED.length} checks: ` +
  'runtime files + version constants + purity + no-PII logs + canonical CSV columns + ' +
  'server routes 503 gated + CSV template safe + Prisma fragment isolated + App.jsx wired with spec roles.'
);
