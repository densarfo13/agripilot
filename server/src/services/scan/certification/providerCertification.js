/**
 * providerCertification.js — PRODUCTION CERTIFICATION (live runtime evidence).
 *
 * The ProviderCertification shape + the SLA/threshold constants + an HONEST
 * factory. Server-side because certification makes keyed provider calls (a
 * browser cert would leak the key).
 *
 * Hard rule (the whole point): a provider is READY only from LIVE evidence — a
 * successful authenticated call with a valid, parsed payload under SLA that
 * FarmBrain accepted. Key-present alone is NEVER READY. We never fabricate
 * confidence, never hardcode READY, never infer readiness from env vars.
 */

/** The exact certification states (CERTIFICATION RUNTIME TRUTH). */
export const CERT_STATUS = Object.freeze({
  NOT_RUN: 'NOT_RUN',
  LOCAL_SECRETS_UNAVAILABLE: 'LOCAL_SECRETS_UNAVAILABLE',  // can't see secrets here ≠ keys missing
  NOT_CONFIGURED: 'NOT_CONFIGURED',                        // keys genuinely missing (only valid on Railway)
  AUTH_FAILED: 'AUTH_FAILED',
  CREDITS_EXHAUSTED: 'CREDITS_EXHAUSTED',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  FARMBRAIN_REJECTED: 'FARMBRAIN_REJECTED',
  READY: 'READY',
  DEGRADED: 'DEGRADED',
  DISABLED: 'DISABLED',
});

/** Per-provider expected env names (canonical first). */
export const PROVIDER_ENV = Object.freeze({
  'plant.id':     ['PLANT_ID_API_KEY', 'PLANT_API_KEY'],
  'crop.health':  ['CROP_HEALTH_API_KEY', 'CROP_ID_API_KEY'],
  'insect.id':    ['INSECT_ID_API_KEY'],
  'mushroom.id':  ['MUSHROOM_ID_API_KEY'],
  'soil':         ['AMBEE_API_KEY'],
  'weather':      ['WEATHER_API_KEY'],   // or a configured public weather provider
  'sentinel_hub': ['SENTINEL_HUB_API_KEY'],
});

/** Read a provider's key by length + fingerprint ONLY (never the full value). */
export function checkProviderKey(provider) {
  const names = PROVIDER_ENV[provider] || [];
  for (const n of names) {
    let v = '';
    try { v = (process.env[n] || '').trim(); } catch { v = ''; }
    if (v) return { envNameUsed: n, keyPresent: true, keyLength: v.length, fingerprintFirst6: v.slice(0, 6) };
  }
  return { envNameUsed: null, keyPresent: false, keyLength: 0, fingerprintFirst6: null };
}

/** Per-provider SLA latency ceilings (ms) + min confidence + required/optional. */
export const PROVIDER_SLA = Object.freeze({
  'plant.id':     { maxLatencyMs: 4000, minConfidence: 0,  required: true,  apiVersion: 'v3' },
  'crop.health':  { maxLatencyMs: 5000, minConfidence: 0,  required: true,  apiVersion: 'v1' },
  'insect.id':    { maxLatencyMs: 4000, minConfidence: 0,  required: true,  apiVersion: 'v1' },
  'mushroom.id':  { maxLatencyMs: 5000, minConfidence: 0,  required: false, apiVersion: 'v1' },
  'weather':      { maxLatencyMs: 1000, minConfidence: 0,  required: true,  apiVersion: 'v1' },
  'soil':         { maxLatencyMs: 2000, minConfidence: 0,  required: true,  apiVersion: 'v1' },
  // Sentinel Hub — OPTIONAL: it must NEVER reduce production certification.
  'sentinel_hub': { maxLatencyMs: 8000, minConfidence: 0,  required: false, apiVersion: 'n/a' },
});

export const REQUIRED_PROVIDERS = Object.freeze(
  Object.entries(PROVIDER_SLA).filter(([, v]) => v.required).map(([k]) => k));
export const OPTIONAL_PROVIDERS = Object.freeze(
  Object.entries(PROVIDER_SLA).filter(([, v]) => !v.required).map(([k]) => k));

