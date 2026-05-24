/**
 * envSchema.js — single source of truth for every environment
 * variable Farroway consumes.
 *
 *   import {
 *     ENV_SCHEMA, validateEnv, summariseEnv, isEnvVarSet,
 *   } from './config/envSchema.js';
 *
 *   const { ok, missingRequired, missingOptional, disabledFeatures } = validateEnv();
 *   if (!ok) { ... boot still continues, only critical missing is fatal ... }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A typed registry of every env var the backend consults plus
 *   thin validators (set / unset, aliases, feature it gates).
 *
 *   It is NOT a runtime config loader — code that needs a value
 *   still reads `process.env.X` directly. The schema centralises
 *   the LIST of vars so:
 *     • The boot banner can print one consistent missing-env block.
 *     • `/api/system/status` can return a structured summary.
 *     • A reviewer can read ONE file to understand the full env
 *       surface, not chase grep across modules.
 *
 *   Critical vs optional:
 *     • CRITICAL — boot warns loudly; some flows degrade but the
 *       app does not crash. Today only DATABASE_URL + JWT_SECRET
 *       are unconditionally required; everything else is optional.
 *     • OPTIONAL — gates a feature. Missing = feature disabled,
 *       reported in the boot banner + system status.
 *
 *   The schema is the source of truth for the
 *   `docs/RAILWAY_ENV_CHECKLIST.md` file too.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. No secrets printed.
 *   • Aliases let the operator pick any of several common
 *     env var names (e.g. `JWT_SECRET` or `AUTH_SECRET`).
 */

/**
 * Severity codes used by the validator + the admin status route.
 *   • critical → boot may degrade major flows; runbook flag.
 *   • optional → feature disabled, app keeps running.
 *   • observability → infra/observability missing; non-feature.
 */
export const SEVERITY = Object.freeze({
  CRITICAL:      'critical',
  OPTIONAL:      'optional',
  OBSERVABILITY: 'observability',
});

/**
 * Authoritative env schema. Order matches the boot banner.
 * Each entry:
 *   {
 *     name:        canonical env var name
 *     aliases:     [other names accepted by operators]
 *     severity:    SEVERITY.*
 *     feature:     short human label of what it enables
 *     fallback:    short string — what the app does when missing
 *   }
 */
export const ENV_SCHEMA = Object.freeze([
  // ── Critical infra ─────────────────────────────────────
  {
    name: 'DATABASE_URL', aliases: [],
    severity: SEVERITY.CRITICAL,
    feature:  'PostgreSQL connection',
    fallback: 'app crashes at boot',
  },
  {
    name: 'JWT_SECRET', aliases: ['AUTH_SECRET'],
    severity: SEVERITY.CRITICAL,
    feature:  'auth token signing',
    fallback: 'app crashes at boot',
  },

  // ── Optional providers ─────────────────────────────────
  {
    name: 'WEATHER_API_KEY', aliases: ['VITE_WEATHER_API_KEY'],
    severity: SEVERITY.OPTIONAL, feature: 'Weather feed',
    fallback: 'weather-driven decisions fall back to crop-stage rules only',
  },
  {
    name: 'MAPS_API_KEY',
    aliases: ['VITE_MAPS_API_KEY', 'MAPBOX_TOKEN', 'VITE_MAPBOX_TOKEN',
              'GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY'],
    severity: SEVERITY.OPTIONAL, feature: 'Maps tiles',
    fallback: 'map surfaces render with placeholder grid',
  },
  {
    name: 'PLANT_ID_API_KEY',
    aliases: ['PLANTNET_API_KEY', 'SCAN_API_KEY', 'OPENAI_API_KEY'],
    severity: SEVERITY.OPTIONAL, feature: 'Scan AI provider',
    fallback: 'scan falls back to rule-based classifier',
  },
  {
    name: 'CLOUDINARY_CLOUD_NAME', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'Cloudinary uploads',
    fallback: 'uploads fall through to local disk',
  },
  {
    name: 'CLOUDINARY_API_KEY', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'Cloudinary uploads (key)',
    fallback: 'uploads fall through to local disk',
  },
  {
    name: 'CLOUDINARY_API_SECRET', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'Cloudinary uploads (secret)',
    fallback: 'uploads fall through to local disk',
  },
  {
    name: 'REDIS_URL', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'Redis-backed rate limit + queue',
    fallback: 'rate limit + queue fall back to in-memory store',
  },
  {
    name: 'TWILIO_ACCOUNT_SID', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'Twilio SMS',
    fallback: 'SMS notifications + MFA codes via email only',
  },
  {
    name: 'TWILIO_AUTH_TOKEN', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'Twilio SMS (token)',
    fallback: 'SMS notifications disabled',
  },
  {
    name: 'TWILIO_PHONE_NUMBER',
    aliases: ['TWILIO_PHONE', 'TWILIO_FROM_NUMBER', 'TWILIO_VERIFY_SERVICE_SID'],
    severity: SEVERITY.OPTIONAL, feature: 'Twilio SMS (from-number)',
    fallback: 'SMS verify endpoint disabled',
  },
  {
    name: 'SENDGRID_API_KEY', aliases: [],
    severity: SEVERITY.OPTIONAL, feature: 'SendGrid email',
    fallback: 'email features queue; admin notified',
  },

  // ── Observability ──────────────────────────────────────
  {
    name: 'SENTRY_DSN', aliases: ['VITE_SENTRY_DSN'],
    severity: SEVERITY.OBSERVABILITY, feature: 'Sentry runtime',
    fallback: 'Sentry init silent no-op; logs still ship via Railway',
  },
  {
    name: 'SENTRY_AUTH_TOKEN', aliases: [],
    severity: SEVERITY.OBSERVABILITY, feature: 'Sentry source-map upload',
    fallback: 'source maps not uploaded; stack traces obfuscated',
  },
  {
    name: 'SENTRY_ORG', aliases: [],
    severity: SEVERITY.OBSERVABILITY, feature: 'Sentry source-map upload (org)',
    fallback: 'source maps not uploaded',
  },
  {
    name: 'SENTRY_PROJECT', aliases: [],
    severity: SEVERITY.OBSERVABILITY, feature: 'Sentry source-map upload (project)',
    fallback: 'source maps not uploaded',
  },
  {
    name: 'RAILWAY_GIT_COMMIT_SHA',
    aliases: ['RAILWAY_DEPLOYMENT_ID', 'RENDER_GIT_COMMIT',
              'VERCEL_GIT_COMMIT_SHA', 'SOURCE_COMMIT',
              'FARROWAY_COMMIT_SHA', 'VITE_BUILD_ID',
              'BUILD_ID', 'APP_VERSION'],
    severity: SEVERITY.OBSERVABILITY, feature: '/api/health version stamp',
    fallback: '/api/health version returns "0.0.0-local"',
  },
]);

