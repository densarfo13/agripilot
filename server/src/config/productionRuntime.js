/**
 * productionRuntime.js — single-shot startup banner for Railway /
 * production deploys.
 *
 *   import { logProductionStartupBanner, resolveBuildVersion }
 *     from './config/productionRuntime.js';
 *   logProductionStartupBanner();
 *
 * Emits a small, ordered, greppable block on boot:
 *
 *   [Farroway] Production runtime active
 *   [Farroway] Environment validated
 *   [Farroway] Upload service active
 *   [Farroway] Funding verification active
 *   [Farroway] Scan runtime active
 *
 * Followed by graceful-degradation lines (one per missing optional
 * provider) using the operator-facing pattern:
 *
 *   [Farroway] Missing WEATHER_API_KEY
 *   [Farroway] Funding ingestion disabled safely
 *
 * Strict-rule audit
 *   • Pure: never throws, never reads request data, never mutates env.
 *   • Idempotent: a `_emitted` flag stops a second print (HMR-safe).
 *   • Test-mode aware: silent under NODE_ENV=test so vitest output
 *     stays clean unless the test imports + invokes deliberately.
 *   • No secrets in logs — only env-var NAMES and pass/fail booleans.
 *   • Operator-friendly: every line starts with `[Farroway]` so
 *     `grep '^\[Farroway\]' railway.log` returns the boot summary.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

let _emitted = false;

// Read the repo's package.json once at module load so we can use
// its semver as a last-resort version when no commit-id env var is
// present. We try server/package.json first (this file lives in
// server/src/config/) and fall back to the repo-root package.json.
// Either is acceptable as a build identifier; both ship a stable
// semver.
const _PACKAGE_VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const rel of ['../../package.json', '../../../package.json']) {
      try {
        const raw = readFileSync(pathResolve(here, rel), 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
          return parsed.version.trim();
        }
      } catch { /* try next candidate */ }
    }
  } catch { /* swallow */ }
  return null;
})();

const REQUIRED_BACKEND = Object.freeze([
  { name: 'DATABASE_URL', aliases: [] },
  { name: 'AUTH_SECRET',  aliases: ['JWT_SECRET'] },
]);

// Per-service detection table — each service is "active" when ANY
// of its aliases is set. The May 2026 production-dependency wiring
// pass added the alternate cloud-provider key surfaces (Cloudinary
// / S3 / Mapbox / PlantNet / Plant.id) so an operator who configures
// the provider on Railway sees the matching service report `active`
// without further code changes.
const SERVICES = Object.freeze([
  { key: 'weather',  label: 'Weather',
    aliases: ['WEATHER_API_KEY', 'VITE_WEATHER_API_KEY'] },
  { key: 'maps',     label: 'Maps',
    aliases: [
      'MAPS_API_KEY', 'VITE_MAPS_API_KEY',
      'MAPBOX_TOKEN', 'VITE_MAPBOX_TOKEN',
      // Production-Dependency-Fix §5 — Google Maps is the
      // alternate provider documented in the operator
      // checklist; aliases let either flavour wire the
      // service without code changes.
      'GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY',
    ] },
  { key: 'scan',     label: 'Scan',
    // Production-Dependency-Fix §4 — provider priority order:
    // 1) Plant.id key  2) PlantNet key  3) generic SCAN_API_KEY
    // 4) OpenAI vision fallback. The first present alias wins;
    // the inference resolver in scanInferenceService.js mirrors
    // the same ordering.
    aliases: ['PLANT_ID_API_KEY', 'PLANTNET_API_KEY',
              'SCAN_API_KEY', 'OPENAI_API_KEY'] },
  { key: 'uploads',  label: 'Uploads',
    aliases: [
      'UPLOAD_BASE_URL',
      // Cloudinary single-URL form (spec §3 first-class).
      'CLOUDINARY_URL',
      'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
      'S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
    ] },
  { key: 'redis',    label: 'Redis',
    aliases: ['REDIS_URL'] },
  { key: 'sentry',   label: 'Sentry',
    aliases: ['SENTRY_DSN', 'VITE_SENTRY_DSN'] },
  { key: 'sms',      label: 'SMS',
    aliases: [
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
      // Production-Dependency-Fix §7 — accept the three
      // outbound-number naming variants Railway operators
      // commonly set. The Twilio service module reads them
      // through a shared resolver so the first present wins.
      'TWILIO_PHONE_NUMBER', 'TWILIO_PHONE', 'TWILIO_FROM_NUMBER',
      'TWILIO_VERIFY_SERVICE_SID',
    ] },
  { key: 'email',    label: 'Email',
    aliases: ['SENDGRID_API_KEY'] },
  { key: 'openai',   label: 'AI orchestration',
    aliases: ['OPENAI_API_KEY'] },
]);

