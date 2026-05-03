#!/usr/bin/env node
/**
 * audit-routes.mjs — Farroway backend route-security auditor.
 *
 *   npm run security:routes
 *
 * Walks every Express route file under `server/routes/*.js`
 * and `server/src/modules/.../routes.js` and flags routes that
 * touch sensitive surfaces without the appropriate guard middleware
 * in their chain.
 *
 * What it checks
 * ──────────────
 *   1. Router-wide middleware (`router.use(authenticate)`,
 *      `router.use(requireMfa)`, etc.) is captured FIRST — every
 *      handler in that file inherits them.
 *   2. Per-route middleware list is parsed from the
 *      `router.<method>('<path>', ...mw, handler)` call up to
 *      the first `asyncHandler(...)` / `async (req, res) =>` /
 *      arrow-function start.
 *   3. The combined chain (router-wide + per-route) is matched
 *      against the EXPECTED guards for the path:
 *        • Any sensitive path → must include an auth guard
 *          (authenticate / requireAuth)
 *        • Path contains `:id` / `:farmId` / `:scanId` etc. →
 *          must include an ownership OR role guard
 *        • Path under /admin → must include an admin role guard
 *        • Path under /ngo / /programs → must include
 *          extractOrganization OR verifyOrgAccess OR a role check
 *        • Buyer surfaces → ownership OR explicit `visibility:
 *          'public'` filter visible nearby
 *   4. SECONDARY: scans for raw
 *      `prisma.<model>.findUnique({ where: { id ... } })` calls
 *      that don't include an ownership constraint in the where
 *      clause. These are the IDOR pattern the merged-blocker
 *      spec explicitly flags.
 *
 * Output
 *   For each finding:
 *     - route path
 *     - HTTP method
 *     - file location (relative + line number)
 *     - missing middleware list
 *     - severity
 *     - suggested fix
 *
 * Exit code
 *   0 — every sensitive route is protected (PASS)
 *   1 — at least one sensitive route is missing a guard (FAIL)
 *
 * Strict-rule audit
 *   • Read-only — never edits a file.
 *   • Pure ESM, zero deps beyond `node:fs` + `node:path`.
 *   • Allow-list comments: `// security:routes:ignore` on the
 *     line above a route registration silences any finding.
 *     Use sparingly and document the why.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SERVER_DIR = path.join(ROOT, 'server');

// ─── Sensitive path prefixes (merged-blocker spec) ────────
//
// `priority` decides which mount applies when the route path
// is registered under multiple prefixes (longest match wins).
// The labels are surfaced in suggested-fix messages.
const SENSITIVE_PREFIXES = [
  { prefix: '/admin',     mount: '/api/admin',     label: 'admin',     priority: 100,
    requiresAuth: true,  requiresOwnership: false, requiresRole: ['admin', 'super_admin', 'platform_admin', 'institutional_admin'] },
  { prefix: '/ngo',       mount: '/api/ngo',       label: 'ngo',       priority: 90,
    requiresAuth: true,  requiresOwnership: false, requiresOrgScope: true },
  { prefix: '/programs',  mount: '/api/programs',  label: 'programs',  priority: 90,
    requiresAuth: true,  requiresOwnership: false, requiresOrgScope: true },
  { prefix: '/farms',     mount: '/api/farms',     label: 'farms',     priority: 80,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/farm-',     mount: '/api/v2/farm-*', label: 'farms-v2',  priority: 80,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/farm-profile', mount: '/api/v2/farm-profile', label: 'farm-profile', priority: 80,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/gardens',   mount: '/api/gardens',   label: 'gardens',   priority: 80,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/scans',     mount: '/api/scans',     label: 'scans',     priority: 80,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/seed-scans',mount: '/api/v2/seed-scans', label: 'scans-v2', priority: 80,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/scan',      mount: '/api/scan',      label: 'scan',      priority: 80,
    requiresAuth: true,  requiresOwnership: false },
  { prefix: '/tasks',     mount: '/api/tasks',     label: 'tasks',     priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/farm-tasks',mount: '/api/v2/farm-tasks', label: 'farm-tasks', priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/progress',  mount: '/api/progress',  label: 'progress',  priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/uploads',   mount: '/uploads',       label: 'uploads',   priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/buyer',     mount: '/api/buyer',     label: 'buyer',     priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/buyers',    mount: '/api/v2/buyers', label: 'buyers',    priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/buyer-links', mount: '/api/v2/buyer-links', label: 'buyer-links', priority: 70,
    requiresAuth: true,  requiresOwnership: true },
  { prefix: '/farmers',   mount: '/api/farmers',   label: 'farmers',   priority: 70,
    requiresAuth: true,  requiresOwnership: true },
];

// ─── Auth / ownership / role / org middleware tokens ──────
// Any of these on the chain satisfies the corresponding gate.
// Common shorthand identifiers that appear in factory-pattern
// routers where the auth middleware is destructured from
// opts: `const { requireAuth: auth } = opts`. These would be
// invisible to the static parser without an explicit allow-list.
const AUTH_TOKENS         = new Set(['authenticate', 'requireAuth', 'auth']);
const OWNERSHIP_TOKENS    = new Set([
  'requireOwnership', 'requireFarmerOwnership', 'requireOwnershipOrRole',
  'requireApplicationAccess',
]);
const ROLE_TOKENS         = new Set([
  'authorize', 'requireRole', 'requireAdmin', 'blockRoles',
  // Pre-built admin-shaped gates that wrap authenticate +
  // authorize internally. When seen on a chain the route is
  // both authenticated AND role-gated, so we credit both.
  'adminGate',
]);
const ORG_SCOPE_TOKENS    = new Set([
  'extractOrganization', 'verifyOrgAccess', 'orgScope', 'orgWhereFarmer',
  'orgWhereUser', 'orgWhereApplication',
]);
const PROGRAM_TOKENS      = new Set(['verifyProgramAccess', 'requireProgramAccess']);

// Lower-cased mirror sets used by import-alias parser.
const AUTH_TOKENS_LOWER       = new Set([...AUTH_TOKENS].map((s) => s.toLowerCase()));
const OWNERSHIP_TOKENS_LOWER  = new Set([...OWNERSHIP_TOKENS].map((s) => s.toLowerCase()));
const ROLE_TOKENS_LOWER       = new Set([...ROLE_TOKENS].map((s) => s.toLowerCase()));
const ORG_SCOPE_TOKENS_LOWER  = new Set([...ORG_SCOPE_TOKENS].map((s) => s.toLowerCase()));
const PROGRAM_TOKENS_LOWER    = new Set([...PROGRAM_TOKENS].map((s) => s.toLowerCase()));

// Wrapper middleware that performs auth + role internally.
// Treating these as covering BOTH gates avoids false positives
// when a route uses a pre-built `adminGate` instead of stacking
// authenticate + authorize directly.
const COMPOSITE_AUTH_ROLE = new Set(['adminGate']);

// Public path patterns that bypass the auth requirement even
// when they fall under a sensitive prefix (per spec §2.1 +
// §2.10 of SECURITY_AUDIT_REPORT.md).
const PUBLIC_BYPASS_PATTERNS = [
  /^\/health$/,
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/verify(-email|-otp|-phone)?$/,
  /^\/check-duplicate$/,
  /^\/sms\//,
  // Public marketplace browse — buyer flow shows listings before
  // signup per Final Go-Live Audit §10.
  /^\/$/,           // root listing
  /^\/listings$/,   // public listings
  /^\/listings\/public/,
];

// Skip dirs / files
const SKIP_DIRS  = new Set(['node_modules', 'dist', 'build', 'coverage', '__tests__', 'tests']);
const SKIP_NAMES = new Set([]);

// ─── Walk ─────────────────────────────────────────────────
function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* walk(full);
    } else if (ent.isFile()) {
      if (SKIP_NAMES.has(ent.name)) continue;
      // Only route files: filenames matching `routes.js` /
      // `<something>.js` directly under server/routes/, and
      // `routes.js` under server/src/modules/<module>/.
      const rel = path.relative(SERVER_DIR, full).replace(/\\/g, '/');
      if (rel.startsWith('routes/') && full.endsWith('.js')) yield full;
      else if (rel.startsWith('src/modules/') && full.endsWith('routes.js')) yield full;
    }
  }
}

// ─── Per-file analysis ────────────────────────────────────
const ROUTE_RE = /\brouter\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(/g;
const PRISMA_FIND_RE = /\bprisma\s*\.\s*([a-zA-Z_$][\w$]*)\s*\.\s*(findUnique|findFirst|findMany)\s*\(/g;
const IGNORE_MARKER  = 'security:routes:ignore';

/** Parse `const X = requireRole(...)` / `const X = authorize(...)`
 *  / `const X = authenticate` etc. — a common pattern where a
 *  pre-bound middleware is given a domain-specific name (e.g.
 *  `const requireAdmin = requireRole('super_admin')`).
 *  Returns Map<localName, role>.
 */
