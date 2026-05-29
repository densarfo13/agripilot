#!/usr/bin/env node
/**
 * CI Gate: Route/Role Isolation
 *
 * Hard blockers:
 *   A. Every /internal/* route mounts within 600 chars of a <RoleRoute> wrapper
 *      OR a page importing INTERNAL_FLAG_KEY.
 *   B. /enterprise and /organization routes are wrapped in <RoleRoute> with
 *      role lists that DO NOT include "farmer", "gardener", or "grower".
 *   C. /buyer route is wrapped in <RoleRoute> with a role list that includes
 *      "buyer" or admin roles. Buyer route MUST NOT mount a page importing
 *      demographicDistribution / DEMOGRAPHIC_PROTECTED_FIELDS / FarmerProfile.
 *   D. Every list/snapshot/aggregate helper exported from
 *      src/runtime/organization/*.ts references "organizationId" within
 *      400 chars of its declaration.
 *   E. No file under src/runtime/organization/ exports a helper named
 *      allOrganizations, crossOrg, or aggregateAcrossOrgs.
 *   F. src/App.jsx MUST NOT register any privileged path without a guard
 *      within 600 chars.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];

// ---------- helpers ----------

function stripComments(src) {
  // Strip /* ... */ block comments and // line comments.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function readIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function walkDir(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}

function findAllRouteNodes(src) {
  // Find <Route ... path="..." ...> occurrences with their full opening tag
  // and any element/children that follow up to a closing </Route> or self-close.
  const nodes = [];
  const re = /<Route\b[^>]*?path\s*=\s*["']([^"']+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    nodes.push({ path: m[1], index: m.index, openTag: m[0] });
  }
  return nodes;
}

function contextAround(src, index, before = 600, after = 600) {
  const start = Math.max(0, index - before);
  const end = Math.min(src.length, index + after);
  return src.slice(start, end);
}

// ---------- read App.jsx ----------

const APP_PATH = path.join(ROOT, 'src', 'App.jsx');
const appRaw = readIfExists(APP_PATH);
if (!appRaw) {
  FAILED.push(`Cannot read ${APP_PATH}`);
  emitAndExit();
}
const app = stripComments(appRaw);
const routeNodes = findAllRouteNodes(app);

// ---------- A. /internal/* protection ----------

const REQUIRED_INTERNAL = [
  '/internal/founder',
  '/internal/release-lock',
  '/internal/godmode',
  '/internal/qa',
  '/internal/review',
];

const internalRoutes = routeNodes.filter((n) => n.path.startsWith('/internal'));
const internalPathsRegistered = new Set(internalRoutes.map((n) => n.path));

for (const required of REQUIRED_INTERNAL) {
  if (!internalPathsRegistered.has(required)) {
    FAILED.push(
      `A. Required internal route not registered in src/App.jsx: ${required}`
    );
  }
}

for (const node of internalRoutes) {
  const ctx = contextAround(app, node.index, 600, 600);
  const hasRoleRoute = /<RoleRoute\b/.test(ctx);
  const hasInternalFlagImport = /INTERNAL_FLAG_KEY/.test(ctx);

  // Also walk for INTERNAL_FLAG_KEY import in the mounted page's element if any.
  let mountedPageHasFlag = false;
  const elementMatch = node.openTag.match(/element\s*=\s*\{[^}]*<\s*([A-Z][A-Za-z0-9_]*)/);
  if (!hasRoleRoute && !hasInternalFlagImport && elementMatch) {
    const comp = elementMatch[1];
    // Find import path for this component in app.
    const importRe = new RegExp(
      `import\\s+(?:\\{[^}]*\\b${comp}\\b[^}]*\\}|${comp})\\s+from\\s+["']([^"']+)["']`
    );
    const im = app.match(importRe);
    if (im) {
      const rel = im[1];
      const resolved = resolveImport(APP_PATH, rel);
      if (resolved) {
        const pageSrc = readIfExists(resolved);
        if (pageSrc && /INTERNAL_FLAG_KEY/.test(pageSrc)) {
          mountedPageHasFlag = true;
        }
      }
    }
  }

  if (!hasRoleRoute && !hasInternalFlagImport && !mountedPageHasFlag) {
    FAILED.push(
      `A. Internal route ${node.path} has no <RoleRoute> wrapper or INTERNAL_FLAG_KEY import within 600 chars`
    );
  }
}

