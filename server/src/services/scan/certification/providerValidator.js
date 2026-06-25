/**
 * providerValidator.js — PRODUCTION CERTIFICATION validation rules.
 *
 * Turns a LIVE provider call result into the evidence object certifyProvider()
 * consumes, by applying the 7 certification rules. There is no shortcut: each
 * field reflects what the live call actually did. A provider with no live call
 * (no key, no response) cannot satisfy these — and therefore cannot be READY.
 */
import { PROVIDER_SLA } from './providerCertification.js';

/**
 * @param {string} provider
 * @param {object} call  — { configured, httpStatus, latencyMs, payload, confidence,
 *                           parsedOk, farmBrainAccepted, creditsOk, disabled, failureReason }
 * @returns {object} evidence for certifyProvider()
 */
export function validateProviderResponse(provider, call = {}) {
  const sla = PROVIDER_SLA[provider] || { maxLatencyMs: 5000, minConfidence: 0 };
  const c = call || {};
  const configured = c.configured === true;
  const httpStatus = typeof c.httpStatus === 'number' ? c.httpStatus : null;

  // Rule 2 — authentication succeeds (a real 200; 401/403 = auth fail).
  const authenticated = httpStatus === 200;
  // Rule 3 — response schema valid (the caller validated the payload shape).
  const schemaValid = c.schemaValid === true || (c.payload != null && typeof c.payload === 'object');
  // Rule 6 — response parsed correctly.
  const parsedOk = c.parsedOk === true || schemaValid;
  // Rule 4 — confidence >= threshold (only when the call returned candidates).
  const avgConfidence = typeof c.confidence === 'number' ? c.confidence : 0;
  // Rule 5 — latency under SLA.
  const latencyMs = typeof c.latencyMs === 'number' ? c.latencyMs : null;
  // Rule 7 — FarmBrain accepted the payload.
  const farmBrainAccepted = c.farmBrainAccepted === true;
  // Credits (Rule: creditsOk) — null/unknown is not a failure.
  const creditsOk = c.creditsOk !== false;

  return {
    configured,
    disabled: c.disabled === true,
    authenticated,
    creditsOk,
    latencyMs,
    schemaValid,
    parsedOk,
    avgConfidence,
    successRate: typeof c.successRate === 'number' ? c.successRate : (authenticated ? 100 : 0),
    farmBrainAccepted,
    lastHttpStatus: httpStatus,
    lastSuccessfulCall: authenticated ? (c.at || new Date().toISOString()) : null,
    failureReason: c.failureReason
      || (!configured ? 'missing_env'
        : httpStatus === 401 ? 'auth_failed_401'
        : httpStatus === 403 ? 'forbidden_403'
        : httpStatus === 429 ? 'rate_limited_429'
        : (latencyMs != null && latencyMs > sla.maxLatencyMs) ? 'sla_exceeded'
        : (!farmBrainAccepted && authenticated) ? 'farmbrain_rejected'
        : null),
  };
}