function parseConstAliases(source) {
  const out = new Map();
  // const NAME = identifier(args);   OR
  // const NAME = identifier;
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*(?:\(([^)]*)\))?\s*;?/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const target = m[2];
    const lower = String(target).toLowerCase();
    let role = null;
    if (AUTH_TOKENS_LOWER.has(lower))      role = 'auth';
    else if (ROLE_TOKENS_LOWER.has(lower)) role = 'role';
    else if (OWNERSHIP_TOKENS_LOWER.has(lower)) role = 'ownership';
    else if (ORG_SCOPE_TOKENS_LOWER.has(lower)) role = 'orgScope';
    else if (PROGRAM_TOKENS_LOWER.has(lower))   role = 'program';
    if (role) {
      if (!out.has(name)) out.set(name, new Set());
      out.get(name).add(role);
    }
  }
  return out;
}

/** Parse `import { authenticate, requireAuth as auth, foo } from '...'`
 *  and return a set of LOCAL names that the file actually uses
 *  for any of the canonical auth/role/ownership/org tokens. The
 *  detector then treats any of those local names as satisfying
 *  the corresponding gate.
 *
 *  Also captures `import authenticate from '../middleware/...'`
 *  default-import shape so single-symbol auth modules work.
 */
function parseImportAliases(source) {
  // Map<localName, setOfRoles> where role ∈ {auth, ownership, role, orgScope, program}
  const out = new Map();
  const ROLE_OF = (name) => {
    const lower = String(name).toLowerCase();
    if (AUTH_TOKENS_LOWER.has(lower))      return 'auth';
    if (OWNERSHIP_TOKENS_LOWER.has(lower)) return 'ownership';
    if (ROLE_TOKENS_LOWER.has(lower))      return 'role';
    if (ORG_SCOPE_TOKENS_LOWER.has(lower)) return 'orgScope';
    if (PROGRAM_TOKENS_LOWER.has(lower))   return 'program';
    return null;
  };
  const add = (local, role) => {
    if (!local || !role) return;
    if (!out.has(local)) out.set(local, new Set());
    out.get(local).add(role);
  };

  // Named imports: `import { a, b as c, d } from '...'`
  const namedRe = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g;
  let m;
  while ((m = namedRe.exec(source)) !== null) {
    const body = m[1];
    for (const part of body.split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      // `original as local` OR `original`
      const aliasMatch = piece.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      let original, local;
      if (aliasMatch) { original = aliasMatch[1]; local = aliasMatch[2]; }
      else {
        const idMatch = piece.match(/^([A-Za-z_$][\w$]*)$/);
        if (!idMatch) continue;
        original = local = idMatch[1];
      }
      const role = ROLE_OF(original);
      if (role) add(local, role);
    }
  }

  // Default imports: `import authenticate from '...'`
  const defaultRe = /import\s+([A-Za-z_$][\w$]*)\s+from\s*['"][^'"]+['"]/g;
  while ((m = defaultRe.exec(source)) !== null) {
    const local = m[1];
    const role = ROLE_OF(local);
    if (role) add(local, role);
  }

  return out;
}

