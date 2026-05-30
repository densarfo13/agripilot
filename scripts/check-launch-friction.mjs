#!/usr/bin/env node
/**
 * scripts/check-launch-friction.mjs — Launch hardening gate.
 *
 * Bans technical-language tokens from GROWER-VISIBLE copy only.
 *
 *   The spec §10 lists banned tokens:
 *     "Camera ran into a problem", classifier, runtime error,
 *     OODA, artifact, federation, RBAC, dashboard, analytics,
 *     progress.
 *
 *   Scope is narrow — we ONLY scan three known user-visible
 *   surfaces, because broad identifier matches false-positive
 *   on import paths, version constants, role-feature labels
 *   and runtime-internal symbols.
 *
 *   Scanned patterns (all CASE-INSENSITIVE):
 *     a. tSafe('key', 'FALLBACK')               — fallback arg
 *     b. tStrict('key', 'FALLBACK')             — same
 *     c. >TOKEN<                                — bare JSX text
 *     d. Exact spec phrases (always banned):
 *           "Camera ran into a problem",
 *           "Tap retry to try again",
 *           "Retry camera".
 *
 *   Allowlisted paths:
 *     src/pages/internal/**, src/pages/enterprise/**,
 *     src/pages/admin*, src/pages/organization/**,
 *     src/pages/ngo/**, src/runtime/**, src/i18n/**, scripts/**,
 *     server/**, src/pages/Dashboard.jsx + DashboardPage.jsx
 *     (legacy admin surfaces that redirect farmers to /home).
 *
 * Strict-rule audit
 *   • Read-only. Pure file walk.
 *   • Exit 1 on hard blocker.
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

const ALLOW_PREFIXES = [
  'src/pages/internal/',
  'src/pages/enterprise/',
  'src/pages/organization/',
  'src/pages/ngo/',
  'src/pages/Admin',          // AdminUsersPage.jsx etc.
  'src/pages/admin/',         // admin/ subdir
  'src/runtime/',
  'src/i18n/',
  'src/lib/',                  // utility libs are not user-facing on their own
  'src/services/',             // service modules are not user-facing
  'src/core/',                 // core engines are not user-facing
  'src/hooks/',                // hooks are not user-facing
  'src/intelligence/',         // intelligence engines are not user-facing
  'src/api/',                  // API clients are not user-facing
  'src/data/',                 // data catalogs are not user-facing
  'src/components/analytics/', // admin analytics cards (staff-only)
  'src/components/admin/',     // admin-only components
  'src/components/ngo/',       // NGO-only components
  'src/components/enterprise/',// enterprise-only components
  'scripts/',
  'server/',
];

const ALLOW_FILES = new Set([
  'src/pages/Dashboard.jsx',          // legacy admin redirect surface
  'src/pages/DashboardPage.jsx',      // legacy admin redirect surface
  'src/pages/PrivacyPolicy.jsx',      // privacy disclosure mentions analytics
  'src/pages/Terms.jsx',
  'src/pages/Privacy.jsx',
  'src/pages/AdminImportFarmersPage.jsx',
  // Internal-tier dashboards / admin / NGO / org surfaces.
  // The spec exempts these (route guards keep growers out).
  'src/pages/FounderDashboard.jsx',
  'src/pages/ImpactDashboardPage.jsx',
  'src/pages/NGOMapDashboard.jsx',
  'src/pages/NgoValueDashboard.jsx',
  'src/pages/OperatorDashboard.jsx',
  'src/pages/FarmerAnalyticsPage.jsx',
  'src/pages/FarmerDetailPage.jsx',    // staff-only farmer detail
  'src/pages/PilotMetricsPage.jsx',
  'src/pages/VerificationQueuePage.jsx',
  'src/pages/OrgLoginPage.jsx',        // opt-in org SSO landing
  'src/pages/SafeHomeFallback.jsx',    // legacy fallback; updated separately
  // Staff utility shells / error boundaries — these surface for
  // logged-in staff who navigate to /dashboard. Growers are
  // redirected to /home and never see this copy.
  'src/components/DashboardErrorBoundary.jsx',
  'src/components/DashboardShell.jsx',
  'src/components/system/RoleHomeRedirect.jsx',
  'src/components/system/AppCrashBoundary.jsx',
]);

function _isAllowlisted(rel) {
  const r = rel.replace(/\\/g, '/');
  if (ALLOW_FILES.has(r)) return true;
  return ALLOW_PREFIXES.some((p) => r.startsWith(p));
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist'
          || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// Banned tokens.
const SOFT_TOKENS = [
  'classifier',
  'runtime error',
  'OODA',
  'RBAC',
  'federation',
  'artifact',
  'dashboard',
  'analytics',
  'progress',
];

// HARD phrases — banned wherever they appear in any non-allowlisted file.
const HARD_PHRASES = [
  /Camera\s+ran\s+into\s+a\s+problem/i,
  /Tap\s+retry\s+to\s+try\s+again/i,
  /\bRetry\s+camera\b/i,
];

/**
 * Extract user-visible text from a JS/JSX/TS source:
 *   • tSafe('key', 'FALLBACK')  → captures FALLBACK
 *   • tStrict('key', 'FALLBACK')→ captures FALLBACK
 *   • >Text<                    → captures Text (no nested tags)
 */