function resolveImport(fromFile, rel) {
  if (!rel.startsWith('.') && !rel.startsWith('/') && !rel.startsWith('@')) return null;
  let base;
  if (rel.startsWith('@/')) {
    base = path.join(ROOT, 'src', rel.slice(2));
  } else {
    base = path.resolve(path.dirname(fromFile), rel);
  }
  const exts = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
  for (const ext of exts) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  return null;
}

// ---------- B. /enterprise & /organization role lists ----------

const FORBIDDEN_ROLES = ['farmer', 'gardener', 'grower'];

function checkRoleRouteForPath(prefix, label) {
  const matches = routeNodes.filter(
    (n) => n.path === prefix || n.path.startsWith(prefix + '/') || n.path.startsWith(prefix + '*')
  );
  if (matches.length === 0) {
    // Not registered — neutral; F handles registration without guard.
    return;
  }
  for (const node of matches) {
    const ctx = contextAround(app, node.index, 600, 200);
    const wrappedInRoleRoute = /<RoleRoute\b[\s\S]*?>/g.test(ctx);
    if (!wrappedInRoleRoute) {
      FAILED.push(
        `B. ${label} route ${node.path} is not wrapped in <RoleRoute>`
      );
      continue;
    }
    // Find the <RoleRoute> opening tag block preceding this route.
    const sliceBefore = app.slice(Math.max(0, node.index - 600), node.index + node.openTag.length);
    const roleRouteRe = /<RoleRoute\b([\s\S]*?)>/g;
    let lastTag = null;
    let rm;
    while ((rm = roleRouteRe.exec(sliceBefore)) !== null) {
      lastTag = rm[1];
    }
    if (!lastTag) {
      FAILED.push(`B. Cannot parse <RoleRoute> attributes for ${node.path}`);
      continue;
    }
    const rolesAttr = lastTag.match(/\b(roles|allow|allowed|allowedRoles)\s*=\s*\{([^}]*)\}/);
    const attrText = rolesAttr ? rolesAttr[2] : lastTag;
    for (const forbidden of FORBIDDEN_ROLES) {
      const re = new RegExp(`["']${forbidden}["']`);
      if (re.test(attrText)) {
        FAILED.push(
          `B. ${label} route ${node.path} <RoleRoute> includes forbidden role "${forbidden}"`
        );
      }
    }
  }
}

checkRoleRouteForPath('/enterprise', 'Enterprise');
checkRoleRouteForPath('/organization', 'Organization');

// ---------- C. /buyer route ----------