function _env() {
  try { return (process.env.NODE_ENV || 'development'); } catch { return 'unknown'; }
}
function _buildSha() {
  try { return (process.env.BUILD_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'); } catch { return 'unknown'; }
}

/**
 * Build a ProviderCertification from LIVE evidence only. `live` carries the real
 * call result; absent/failed live evidence cannot yield READY.
 * @returns {Readonly<object>}
 */
export function certifyProvider(provider, evidence = {}) {
  const sla = PROVIDER_SLA[provider] || { maxLatencyMs: 5000, minConfidence: 0, required: false, apiVersion: 'n/a' };
  const e = evidence || {};
  const configured = e.configured === true;
  const disabled = e.disabled === true;            // e.g. Sentinel/pollen not wired
  const authenticated = e.authenticated === true;  // a real 200 from an auth-checking call
  const creditsOk = e.creditsOk !== false;         // null/unknown treated as ok (not a fail)
  const latencyMs = typeof e.latencyMs === 'number' ? e.latencyMs : null;
  const successRate = typeof e.successRate === 'number' ? e.successRate : 0;
  const avgConfidence = typeof e.avgConfidence === 'number' ? e.avgConfidence : 0;
  const schemaValid = e.schemaValid === true;
  const parsedOk = e.parsedOk === true;
  const farmBrainAccepted = e.farmBrainAccepted === true;
  const underSla = latencyMs == null ? false : latencyMs <= sla.maxLatencyMs;

  // ── Status — strictly from evidence, with the exact CERTIFICATION states. ──
  const s = e.lastHttpStatus;
  const fr = String(e.failureReason || '').toLowerCase();
  let status;
  if (disabled) status = CERT_STATUS.DISABLED;
  // CRITICAL honesty: "I can't see the secrets here" is NOT "keys are missing".
  else if (e.localSecretsUnavailable === true) status = CERT_STATUS.LOCAL_SECRETS_UNAVAILABLE;
  else if (!configured) status = CERT_STATUS.NOT_CONFIGURED;   // genuinely missing (only on Railway)
  else if (
    authenticated && schemaValid && parsedOk && farmBrainAccepted && underSla &&
    avgConfidence >= sla.minConfidence && creditsOk
  ) status = CERT_STATUS.READY;
  else if (s === 401 || s === 403) status = CERT_STATUS.AUTH_FAILED;
  else if (s === 402 || creditsOk === false || /credit|quota|insufficient/.test(fr)) status = CERT_STATUS.CREDITS_EXHAUSTED;
  else if (s === 429 || /rate.?limit/.test(fr)) status = CERT_STATUS.RATE_LIMITED;
  else if (/timeout/.test(fr)) status = CERT_STATUS.TIMEOUT;
  // SCHEMA_INVALID must mean a response we ACTUALLY received then failed to
  // validate — NOT "no live call was made". A configured, keyed provider with no
  // response yet (authenticated false AND no http status) is not "broken schema";
  // it falls through to DEGRADED ("keyed, awaiting a proven live call"). Without
  // this guard, certifying an absent response (schemaValid:false) falsely reports
  // every provider as SCHEMA_INVALID — a fabricated failure that violates the
  // no-fabrication doctrine.
  else if (/schema|parse|map/.test(fr) || ((authenticated || s != null) && (schemaValid === false || parsedOk === false)))
    status = CERT_STATUS.SCHEMA_INVALID;
  else if (authenticated && farmBrainAccepted === false) status = CERT_STATUS.FARMBRAIN_REJECTED;
  else status = CERT_STATUS.DEGRADED;   // keyed but not yet PROVEN by a live call

  return Object.freeze({
    provider,
    status,
    configured,
    authenticated,
    creditsOk,
    latencyMs: latencyMs == null ? -1 : latencyMs,
    lastSuccessfulCall: e.lastSuccessfulCall || null,
    successRate,
    avgConfidence,
    buildVersion: _buildSha(),
    apiVersion: sla.apiVersion,
    environment: _env(),
    // diagnostics (not in the farmer-facing shape; useful for the scorecard)
    required: sla.required,
    failureReason: e.failureReason || null,
    underSla,
  });
}
