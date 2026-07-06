/**
 * farmerLoadState.js — pure state logic for the admin farmer-detail loader.
 *
 * Extracted from FarmerDetailPage so the load-error classification, farmer-shape
 * validation, and diagnostic envelope are unit-testable (repo convention: pure logic,
 * node env). No React, no I/O, never throws.
 */

export const FARMER_LOAD_STATES = Object.freeze([
  'LOADED', 'NOT_FOUND', 'UNAUTHORIZED', 'SERVER_ERROR', 'NETWORK_ERROR', 'BAD_SHAPE',
]);

/** A valid farmer payload is a non-array object with an id. */
export function isFarmerShapeValid(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body) && !!body.id;
}

/**
 * classifyFarmerLoadError(status) → one of the error FARMER_LOAD_STATES.
 * status 0 (or falsy) means the request never reached the server (network/offline).
 */
export function classifyFarmerLoadError(status) {
  const s = Number(status) || 0;
  if (s === 404) return 'NOT_FOUND';
  if (s === 401 || s === 403) return 'UNAUTHORIZED';
  if (s === 0) return 'NETWORK_ERROR';
  if (s >= 500) return 'SERVER_ERROR';
  // 4xx other than the above (e.g. 400/422) is still a server-reported failure.
  return 'SERVER_ERROR';
}

/** Retry only makes sense for transient/server/network failures — not 404/permission. */
export function isRetryable(state) {
  return state === 'SERVER_ERROR' || state === 'NETWORK_ERROR' || state === 'BAD_SHAPE';
}

/** Bounded, safe stringify of a response body — never throws, caps at 500 chars. */
export function safeSnippet(v) {
  try {
    if (v == null) return null;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return String(s).slice(0, 500);
  } catch { return '[unserializable]'; }
}

/** Build the admin-exportable diagnostic envelope for a farmer load failure. */
export function buildFarmerDiagnostic({ state, farmerId, status, message, body, route, commit, at }) {
  return Object.freeze({
    schema: 'farmer-detail-error/v1',
    state: state || 'SERVER_ERROR',
    farmerId: farmerId || null,
    route: route || '',
    status: status == null ? null : status,
    message: message || null,
    body: safeSnippet(body),
    commit: commit || null,
    at: at || null,
  });
}

export default {
  FARMER_LOAD_STATES, isFarmerShapeValid, classifyFarmerLoadError,
  isRetryable, safeSnippet, buildFarmerDiagnostic,
};
