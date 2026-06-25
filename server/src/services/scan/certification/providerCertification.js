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

/** @typedef {'NOT_CONFIGURED'|'READY'|'DEGRADED'|'FAILED'|'DISABLED'} CertStatus */

export const CERT_STATUS = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  READY: 'READY',
  DEGRADED: 'DEGRADED',
  FAILED: 'FAILED',
  DISABLED: 'DISABLED',
});

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

  // ── Status — strictly from evidence. ──
  let status;
  if (disabled) status = CERT_STATUS.DISABLED;
  else if (!configured) status = CERT_STATUS.NOT_CONFIGURED;
  else if (
    authenticated && schemaValid && parsedOk && farmBrainAccepted && underSla &&
    avgConfidence >= sla.minConfidence && creditsOk
  ) status = CERT_STATUS.READY;
  else if (e.lastHttpStatus === 401 || e.lastHttpStatus === 403 || e.creditsOk === false ||
    (e.lastHttpStatus != null && e.lastHttpStatus >= 400))
    status = CERT_STATUS.FAILED;        // a REAL failure: auth rejected / credits / http error
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