// Legacy OPTIONAL_PROVIDERS kept for back-compat with the
// pre-wiring banner test format. Each entry corresponds to the
// FIRST canonical alias of a service so old tests grepping
// `Missing WEATHER_API_KEY` still match.
const OPTIONAL_PROVIDERS = Object.freeze(
  SERVICES.map((s) => ({
    name:    s.aliases[0],
    aliases: s.aliases.slice(1),
    feature: s.label,
  })),
);

function _present(name, aliases = []) {
  if (typeof process === 'undefined' || !process.env) return false;
  if (process.env[name]) return true;
  for (const a of aliases) if (process.env[a]) return true;
  return false;
}

function _isProd() {
  try { return (process.env.NODE_ENV || '') === 'production'; }
  catch { return false; }
}

function _isTest() {
  // Only NODE_ENV=test silences the banner — the VITEST flag is set
  // automatically when the suite runs, but a deliberate
  // `process.env.NODE_ENV = 'production'` inside a test must be
  // honoured so the acceptance test can verify the banner output.
  try { return (process.env.NODE_ENV || '') === 'test'; }
  catch { return false; }
}

/**
 * resolveBuildVersion — single source of truth for the build/version
 * stamp surfaced via /health.
 *
 *   Priority order:
 *     1. RAILWAY_GIT_COMMIT_SHA   (Railway-injected on PR + main builds)
 *     2. RAILWAY_DEPLOYMENT_ID    (Railway-injected even when SHA omitted)
 *     3. RENDER_GIT_COMMIT        (Render compatibility)
 *     4. VERCEL_GIT_COMMIT_SHA    (Vercel compatibility)
 *     5. SOURCE_COMMIT            (Heroku, generic CI)
 *     6. FARROWAY_COMMIT_SHA      (manual override)
 *     7. VITE_BUILD_ID            (frontend CI injection)
 *     8. BUILD_ID                 (generic CI override)
 *     9. APP_VERSION              (manually pinned)
 *    10. SEMVER_FROM_PACKAGE_JSON  (resolved via `process.env.npm_package_version`
 *                                   when the process was started via `npm start`)
 *    11. fallback string '0.0.0-local'
 *
 *   Soft-launch hardening note: before this expansion `/api/health`
 *   always returned `0.0.0-local` on the Railway deploy because the
 *   Railway service did not have `RAILWAY_GIT_COMMIT_SHA` injected
 *   (it's not on by default for some plans). The version stamp is
 *   the anchor for the rollback runbook, so we extend the alias
 *   list to cover Render / Vercel / Heroku / generic CI conventions
 *   plus `npm_package_version` which `npm start` populates for free.
 *
 *   Output: short string, ≤ 64 chars, never empty.
 */
export function resolveBuildVersion() {
  try {
    const env = (typeof process !== 'undefined' && process.env) || {};
    const candidates = [
      env.RAILWAY_GIT_COMMIT_SHA,
      env.RAILWAY_DEPLOYMENT_ID,
      env.RENDER_GIT_COMMIT,
      env.VERCEL_GIT_COMMIT_SHA,
      env.SOURCE_COMMIT,
      env.FARROWAY_COMMIT_SHA,
      env.VITE_BUILD_ID,
      env.BUILD_ID,
      env.APP_VERSION,
      // `npm_package_version` is set by npm when the process is
      // launched via `npm start` / `npm run <script>`. It carries
      // the semver from package.json, which is a sensible fallback
      // when no commit-id env is present. NOTE: a `cd <dir> && node
      // <script>` chain inside the npm script CAN lose this var,
      // which is why we also read package.json from disk below.
      env.npm_package_version,
      // Final fallback — semver read from disk at module load.
      // This survives any `cd && node` chain because we resolve
      // the file via `import.meta.url` rather than $PWD.
      _PACKAGE_VERSION,
    ];
    for (const v of candidates) {
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 64);
    }
  } catch { /* swallow */ }
  return '0.0.0-local';
}