/**
 * Returns true when the canonical name OR any alias is set to a
 * non-empty string in process.env.
 *
 * @param {string} name
 * @param {Array<string>} [aliases]
 * @returns {boolean}
 */
export function isEnvVarSet(name, aliases) {
  try {
    const env = (typeof process !== 'undefined' && process.env) || {};
    if (env[name]) return true;
    if (Array.isArray(aliases)) {
      for (const a of aliases) if (env[a]) return true;
    }
    return false;
  } catch { return false; }
}

/**
 * Validate the full schema. Returns a structured report — boot
 * code decides what to log; the admin status route renders the
 * same shape as JSON.
 *
 * @returns {{
 *   ok: boolean,
 *   missingCritical: Array<{name,feature}>,
 *   missingOptional: Array<{name,feature,fallback}>,
 *   missingObservability: Array<{name,feature,fallback}>,
 *   disabledFeatures: Array<string>,
 * }}
 */
export function validateEnv() {
  const missingCritical = [];
  const missingOptional = [];
  const missingObservability = [];
  const disabledFeatures = [];
  for (const entry of ENV_SCHEMA) {
    if (isEnvVarSet(entry.name, entry.aliases)) continue;
    const lite = { name: entry.name, feature: entry.feature, fallback: entry.fallback };
    if (entry.severity === SEVERITY.CRITICAL)           missingCritical.push(lite);
    else if (entry.severity === SEVERITY.OBSERVABILITY) missingObservability.push(lite);
    else                                                missingOptional.push(lite);
    disabledFeatures.push(entry.feature);
  }
  return {
    ok: missingCritical.length === 0,
    missingCritical,
    missingOptional,
    missingObservability,
    disabledFeatures,
  };
}

/**
 * Compact human-friendly summary suitable for the admin status
 * route + the boot banner. No values, only set/unset booleans and
 * the affected feature names.
 */
export function summariseEnv() {
  const setVars = [];
  const unsetVars = [];
  for (const entry of ENV_SCHEMA) {
    const set = isEnvVarSet(entry.name, entry.aliases);
    const item = { name: entry.name, feature: entry.feature, severity: entry.severity };
    (set ? setVars : unsetVars).push(item);
  }
  return {
    totalTracked: ENV_SCHEMA.length,
    set:   setVars,
    unset: unsetVars,
  };
}

const _module = { SEVERITY, ENV_SCHEMA, validateEnv, summariseEnv, isEnvVarSet };
export default _module;