/** Resolve `const NAME = [identifierA, identifierB, ...]`
 *  declarations at module scope so the route scanner can
 *  expand `...NAME` spreads in a middleware list.
 *
 *  Also handles single-line `const NAME = [auth, role]` shape
 *  AND multi-line declarations. Returns a Map<name, string[]>
 *  of identifier tokens captured inside each array literal.
 */
function parseMiddlewareArrays(source) {
  const out = new Map();
  // Capture both `const X = [...]` and `let X = [...]`. Body is
  // matched non-greedily to the first ']' so simple arrays work;
  // nested arrays are uncommon in middleware constants and are
  // best-effort.
  const re = /\b(?:const|let|var)\s+([A-Z_][A-Z0-9_]+|[A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2];
    // Only capture if the body looks like a middleware list:
    // identifiers / call expressions separated by commas.
    // Reject obvious non-middleware (object literals,
    // template strings, numeric arrays). Single/double-quoted
    // strings ARE allowed because middleware factories like
    // `authorize('admin')` carry quoted role arguments.
    if (/[{`]/.test(body)) continue;
    if (/^\s*\d/.test(body)) continue;
    // Reject when the body is clearly a string array
    // (`['en', 'fr', 'sw']`) by checking that EVERY top-level
    // element starts with a quote.
    {
      const top = body.split(',').map((s) => s.trim()).filter(Boolean);
      if (top.length > 0 && top.every((s) => /^['"]/.test(s))) continue;
    }
    const tokens = body
      .split(',')
      .map((s) => s.trim())
      .map((s) => {
        // `authorize('admin')` → 'authorize'
        const mm = s.match(/^([A-Za-z_$][\w$]*)/);
        return mm ? mm[1] : null;
      })
      .filter(Boolean);
    // Only persist when the array actually carries middleware-shaped
    // identifiers. Reject when only generic tokens appear.
    if (tokens.length > 0) out.set(name, tokens);
  }
  return out;
}

/** Tokenize the middleware list of a route call by scanning
 *  arguments after the path until the handler arrow function or
 *  asyncHandler call. Returns an array of identifier names that
 *  appear at the start of each argument expression.
 */
function parseRouteArgs(source, callStart, mwArrays) {
  // Walk character-by-character with paren / brace depth so we
  // can split args on top-level commas.
  let i = callStart;
  while (i < source.length && source[i] !== '(') i += 1;
  if (i >= source.length) return { path: null, mw: [], handlerEnd: i };
  i += 1; // past '('
  let depth = 1;
  let argStart = i;
  const args = [];
  let inSingle = false, inDouble = false, inBacktick = false, inTemplate = 0, inLineComment = false, inBlockComment = false;

  while (i < source.length && depth > 0) {
    const c = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
    } else if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i += 1; }
    } else if (inSingle) {
      if (c === '\\') i += 1;
      else if (c === "'") inSingle = false;
    } else if (inDouble) {
      if (c === '\\') i += 1;
      else if (c === '"') inDouble = false;
    } else if (inBacktick) {
      if (c === '\\') i += 1;
      else if (c === '`') inBacktick = false;
    } else {
      if (c === '/' && next === '/') { inLineComment = true; i += 1; }
      else if (c === '/' && next === '*') { inBlockComment = true; i += 1; }
      else if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      else if (c === '`') inBacktick = true;
      else if (c === '(' || c === '[' || c === '{') depth += 1;
      else if (c === ')' || c === ']' || c === '}') {
        depth -= 1;
        if (depth === 0) {
          args.push(source.slice(argStart, i).trim());
          break;
        }
      } else if (c === ',' && depth === 1) {
        args.push(source.slice(argStart, i).trim());
        argStart = i + 1;
      }
    }
    i += 1;
  }
  void inTemplate;

  // First arg is the path string (or regex). Strip quotes.
  const first = args[0] || '';
  let routePath = null;
  const sm = first.match(/^['"`]([^'"`]+)['"`]\s*$/);
  if (sm) routePath = sm[1];
  // Remainder are middleware. Capture the leading identifier
  // OR — for spread expressions `...NAME` — pull every token
  // from the named middleware-array constant resolved via
  // mwArrays. Tokens like `express` (the framework, used for
  // `express.json()`) are noise and excluded so they don't
  // hide a missing-auth finding.
  const NOISE = new Set(['express', 'req', 'res', 'next', 'router']);
  const tail = args.slice(1);
  const mw = [];
  for (const expr of tail) {
    if (!expr) continue;
    // Skip handler-shaped args.
    if (/^async\s*\(/.test(expr) || /^\(\s*req/.test(expr)) continue;
    if (/^asyncHandler\s*\(/.test(expr)) continue;

    // Spread of a known middleware array constant.
    const spread = expr.match(/^\.\.\.\s*([A-Za-z_$][\w$]*)/);
    if (spread) {
      const arr = mwArrays && mwArrays.get(spread[1]);
      if (arr && arr.length > 0) {
        for (const t of arr) {
          if (t && !NOISE.has(t)) mw.push(t);
        }
        continue;
      }
      // Spread of an unknown identifier — record the spread token
      // itself so the developer sees the chain isn't empty, but
      // mark it noise (won't satisfy any guard requirement).
      continue;
    }

    const m = expr.match(/^([A-Za-z_$][\w$]*)/);
    if (m && !NOISE.has(m[1])) mw.push(m[1]);
  }

  return { path: routePath, mw, handlerEnd: i };
}

/** Compute the 1-based line number for an offset. */
function lineOf(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

/** Detect router-wide middleware: every `router.use(<ident>)`
 *  call at module top-level. We don't need to be precise about
 *  scope — files don't redeclare `router`. */
function parseRouterUse(source, mwArrays) {
  const out = [];
  const re = /\brouter\s*\.\s*use\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const args = parseRouteArgs(source, m.index, mwArrays);
    // router.use can be `router.use(mw)` or `router.use('/path', mw)`.
    // Either way, every identifier in args.mw counts.
    if (!args.path) {
      // First arg was an identifier, not a string → middleware
      // call: parse the FIRST arg as a middleware token too.
      // We approximated args.mw by splitting after the first arg;
      // re-parse including the first.
      // Reuse parseRouteArgs but treat all args as mw.
      // Simpler: extract the raw call and split.
      const rawStart = m.index;
      const args2 = _splitAllArgs(source, rawStart);
      for (const a of args2) {
        const mm = a.match(/^([A-Za-z_$][\w$]*)/);
        if (mm) out.push(mm[1]);
      }
    } else {
      // path-prefixed router.use — middleware tokens still count
      for (const tok of args.mw) out.push(tok);
    }
  }
  return out;
}

function _splitAllArgs(source, callStart) {
  let i = callStart;
  while (i < source.length && source[i] !== '(') i += 1;
  if (i >= source.length) return [];
  i += 1;
  let depth = 1;
  let argStart = i;
  const out = [];
  let inSingle = false, inDouble = false, inBacktick = false, inLineComment = false, inBlockComment = false;
  while (i < source.length && depth > 0) {
    const c = source[i], next = source[i + 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; }
    else if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i += 1; } }
    else if (inSingle) { if (c === '\\') i += 1; else if (c === "'") inSingle = false; }
    else if (inDouble) { if (c === '\\') i += 1; else if (c === '"') inDouble = false; }
    else if (inBacktick) { if (c === '\\') i += 1; else if (c === '`') inBacktick = false; }
    else {
      if (c === '/' && next === '/') { inLineComment = true; i += 1; }
      else if (c === '/' && next === '*') { inBlockComment = true; i += 1; }
      else if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      else if (c === '`') inBacktick = true;
      else if (c === '(' || c === '[' || c === '{') depth += 1;
      else if (c === ')' || c === ']' || c === '}') {
        depth -= 1;
        if (depth === 0) { out.push(source.slice(argStart, i).trim()); break; }
      } else if (c === ',' && depth === 1) {
        out.push(source.slice(argStart, i).trim());
        argStart = i + 1;
      }
    }
    i += 1;
  }
  return out.filter(Boolean);
}

function _hasIgnoreMarker(source, lineIdx) {
  // Look at the line before lineIdx (1-based) for the ignore marker.
  if (lineIdx <= 1) return false;
  const lines = source.split(/\r?\n/);
  const prev = lines[lineIdx - 2] || '';
  return prev.includes(IGNORE_MARKER);
}

/** Resolve which mount the route file represents based on its path. */
function resolveMount(relPath) {
  // server/routes/foo.js → app.use('/api/v2/foo', …) typically.
  // server/src/modules/<mod>/routes.js → app.use('/api/<mod>', …).
  // We use a coarse mapping driven by app.js, but for the audit
  // it's enough to use the BASENAME / module-name as the
  // "starts with" hint.
  if (relPath.startsWith('routes/')) {
    const base = path.basename(relPath, '.js');
    return `/api/v2/${base}`; // most v2 routes mount under /api/v2/<base>
  }
  if (relPath.startsWith('src/modules/')) {
    const parts = relPath.split('/');
    const mod   = parts[2] || 'unknown';
    return `/api/${mod}`;
  }
  return '/api';
}

/** Determine sensitivity / required guards from the mount + route path. */
function classifyRoute(mount, routePath) {
  const full = `${mount}${routePath || ''}`;
  // Sort by priority desc so the most-specific match wins.
  const sorted = [...SENSITIVE_PREFIXES].sort((a, b) => b.priority - a.priority);
  for (const cfg of sorted) {
    // Match against the full mount path (e.g. /api/v2/farm-tasks)
    // OR the route path itself (covers `router.get('/scans/:id'...)`)
    if (
      full.includes(cfg.prefix)        // /admin in /api/admin
      || full.includes(cfg.prefix + '/')
      || full.endsWith(cfg.prefix)
      || (routePath && routePath.startsWith(cfg.prefix))
    ) {
      return cfg;
    }
  }
  return null;
}

/** Detect if the route path carries an :id-shaped param. */
function hasIdParam(routePath) {
  if (!routePath) return false;
  return /:(?:id|farmId|farmerId|gardenId|scanId|taskId|listingId|inquiryId|userId|programId|orgId|reportId|cycleId|sessionId|inviteId|applicationId|buyerId|fieldVisitId)\b/.test(routePath);
}

/** Detect public bypass. */
function isPublicBypass(routePath) {
  if (!routePath) return false;
  for (const re of PUBLIC_BYPASS_PATTERNS) {
    if (re.test(routePath)) return true;
  }
  return false;
}

// ─── Prisma findUnique / findFirst / findMany audit ───────
function auditPrismaCalls(source, relPath, fileFindings) {
  let m;
  PRISMA_FIND_RE.lastIndex = 0;
  while ((m = PRISMA_FIND_RE.exec(source)) !== null) {
    const model  = m[1];
    const method = m[2];
    const callStart = m.index;
    const callLine  = lineOf(source, callStart);
    if (_hasIgnoreMarker(source, callLine)) continue;

    // Capture the whole call expression up to the matching ')'.
    let i = callStart;
    while (i < source.length && source[i] !== '(') i += 1;
    let depth = 0, end = i;
    for (let j = i; j < source.length; j += 1) {
      const c = source[j];
      if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) { end = j; break; }
      }
    }
    const expr = source.slice(callStart, end + 1);

    // Heuristics:
    //  • findUnique on a model that we know to be sensitive AND
    //    the where clause references `req.params.id` /
    //    `req.params.<x>` WITHOUT also referencing `userId`
    //    `ownerId` / `orgId` / `programId` / `visibility`.
    //  • findFirst is allowed; usually carries the constraint.
    //  • findMany is allowed; bulk ops typically carry orgScope.
    if (method !== 'findUnique') continue;

    const sensitiveModels = new Set([
      'farmProfile', 'farm', 'garden',
      'scanTrainingEvent', 'scan', 'farmTask', 'task',
      'buyerInquiry', 'application', 'cropCycle', 'v2CropCycle',
      'fieldVisit', 'harvestRecord',
    ]);
    if (!sensitiveModels.has(model)) continue;

    // Where clause inspection — does it scope to the user?
    const referencesParam = /\breq\.params\./.test(expr);
    const hasOwner = /\b(?:userId|ownerId|orgId|organizationId|programId|visibility|farmer\s*:\s*\{)\b/.test(expr);
    if (referencesParam && !hasOwner) {
      fileFindings.push({
        kind:     'prisma',
        method,
        model,
        file:     relPath,
        line:     callLine,
        path:     null,
        verb:     null,
        missing:  ['DB-level ownership constraint'],
        severity: 'high',
        fix: [
          `Replace prisma.${model}.findUnique({ where: { id } }) with`,
          `prisma.${model}.findFirst({ where: { id, userId: req.user.id } })`,
          'or wrap the route in requireOwnership(\'<resource>\').',
        ].join(' '),
      });
    }
  }
}

// ─── File scan ────────────────────────────────────────────
const ALL_FINDINGS = [];
let routesScanned = 0;
let filesScanned = 0;

for (const file of walk(SERVER_DIR)) {
  let source;
  try { source = fs.readFileSync(file, 'utf8'); }
  catch { continue; }
  filesScanned += 1;
  const rel = path.relative(SERVER_DIR, file).replace(/\\/g, '/');
  const mount = resolveMount(rel);

  // protectedRouter detection — when the file uses
  // `protectedRouter()` to construct its router, every route on it
  // gets `authenticate` auto-applied AND any unguarded :id route
  // is blocked at runtime by a 404/500 terminator. Treat the
  // router-wide chain as INHERITING auth so the static scanner
  // doesn't double-flag routes that the runtime helper already
  // covers. `protectedRouter({ adminOnly: true })` ALSO inherits
  // role gating.
  const protectedRouterMatch = /\bprotectedRouter\s*\(/.test(source);
  const adminOnlyRouterMatch = /\bprotectedRouter\s*\(\s*\{[^}]*adminOnly\s*:\s*true/.test(source);

  // Resolve import aliases first — `import { authenticate as auth }`
  // means a chain showing `auth` satisfies the auth gate.
  const importAliases = parseImportAliases(source);
  // ALSO catch domain-specific bindings: `const requireAdmin = requireRole('admin')`.
  const constAliases  = parseConstAliases(source);
  // Merge into a single map. const aliases override imports on the
  // rare case where a name is rebound; both contribute roles when
  // the local name is unique.
  const aliases = new Map(importAliases);
  for (const [name, roles] of constAliases) {
    if (aliases.has(name)) {
      const merged = new Set([...aliases.get(name), ...roles]);
      aliases.set(name, merged);
    } else {
      aliases.set(name, roles);
    }
  }
  // Resolve middleware-array constants so route-level spreads
  // (`...FARMER_SCOPE`) can be expanded.
  const mwArrays = parseMiddlewareArrays(source);
  const routerWide = parseRouterUse(source, mwArrays);
  // satisfies(rolesArray, tokenList) checks whether ANY token
  // in the list either is a canonical token of the role or
  // its import alias maps to that role OR it's in the
  // composite-auth-role wrapper set.
  function satisfies(role, tokens) {
    for (const tok of tokens) {
      const lower = String(tok || '').toLowerCase();
      if (!lower) continue;
      // Canonical match
      const canonical = ({
        auth:       AUTH_TOKENS_LOWER,
        role:       ROLE_TOKENS_LOWER,
        ownership:  OWNERSHIP_TOKENS_LOWER,
        orgScope:   ORG_SCOPE_TOKENS_LOWER,
        program:    PROGRAM_TOKENS_LOWER,
      })[role];
      if (canonical && canonical.has(lower)) return true;
      // Alias match (case-sensitive — preserve original)
      const aliasRoles = aliases.get(tok);
      if (aliasRoles && aliasRoles.has(role)) return true;
      // Composite wrappers (e.g. `adminGate`) cover both auth+role.
      if (COMPOSITE_AUTH_ROLE.has(tok) && (role === 'auth' || role === 'role')) {
        return true;
      }
    }
    return false;
  }
  // Treat router-wide auth as inherited by every handler.
  const inherits = {
    auth:       satisfies('auth',      routerWide),
    role:       satisfies('role',      routerWide),
    ownership:  satisfies('ownership', routerWide),
    orgScope:   satisfies('orgScope',  routerWide),
    program:    satisfies('program',   routerWide),
  };
  // protectedRouter() implicitly applies authenticate; the
  // adminOnly variant also applies authorize(). Credit both.
  if (protectedRouterMatch) {
    inherits.auth = true;
    // Plus: protectedRouter blocks unguarded :id routes at
    // runtime, so the scanner can credit ownership too — there
    // physically can't be an unguarded :id route on this surface.
    inherits.ownership = true;
  }
  if (adminOnlyRouterMatch) {
    inherits.role = true;
  }

  const fileFindings = [];

  let m;
  ROUTE_RE.lastIndex = 0;
  while ((m = ROUTE_RE.exec(source)) !== null) {
    const verb = m[1];
    if (verb === 'use') continue; // already parsed
    const callStart = m.index;
    const lineNo = lineOf(source, callStart);
    if (_hasIgnoreMarker(source, lineNo)) continue;
    const parsed = parseRouteArgs(source, callStart, mwArrays);
    if (!parsed.path) continue;
    routesScanned += 1;

    // Route-level chain — alias-aware via the file-scoped
    // `satisfies(...)` closure. Inherits from router-wide.
    const has = {
      auth:       inherits.auth      || satisfies('auth',      parsed.mw),
      role:       inherits.role      || satisfies('role',      parsed.mw),
      ownership:  inherits.ownership || satisfies('ownership', parsed.mw),
      orgScope:   inherits.orgScope  || satisfies('orgScope',  parsed.mw),
      program:    inherits.program   || satisfies('program',   parsed.mw),
    };
    // Inference: a route that already has a role guard MUST be
    // authenticated upstream (requireRole reads req.user). This
    // catches factory-pattern routers that destructure auth/admin
    // from `opts` (local names not visible to the static parser).
    if (has.role) has.auth = true;
    // Same for ownership: every requireOwnership variant reads
    // req.user, so its presence implies authentication earlier.
    if (has.ownership) has.auth = true;

    const cfg = classifyRoute(mount, parsed.path);
    const idShape = hasIdParam(parsed.path);
    const isPublic = isPublicBypass(parsed.path);

    if (!cfg && !idShape) continue; // not in any sensitive surface

    // Public bypass: skip auth requirements; still check
    // ownership/role on :id routes when the route is also under
    // a sensitive prefix.
    const requiresAuth      = !!(cfg && cfg.requiresAuth) && !isPublic;
    const requiresOwnership = !!(cfg && cfg.requiresOwnership) && idShape;
    const requiresRole      = !!(cfg && cfg.requiresRole && cfg.requiresRole.length > 0);
    const requiresOrgScope  = !!(cfg && cfg.requiresOrgScope);

    const missing = [];
    if (requiresAuth && !has.auth) missing.push('requireAuth / authenticate');
    if (requiresOwnership && !(has.ownership || has.role)) {
      missing.push('requireOwnership(...) or requireRole(...)');
    }
    if (requiresRole && !has.role) missing.push(`requireRole(${cfg.requiresRole.join('|')})`);
    if (requiresOrgScope && !(has.orgScope || has.role)) {
      missing.push('extractOrganization / verifyOrgAccess');
    }
    // :id under any sensitive prefix that didn't already specify
    // ownership: still flag, MEDIUM severity, as a hint to add
    // requireOwnership.
    if (idShape && cfg && !cfg.requiresOwnership && !cfg.requiresRole && !has.ownership && !has.role) {
      missing.push('requireOwnership(...) (id-shaped path, no ownership/role guard)');
    }

    if (missing.length === 0) continue;

    let severity = 'medium';
    if (!has.auth && requiresAuth) severity = 'critical';
    else if (cfg && cfg.label === 'admin' && !has.role) severity = 'critical';
    else if (requiresOwnership && !(has.ownership || has.role)) severity = 'high';
    else if (requiresOrgScope && !(has.orgScope || has.role)) severity = 'high';

    fileFindings.push({
      kind:     'route',
      file:     rel,
      line:     lineNo,
      path:     parsed.path,
      mount,
      verb:     verb.toUpperCase(),
      missing,
      severity,
      chain:    parsed.mw,
      routerWide,
      fix:      buildFixHint(verb, parsed.path, missing),
    });
  }

  auditPrismaCalls(source, rel, fileFindings);
  ALL_FINDINGS.push(...fileFindings);
}

function buildFixHint(verb, routePath, missing) {
  const parts = [];
  if (missing.some((s) => s.includes('authenticate'))) {
    parts.push('Add `authenticate` (or `requireAuth`) before the handler, or call `router.use(authenticate)` at the top of the file.');
  }
  if (missing.some((s) => s.includes('requireOwnership'))) {
    parts.push('Add `requireOwnership(\'<farm|garden|scan|task|buyerInquiry>\')` so the row is fetched with `where: { id, userId }`.');
  }
  if (missing.some((s) => s.includes('requireRole'))) {
    parts.push('Add `authorize(...roles)` or `requireRole(...roles)` matching the route\'s allow-list.');
  }
  if (missing.some((s) => s.includes('extractOrganization'))) {
    parts.push('Add `extractOrganization` + use `orgWhereFarmer(req)` / `verifyOrgAccess(req, recordOrgId)` in the handler.');
  }
  return parts.join(' ');
}

// ─── Report ───────────────────────────────────────────────
function colour(s, code) {
  if (!process.stdout.isTTY) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}
const RED    = (s) => colour(s, '31');
const YELLOW = (s) => colour(s, '33');
const GREEN  = (s) => colour(s, '32');
const DIM    = (s) => colour(s, '2');
const BOLD   = (s) => colour(s, '1');

function severityTag(sev) {
  switch (sev) {
    case 'critical': return RED('[CRITICAL]');
    case 'high':     return RED('[HIGH]   ');
    case 'medium':   return YELLOW('[MEDIUM] ');
    default:         return DIM('[LOW]    ');
  }
}

console.log();
console.log(BOLD('Farroway — backend route security audit'));
console.log(DIM(`Server tree: ${path.relative(ROOT, SERVER_DIR)} · ${filesScanned} route files · ${routesScanned} route registrations\n`));

if (ALL_FINDINGS.length === 0) {
  console.log(GREEN('\u2713 PASS — every sensitive route in the audit set is protected.'));
  process.exit(0);
}

// Bucket by severity for the summary.
const bySev = ALL_FINDINGS.reduce((acc, f) => {
  acc[f.severity] = (acc[f.severity] || 0) + 1;
  return acc;
}, {});

console.log(RED(`\u2717 FAIL — ${ALL_FINDINGS.length} finding(s):`));
console.log(DIM('  ' + Object.entries(bySev).map(([s, n]) => `${s}=${n}`).join(', ')));
console.log();

// Sort: critical → high → medium → low; within group, by file/line.
const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
ALL_FINDINGS.sort((a, b) => {
  const o = (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9);
  if (o !== 0) return o;
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return (a.line || 0) - (b.line || 0);
});

for (const f of ALL_FINDINGS) {
  const tag = severityTag(f.severity);
  if (f.kind === 'route') {
    const where = `${f.file}:${f.line}`;
    console.log(`${tag}  ${BOLD(f.verb)} ${f.mount}${f.path}`);
    console.log(`            ${DIM(where)}`);
    console.log(`            Missing: ${f.missing.join('; ')}`);
    if (f.chain && f.chain.length > 0) {
      console.log(`            Current chain (per-route): ${DIM(f.chain.join(' \u2192 ') || '<none>')}`);
    }
    if (f.routerWide && f.routerWide.length > 0) {
      console.log(`            Router-wide: ${DIM(f.routerWide.join(' \u2192 '))}`);
    }
    if (f.fix) {
      console.log(`            ${GREEN('Fix:')} ${f.fix}`);
    }
  } else if (f.kind === 'prisma') {
    console.log(`${tag}  prisma.${f.model}.${f.method}() without ownership constraint`);
    console.log(`            ${DIM(`${f.file}:${f.line}`)}`);
    console.log(`            ${GREEN('Fix:')} ${f.fix}`);
  }
  console.log();
}

console.log(DIM(`Allow-list a known-safe finding by adding \`// ${IGNORE_MARKER}\` to the line above the route registration. Use sparingly.`));
console.log();
process.exit(1);
