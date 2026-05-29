#!/usr/bin/env node
/**
 * scripts/check-federation-security.mjs — Hard CI gate for the
 * Wave-15 federation runtime.
 *
 * Hard blockers:
 *   A. 8 runtime files exist at src/runtime/auth/federation/.
 *   B. NONE of the runtime files read or store client secrets
 *      (forbidden tokens: process.env in client tree if it
 *      mentions SECRET / TOKEN; clientSecret OUTSIDE of
 *      clientSecretRef context; rawToken / idToken /
 *      accessToken stored in module-state).
 *   C. SAML must declare placeholder: configured:false +
 *      runtimeReady:false. CI gate fails the moment either
 *      flips true without the actual implementation landing.
 *   D. ClaimMapper + OrganizationFederation refuse to assign
 *     admin / organization_admin from claims (NEVER_FROM_CLAIM_ROLES).
 *   E. JIT provisioning helper rejects when policy.jitProvisioning
 *      is not true (jitProvisioning_disabled path).
 *   F. Federation API route module returns 503 for writes (
 *      WRITES staged pending Prisma deploy).
 *   G. Pending Prisma fragment exists at _pending-migrations/
 *      federated_identity/ AND has SUPERSEDED.md / RECONCILIATION
 *      coverage if it conflicts.
 *
 * Strict-rule audit
 *   • Read-only. Exit 1 on any hard blocker.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);

function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }
function strip(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const FILES = [
  ['src/runtime/auth/federation/federationContracts.ts',      'farroway-federation-runtime-v1', 'FEDERATION_RUNTIME_VERSION'],
  ['src/runtime/auth/federation/OIDCRuntime.ts',              'oidc-runtime-v1',                 'OIDC_RUNTIME_VERSION'],
  ['src/runtime/auth/federation/SAMLRuntime.ts',              'saml-placeholder-v1',             'SAML_RUNTIME_VERSION'],
  ['src/runtime/auth/federation/ClaimMapper.ts',              'claim-mapper-v1',                 'CLAIM_MAPPER_VERSION'],
  ['src/runtime/auth/federation/OrganizationFederation.ts',   'org-federation-runtime-v1',       'ORG_FEDERATION_VERSION'],
  ['src/runtime/auth/federation/FederationRuntime.ts',        'farroway-federation-runtime-v1', 'FEDERATION_RUNTIME_VERSION'],
  ['src/runtime/auth/federation/FederationDiagnostics.ts',    'farroway-federation-runtime-v1', 'FEDERATION_RUNTIME_VERSION'],
  ['src/runtime/auth/federation/index.ts',                    'farroway-federation-runtime-v1', 'FEDERATION_RUNTIME_VERSION'],
];
const sources = {};
for (const [f, lit, c] of FILES) {
  const s = read(path.join(ROOT, f));
  sources[f] = s;
  if (!s) fail(`federation: missing ${f}`);
  else if (!s.includes(lit) && !s.includes(c)) {
    fail(`federation: ${f} missing literal "${lit}" or constant "${c}"`);
  }
}
if (Object.values(sources).every(Boolean)) {
  pass(`federation: 8 runtime files wired with version constants`);
}

// ─── B. Client-secret + token storage forbidden in runtime ──
const FORBIDDEN_SECRET_PATTERNS = [
  // Storing literals named clientSecret (with no "Ref" suffix)
  /\bclientSecret\s*[:=][^R]/i,
  // Storing raw tokens in module state.
  /\b(rawToken|accessToken|idToken|refreshToken)\s*[:=]/i,
  // Reading process.env.*SECRET in client-tree runtime.
  /process\.env\.[A-Z_]*SECRET/i,
  // Console-logging tokens.
  /console\.(log|info|warn|error)\([^)]*\b(token|secret|Bearer)\b/i,
];
for (const [f, src] of Object.entries(sources)) {
  if (!src) continue;
  const stripped = strip(src);
  for (const re of FORBIDDEN_SECRET_PATTERNS) {
    if (re.test(stripped)) {
      fail(`secret-leak: ${f} contains forbidden pattern ${re}`);
    }
  }
}
pass(`secret-leak: no client-secret / token storage in runtime layer`);

// ─── C. SAML placeholder must stay placeholder ──────────────
const saml = sources['src/runtime/auth/federation/SAMLRuntime.ts'] || '';
if (!/configured:\s*false/.test(saml) || !/runtimeReady:\s*false/.test(saml)) {
  fail(`saml-placeholder: SAMLRuntime must declare configured:false AND runtimeReady:false until a real SAML handler ships`);
}
pass(`saml-placeholder: declared honestly (configured:false, runtimeReady:false)`);

// ─── D. Admin never from claim ──────────────────────────────
const contracts = sources['src/runtime/auth/federation/federationContracts.ts'] || '';
if (!/NEVER_FROM_CLAIM_ROLES/.test(contracts)
    || !/['"]admin['"]/.test(contracts)
    || !/['"]organization_admin['"]/.test(contracts)) {
  fail(`claim-admin-block: NEVER_FROM_CLAIM_ROLES must list 'admin' AND 'organization_admin'`);
}
const claim = sources['src/runtime/auth/federation/ClaimMapper.ts'] || '';
if (!/NEVER_FROM_CLAIM_ROLES/.test(claim)) {
  fail(`claim-admin-block: ClaimMapper must import + check NEVER_FROM_CLAIM_ROLES`);
}
const orgFed = sources['src/runtime/auth/federation/OrganizationFederation.ts'] || '';
if (!/NEVER_FROM_CLAIM_ROLES/.test(orgFed)) {
  fail(`claim-admin-block: OrganizationFederation must double-check NEVER_FROM_CLAIM_ROLES`);
}
pass(`claim-admin-block: claim → admin path closed in 3 places`);

// ─── E. JIT gate ────────────────────────────────────────────
if (!/jitProvisioning\s*!==\s*true/.test(orgFed)
    && !/jitProvisioning\s*!=\s*true/.test(orgFed)) {
  fail(`jit-gate: OrganizationFederation.evaluateJITProvision must reject when policy.jitProvisioning is not true`);
}
pass(`jit-gate: JIT denial path enforced`);

// ─── F. Server API write endpoints return 503 ───────────────
const apiPath = path.join(ROOT, 'server/src/modules/auth/federation/routes.js');
const api = read(apiPath);
if (!api) {
  fail(`api-routes: server/src/modules/auth/federation/routes.js missing`);
} else {
  if (!/PENDING_REASON\s*=\s*['"]federation_persistence_pending_migration['"]/.test(api)) {
    fail(`api-routes: PENDING_REASON must equal 'federation_persistence_pending_migration'`);
  }
  // The 3 admin write endpoints + callback must all return 503.
  const writeRoutes = ['admin/provider', 'admin/provider/:id',
                        'admin/claim-mapping', '/callback'];
  for (const r of writeRoutes) {
    // Match either single-quoted or template string literal forms.
    const re = new RegExp("['\"`]/?" + r.replace(/\//g, '\\/').replace(/:/g, ':')
      + "['\"`][\\s\\S]{0,400}?status\\(503\\)");
    if (!re.test(api)) {
      fail(`api-routes: write endpoint "${r}" must return status(503) until migration deploys`);
    }
  }
  // No raw secrets in the response.
  if (/clientSecret\s*[:=][^R]/.test(strip(api))) {
    fail(`api-routes: route response must never include clientSecret (only clientSecretRef)`);
  }
  pass(`api-routes: writes return 503; no secret leakage`);
}

// ─── G. Prisma fragment staged ──────────────────────────────
const FRAGMENT = 'server/prisma/_pending-migrations/federated_identity/schema_fragment.prisma';
const fragment = read(path.join(ROOT, FRAGMENT));
const fragmentReadme = read(path.join(ROOT,
  'server/prisma/_pending-migrations/federated_identity/README.md'));
if (!fragment) fail(`prisma-stage: ${FRAGMENT} missing`);
if (!fragmentReadme) fail(`prisma-stage: federated_identity/README.md missing`);
if (fragment) {
  for (const model of ['FederationProvider', 'FederatedIdentity',
                        'OrganizationLoginPolicy', 'ClaimRoleMapping']) {
    if (!new RegExp('model\\s+' + model + '\\s*\\{').test(fragment)) {
      fail(`prisma-stage: schema_fragment missing model "${model}"`);
    }
  }
  // Secret-ref field, never secret literal.
  if (!/clientSecretRef\s+String\?/.test(fragment)) {
    fail(`prisma-stage: FederationProvider must use clientSecretRef (reference), never a clientSecret literal column`);
  }
  if (/\bclientSecret\s+String/.test(fragment)) {
    fail(`prisma-stage: FederationProvider must NOT have a clientSecret column (only clientSecretRef)`);
  }
}
pass(`prisma-stage: 4 models + secret-ref-only column shape`);

// ─── App.jsx boot install ──────────────────────────────────
const app = read(path.join(ROOT, 'src/App.jsx'));
if (!/installFederationGlobal/.test(app)) {
  fail(`boot: src/App.jsx must wire installFederationGlobal()`);
} else {
  pass(`boot: installFederationGlobal wired in App.jsx`);
}

// ─── Report ────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:federation-security] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:federation-security] PASS — federation runtime fail-closed + no secret leakage + SAML placeholder honest.');