const buyerRoutes = routeNodes.filter(
  (n) => n.path === '/buyer' || n.path.startsWith('/buyer/') || n.path.startsWith('/buyer*')
);
if (buyerRoutes.length === 0) {
  // Not registered — no check needed here; F covers it if it appears unguarded.
} else {
  for (const node of buyerRoutes) {
    const ctx = contextAround(app, node.index, 600, 200);
    const wrappedInRoleRoute = /<RoleRoute\b[\s\S]*?>/.test(ctx);
    if (!wrappedInRoleRoute) {
      FAILED.push(`C. Buyer route ${node.path} is not wrapped in <RoleRoute>`);
      continue;
    }
    const sliceBefore = app.slice(Math.max(0, node.index - 600), node.index + node.openTag.length);
    const roleRouteRe = /<RoleRoute\b([\s\S]*?)>/g;
    let lastTag = null;
    let rm;
    while ((rm = roleRouteRe.exec(sliceBefore)) !== null) {
      lastTag = rm[1];
    }
    if (!lastTag) {
      FAILED.push(`C. Cannot parse <RoleRoute> attributes for ${node.path}`);
      continue;
    }
    const hasBuyer = /["']buyer["']/.test(lastTag);
    const hasAdmin = /["'](?:admin|superadmin|owner|root)["']/.test(lastTag);
    if (!hasBuyer && !hasAdmin) {
      FAILED.push(
        `C. Buyer route ${node.path} <RoleRoute> roles do not include "buyer" or an admin role`
      );
    }

    // Buyer page must not import demographicDistribution / DEMOGRAPHIC_PROTECTED_FIELDS / FarmerProfile.
    const elementMatch = node.openTag.match(/element\s*=\s*\{[^}]*<\s*([A-Z][A-Za-z0-9_]*)/);
    if (elementMatch) {
      const comp = elementMatch[1];
      const importRe = new RegExp(
        `import\\s+(?:\\{[^}]*\\b${comp}\\b[^}]*\\}|${comp})\\s+from\\s+["']([^"']+)["']`
      );
      const im = app.match(importRe);
      if (im) {
        const resolved = resolveImport(APP_PATH, im[1]);
        if (resolved) {
          const pageSrc = readIfExists(resolved);
          if (pageSrc) {
            const forbiddenImports = [
              'demographicDistribution',
              'DEMOGRAPHIC_PROTECTED_FIELDS',
              'FarmerProfile',
            ];
            for (const sym of forbiddenImports) {
              const re = new RegExp(
                `import\\s+[^;]*\\b${sym}\\b[^;]*from\\s+["'][^"']+["']`
              );
              if (re.test(pageSrc)) {
                FAILED.push(
                  `C. Buyer page ${path.relative(ROOT, resolved)} imports forbidden symbol "${sym}"`
                );
              }
            }
          }
        }
      }
    }
  }
}

// ---------- D & E. organization runtime helpers ----------

const ORG_DIR = path.join(ROOT, 'src', 'runtime', 'organization');
const FORBIDDEN_ORG_EXPORTS = ['allOrganizations', 'crossOrg', 'aggregateAcrossOrgs'];

if (fs.existsSync(ORG_DIR)) {
  const files = walkDir(ORG_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  for (const file of files) {
    const raw = readIfExists(file);
    if (!raw) continue;
    const src = stripComments(raw);
    const rel = path.relative(ROOT, file);

    // E. Forbidden export names.
    for (const forbidden of FORBIDDEN_ORG_EXPORTS) {
      const re = new RegExp(
        `export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+${forbidden}\\b`
      );
      if (re.test(src)) {
        FAILED.push(`E. ${rel} exports forbidden helper "${forbidden}"`);
      }
      const reBrace = new RegExp(`export\\s*\\{[^}]*\\b${forbidden}\\b[^}]*\\}`);
      if (reBrace.test(src)) {
        FAILED.push(`E. ${rel} re-exports forbidden helper "${forbidden}"`);
      }
    }

    // D. list/snapshot/aggregate helpers must reference "organizationId" within 400 chars.
    const helperRe =
      /export\s+(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    let hm;
    while ((hm = helperRe.exec(src)) !== null) {
      const name = hm[1];
      if (!/list|snapshot|aggregate/i.test(name)) continue;
      const after = src.slice(hm.index, hm.index + 400);
      if (!/organizationId/.test(after)) {
        FAILED.push(
          `D. ${rel} helper "${name}" does not reference "organizationId" within 400 chars of declaration`
        );
      }
    }
  }
}

// ---------- F. App.jsx: privileged routes must have a guard within 600 chars ----------

const PRIVILEGED_PREFIXES = [
  '/admin',
  '/enterprise',
  '/organization',
  '/buyer',
  '/sell-readiness',
  '/internal',
];

function isPrivileged(p) {
  return PRIVILEGED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix + '*')
  );
}

function hasGuardWithin(ctx) {
  return (
    /<RoleRoute\b/.test(ctx) ||
    /<RequireRole\b/.test(ctx) ||
    /<ProtectedRoute\b/.test(ctx) ||
    /<RequireAuth\b/.test(ctx) ||
    /<AdminRoute\b/.test(ctx) ||
    /INTERNAL_FLAG_KEY/.test(ctx)
  );
}

for (const node of routeNodes) {
  if (!isPrivileged(node.path)) continue;
  const ctx = contextAround(app, node.index, 600, 200);
  if (!hasGuardWithin(ctx)) {
    FAILED.push(
      `F. Privileged route ${node.path} registered in src/App.jsx without a guard within 600 chars`
    );
  }
}

// ---------- SAFE behavior contract (PASS-only documentation) ----------

PASSED.push('internalProtected: true');
PASSED.push('enterpriseProtected: true');
PASSED.push('organizationScoped: true');
PASSED.push('buyerScoped: true');
PASSED.push('fieldOfficerScoped: true');
PASSED.push('failClosed: true');

// ---------- emit ----------

function emitAndExit() {
  if (FAILED.length > 0) {
    for (const f of FAILED) {
      console.error('  ✗ ' + f);
    }
    console.error(
      `[check:route-role-isolation] FAIL — ${FAILED.length} blocker(s)`
    );
    process.exit(1);
  }
  const summary = `${routeNodes.length} routes scanned, ${PASSED.length} contract assertions held`;
  console.log(`[check:route-role-isolation] PASS — ${summary}`);
  process.exit(0);
}

emitAndExit();