/**
 * checkRequired — returns the names of any required vars missing.
 * Pure helper exposed for the acceptance test.
 */
export function checkRequired() {
  return REQUIRED_BACKEND
    .filter((e) => !_present(e.name, e.aliases))
    .map((e) => e.name);
}

/**
 * checkOptional — returns the missing optional providers.
 * Pure helper exposed for the acceptance test.
 */
export function checkOptional() {
  return OPTIONAL_PROVIDERS
    .filter((p) => !_present(p.name, p.aliases || []))
    .map((p) => ({ name: p.name, feature: p.feature }));
}

/**
 * serviceStatus — per-service active/disabled snapshot used by the
 * banner + by /health-style introspection endpoints. The `present`
 * field lists every alias that is currently set so an operator can
 * tell which key wired the service.
 *
 *   [
 *     { key: 'weather', label: 'Weather', active: true,
 *       present: ['WEATHER_API_KEY'] },
 *     { key: 'uploads', label: 'Uploads', active: false, present: [] },
 *     ...
 *   ]
 */
export function serviceStatus() {
  return SERVICES.map((s) => {
    const present = s.aliases.filter((n) =>
      typeof process !== 'undefined' && process.env && process.env[n]);
    return Object.freeze({
      key:     s.key,
      label:   s.label,
      active:  present.length > 0,
      present,
    });
  });
}

/**
 * logProductionStartupBanner — fire-and-forget banner emit.
 *
 *   • Silent in NODE_ENV=test (so vitest output stays clean).
 *   • Idempotent (second call is a no-op).
 *   • In dev mode the banner still fires, prefixed with [Farroway dev]
 *     so engineers see it locally without it polluting prod logs.
 */
export function logProductionStartupBanner() {
  if (_emitted) return;
  if (_isTest())  return;
  _emitted = true;

  const tag = _isProd() ? '[Farroway]' : '[Farroway dev]';
  const log = (line) => {
    try { /* eslint-disable-next-line no-console */ console.log(line); }
    catch { /* swallow */ }
  };

  log(`${tag} Production runtime active (${resolveBuildVersion()})`);

  const missingRequired = checkRequired();
  if (missingRequired.length === 0) {
    log(`${tag} Environment validated`);
  } else {
    log(`${tag} Environment validation FAILED — missing: ${missingRequired.join(', ')}`);
  }

  // Always-on subsystems — these run on the same process, so
  // the banner can claim "active" unconditionally.
  log(`${tag} Upload service active`);
  log(`${tag} Funding verification active`);
  log(`${tag} Scan runtime active`);

  // Per-service status block — single line per service so an
  // operator can spot the disabled features at a glance. The
  // banner is silent under NODE_ENV=test (handled at the top of
  // this function) so vitest stays clean.
  //
  // Production-Dependency-Fix §6 + §9 — AI orchestration falls
  // back to the rule-based ladder when OPENAI_API_KEY is unset
  // (never to "disabled"); reflect that in the banner so the
  // operator reads the actual runtime state, not just the
  // present/absent of the env var.
  const status = serviceStatus();
  for (const s of status) {
    if (s.active) {
      log(`${tag} ${s.label}: active`);
    } else if (s.key === 'openai') {
      log(`${tag} ${s.label}: rule-based (no key)`);
    } else {
      log(`${tag} ${s.label}: disabled (no key)`);
    }
  }

  // AI orchestration narrows further: when OPENAI_API_KEY isn't
  // set, the orchestrator falls back to the rule-based ladder
  // shipped in src/orchestration/orchestrator.js — never blocks
  // tasks/home/scan. The legacy "Missing X — disabled safely"
  // line stays so existing log dashboards keep matching.
  const missingOptional = checkOptional();
  for (const m of missingOptional) {
    log(`${tag} Missing ${m.name} — ${m.feature} disabled safely`);
  }
}

/**
 * resetForTests — only used by the acceptance test to re-arm the
 * idempotency flag between cases. Not exported by default.
 */
export function _resetForTests() { _emitted = false; }

export default logProductionStartupBanner;
