/**
 * validateEnvironment.js — startup-time environment validator.
 *
 *   const result = validateEnvironment();
 *   if (!result.ok) {
 *     console.error('[FARROWAY_ENV] startup validation failed', result.diagnostics);
 *   }
 *
 * Why a named validator
 * ─────────────────────
 *   The spec §7 calls for a single named entry point that runs at
 *   boot and produces a structured diagnostic. Currently the codebase
 *   has scattered env reads (assertApiBaseUrl.js validates the API
 *   base; intelligenceFlags reads VITE_FEATURE_*). This module is
 *   the single pass.
 *
 *   Returns a structured outcome — never throws — so the boot path
 *   can log diagnostics, surface a calm error, or continue with
 *   reduced capability when non-critical env is missing.
 *
 * Validation tiers
 * ────────────────
 *   • REQUIRED    — missing → result.ok = false. The app can boot
 *                    but operates degraded (e.g. no API → no auth).
 *                    Currently no env is in this tier by default;
 *                    callers can add their own via `options.required`.
 *   • RECOMMENDED — missing → result.ok = true, but the diagnostic
 *                    notes it. Soil / weather / FCM credentials sit
 *                    here — the app gracefully falls back without
 *                    them.
 *   • OPTIONAL    — missing → no diagnostic noise. Useful for
 *                    operator-controlled toggles.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • SSR-safe (import.meta.env read is guarded).
 *   • Output is frozen + structured for downstream telemetry.
 *   • Missing/unset env vars are normalised to absent — empty
 *     strings, whitespace, and the literal string "undefined"
 *     all count as missing.
 */

// ─── Default validation schema ────────────────────────────────

const _DEFAULT_RECOMMENDED = Object.freeze([
  { key: 'VITE_API_BASE_URL',           kind: 'url' },
  { key: 'VITE_FCM_VAPID_PUBLIC_KEY',   kind: 'string' },
  { key: 'VITE_FCM_PROJECT_ID',         kind: 'string' },
  { key: 'VITE_FCM_API_KEY',            kind: 'string' },
  { key: 'VITE_FCM_APP_ID',             kind: 'string' },
  { key: 'VITE_FCM_MESSAGING_SENDER_ID', kind: 'string' },
]);

const _DEFAULT_OPTIONAL = Object.freeze([
  // Intelligence flags — defaults handled by intelligenceFlags.js
  { key: 'VITE_FEATURE_SOIL_CONTEXT',      kind: 'boolean' },
  { key: 'VITE_FEATURE_SATELLITE_CONTEXT', kind: 'boolean' },
  { key: 'VITE_FEATURE_SCAN_MEMORY',       kind: 'boolean' },
  { key: 'VITE_FEATURE_SIMPLE_MODE',       kind: 'boolean' },
  { key: 'VITE_FEATURE_PREDICTIVE_ALERTS', kind: 'boolean' },
]);

// ─── Helpers ──────────────────────────────────────────────────

function _readEnv(key, env) {
  try {
    const src = env || (typeof import.meta !== 'undefined' && import.meta.env)
              || (typeof process !== 'undefined' && process.env)
              || {};
    const raw = src[key];
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    if (!s || s.toLowerCase() === 'undefined') return null;
    return s;
  } catch { return null; }
}

function _isValidUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const trimmed = value.trim();
  // Allow: '' (empty → same-origin), '/path' (relative), 'https?://'
  if (trimmed === '') return true;
  if (trimmed.startsWith('/')) return true;
  return /^https?:\/\//i.test(trimmed);
}

function _isValidBoolean(value) {
  if (value == null) return true;   // absent is allowed for OPTIONAL
  const s = String(value).toLowerCase().trim();
  return ['true', 'false', '1', '0', 'on', 'off'].includes(s);
}

function _validateEntry(entry, env) {
  const value = _readEnv(entry.key, env);
  const present = value !== null;

  if (!present) {
    return { key: entry.key, present: false, valid: true, value: null, reason: null };
  }

  let valid = true;
  let reason = null;
  if (entry.kind === 'url' && !_isValidUrl(value)) {
    valid = false; reason = 'invalid_url';
  }
  if (entry.kind === 'boolean' && !_isValidBoolean(value)) {
    valid = false; reason = 'invalid_boolean';
  }

  return { key: entry.key, present, valid, value: valid ? value : null, reason };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Run the startup environment validation.
 *
 * @param {object} [options]
 * @param {Array<{ key: string, kind: 'string'|'url'|'boolean' }>} [options.required]
 *                                — additional required env keys
 * @param {Array}  [options.recommended]
 * @param {Array}  [options.optional]
 * @param {object} [options.env]  — override the env source (tests)
 * @returns {{
 *   ok: boolean,
 *   diagnostics: {
 *     missingRequired:    Array<{ key, reason }>,
 *     missingRecommended: Array<string>,
 *     invalidEntries:     Array<{ key, reason }>,
 *     present:            Array<string>,
 *   },
 * }}
 */
export function validateEnvironment(options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const required   = Array.isArray(opts.required)    ? opts.required    : [];
  const recommended = Array.isArray(opts.recommended) ? opts.recommended : _DEFAULT_RECOMMENDED;
  const optional    = Array.isArray(opts.optional)    ? opts.optional    : _DEFAULT_OPTIONAL;
  const env = opts.env;

  const missingRequired    = [];
  const missingRecommended = [];
  const invalidEntries     = [];
  const present            = [];

  for (const entry of required) {
    const r = _validateEntry(entry, env);
    if (!r.present)    missingRequired.push({ key: entry.key, reason: 'missing' });
    else if (!r.valid) invalidEntries.push({ key: entry.key, reason: r.reason });
    else               present.push(entry.key);
  }

  for (const entry of recommended) {
    const r = _validateEntry(entry, env);
    if (!r.present)    missingRecommended.push(entry.key);
    else if (!r.valid) invalidEntries.push({ key: entry.key, reason: r.reason });
    else               present.push(entry.key);
  }

  for (const entry of optional) {
    const r = _validateEntry(entry, env);
    if (r.present && !r.valid) invalidEntries.push({ key: entry.key, reason: r.reason });
    else if (r.present) present.push(entry.key);
  }

  // Spec rule: "Fail gracefully with diagnostics." ok=true unless
  // explicit required-tier env is missing. Recommended-tier absence
  // does NOT fail the boot — it's reported but the app continues.
  const ok = missingRequired.length === 0 && invalidEntries.length === 0;

  return Object.freeze({
    ok,
    diagnostics: Object.freeze({
      missingRequired:    Object.freeze(missingRequired),
      missingRecommended: Object.freeze(missingRecommended),
      invalidEntries:     Object.freeze(invalidEntries),
      present:            Object.freeze(present),
    }),
  });
}

/**
 * Read-only access to the default schema. Useful for ops checklists.
 */
export function getDefaultEnvSchema() {
  return Object.freeze({
    recommended: _DEFAULT_RECOMMENDED.map((e) => ({ ...e })),
    optional:    _DEFAULT_OPTIONAL.map((e) => ({ ...e })),
  });
}

export default { validateEnvironment, getDefaultEnvSchema };
