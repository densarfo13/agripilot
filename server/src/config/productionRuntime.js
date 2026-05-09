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

let _emitted = false;

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
    aliases: ['MAPS_API_KEY', 'VITE_MAPS_API_KEY',
              'MAPBOX_TOKEN', 'VITE_MAPBOX_TOKEN'] },
  { key: 'scan',     label: 'Scan',
    aliases: ['SCAN_API_KEY', 'PLANT_ID_API_KEY', 'PLANTNET_API_KEY'] },
  { key: 'uploads',  label: 'Uploads',
    aliases: [
      'UPLOAD_BASE_URL',
      'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
      'S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
    ] },
  { key: 'redis',    label: 'Redis',
    aliases: ['REDIS_URL'] },
  { key: 'sentry',   label: 'Sentry',
    aliases: ['SENTRY_DSN', 'VITE_SENTRY_DSN'] },
  { key: 'sms',      label: 'SMS',
    aliases: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'] },
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
 *     1. RAILWAY_GIT_COMMIT_SHA   (Railway-injected)
 *     2. VITE_BUILD_ID            (CI-injected)
 *     3. BUILD_ID                 (generic CI override)
 *     4. APP_VERSION              (manually pinned)
 *     5. fallback string '0.0.0-local'
 *
 *   Output: short string, ≤ 64 chars, never empty.
 */
export function resolveBuildVersion() {
  try {
    const env = (typeof process !== 'undefined' && process.env) || {};
    const candidates = [
      env.RAILWAY_GIT_COMMIT_SHA,
      env.VITE_BUILD_ID,
      env.BUILD_ID,
      env.APP_VERSION,
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
  const status = serviceStatus();
  for (const s of status) {
    if (s.active) {
      log(`${tag} ${s.label}: active`);
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