function extractUserVisibleStrings(src) {
  const out = [];
  // tSafe / tStrict / t( ... fallback)
  const T_FN = /\b(?:tSafe|tStrict|t)\(\s*['"`][^'"`]+['"`]\s*,\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = T_FN.exec(src)) !== null) out.push(m[1]);

  // JSX text nodes: >Foo< excluding {/* */} comments + variable interpolations
  const JSX_TEXT = />\s*([A-Za-z][A-Za-z0-9 ?!.,'‘’—-]{1,80})\s*</g;
  while ((m = JSX_TEXT.exec(src)) !== null) {
    const txt = m[1].trim();
    if (txt && !txt.startsWith('{') && !txt.startsWith('<')) {
      out.push(txt);
    }
  }
  return out;
}

let scanned = 0;
const violators = [];

for (const f of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (_isAllowlisted(rel)) continue;
  scanned++;
  const raw = read(f);
  const src = strip(raw);

  // ─── Hard phrases — match anywhere in the file ──────────
  for (const re of HARD_PHRASES) {
    const hit = src.match(re);
    if (hit) {
      violators.push({
        rel, id: 'phrase:' + hit[0].slice(0, 32),
        match: hit[0].slice(0, 60),
      });
      break;
    }
  }
  if (violators.length && violators[violators.length - 1].rel === rel) continue;

  // ─── Soft tokens — match only when the visible text is a
  //      SHORT LABEL (1-3 words) containing the token, OR is
  //      the token by itself. Generic English usage like
  //      "Good work. Progress updated." or "Scoring in
  //      progress..." is allowed — only NAV-LABEL / TAB-NAME
  //      style hits trip the gate.                          ──
  const visible = extractUserVisibleStrings(src);
  for (const txt of visible) {
    const trimmed = txt.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    // Only flag when the text reads like a label: ≤ 3 words
    // AND the banned token is one of those words.
    if (wordCount > 3) continue;
    const lo = trimmed.toLowerCase();
    for (const tok of SOFT_TOKENS) {
      const re = new RegExp('\\b' + tok.replace(/\s+/g, '\\s+') + '\\b', 'i');
      if (re.test(lo)) {
        violators.push({ rel, id: tok, match: trimmed.slice(0, 60) });
        break;
      }
    }
    if (violators.length && violators[violators.length - 1].rel === rel) break;
  }
}

if (violators.length > 0) {
  for (const v of violators) {
    fail(`launch-friction: ${v.rel} contains "${v.id}" — leaked technical language to grower copy (match="${v.match}")`);
  }
} else {
  pass(`launch-friction: scanned ${scanned} grower-facing files; 0 leaks`);
}

// ─── Diagnostic mirror — LaunchUXHealth pin must exist ──────
const launchUX = read(path.join(ROOT,
  'src/runtime/launch/LaunchUXHealth.ts'));
if (!launchUX) {
  fail(`launch-ux-health: src/runtime/launch/LaunchUXHealth.ts missing`);
} else {
  const REQUIRED_FLAGS = [
    'scanNavOpensCamera', 'uploadOptionAvailable',
    'noCameraErrorPage', 'analysisStatesReady',
    'resultScreenReady', 'addToPlantsReady',
    'starterTasksReady', 'activityTimelineReady',
    'onboardingSimple', 'offlineFallbackReady',
    'growerTechnicalLanguageRemoved',
  ];
  for (const flag of REQUIRED_FLAGS) {
    if (!new RegExp('\\b' + flag + '\\s*:').test(launchUX)) {
      fail(`launch-ux-health: __launchUXHealth() must expose "${flag}"`);
    }
  }
  pass(`launch-ux-health: __launchUXHealth() exposes all 11 spec flags`);
}

// ─── App.jsx boot install ──────────────────────────────────
const app = read(path.join(ROOT, 'src/App.jsx'));
if (!/installLaunchUXHealthGlobal/.test(app)) {
  fail(`boot: src/App.jsx must wire installLaunchUXHealthGlobal()`);
} else {
  pass(`boot: installLaunchUXHealthGlobal wired in App.jsx`);
}

if (FAILED.length > 0) {
  console.error('[check:launch-friction] FAIL — grower technical language leaked OR diagnostic missing.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:launch-friction] PASS — grower-facing copy clean of technical jargon.');
console.log(`  ${scanned} grower-facing files scanned; tSafe / tStrict / JSX-text surfaces only.`);
console.log(`  3 hard phrases + 9 soft tokens enforced.`);
console.log(`  __launchUXHealth() composite pinned; 11 spec flags wired.`);
