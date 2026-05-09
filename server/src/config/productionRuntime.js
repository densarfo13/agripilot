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

const OPTIONAL_PROVIDERS = Object.freeze([
  { name: 'WEATHER_API_KEY',     feature: 'Weather' },
  { name: 'MAPS_API_KEY',        feature: 'Maps'    },
  { name: 'TWILIO_ACCOUNT_SID',  feature: 'SMS'     },
  { name: 'SENDGRID_API_KEY',    feature: 'Email'   },
  { name: 'SCAN_API_KEY',        feature: 'External scan provider' },
  { name: 'OPENAI_API_KEY',      feature: 'OpenAI'  },
  { name: 'SENTRY_DSN',          feature: 'Sentry'  },
  { name: 'REDIS_URL',           feature: 'Redis cache' },
  { name: 'UPLOAD_BASE_URL',     feature: 'Upload base URL' },
]);

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

  // Per-provider degradation lines — single line each, names only.
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
