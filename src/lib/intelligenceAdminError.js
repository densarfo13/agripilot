/**
 * intelligenceAdminError.js — pure status→errorType classifier for admin intelligence
 * API calls (2026-07-05 fix).
 *
 * ROOT CAUSE this fixes: the admin API helper discarded the HTTP status and threw a bare
 * string; the hook then TEXT-MATCHED (/SESSION|401/) to guess auth, so a real 403
 * (genuine "not an admin") was mislabeled "Session expired". This maps by STATUS, so
 * 401 (expired session) and 403 (access denied) are distinct — the spec's P0 requirement.
 * No React, no I/O, never throws.
 */

export const ADMIN_ERROR_TYPES = Object.freeze([
  'SESSION_EXPIRED', 'ACCESS_DENIED', 'NETWORK_ERROR', 'API_ERROR',
]);

/**
 * classifyAdminApiError(status) → errorType.
 * status 0 / falsy = the request never reached the server (offline / DNS / CORS).
 */
export function classifyAdminApiError(status) {
  const s = Number(status) || 0;
  if (s === 401) return 'SESSION_EXPIRED'; // authenticated identity gone → sign in again
  if (s === 403) return 'ACCESS_DENIED';   // valid session, insufficient role → NOT "expired"
  if (s === 0) return 'NETWORK_ERROR';
  return 'API_ERROR';
}

export const ADMIN_ERROR_COPY = Object.freeze({
  SESSION_EXPIRED: { title: 'Session expired', body: 'Please sign in again to continue.' },
  ACCESS_DENIED:   { title: 'Access denied', body: 'Your account does not have permission to view this. Ask a super admin to grant access.' },
  NETWORK_ERROR:   { title: 'No connection', body: 'Check your internet connection and retry.' },
  API_ERROR:       { title: "Couldn't load this data", body: 'Something went wrong. Please retry in a moment.' },
});

/** Retry makes sense for transient failures, not for session/permission problems. */
export function isAdminErrorRetryable(errorType) {
  return errorType === 'NETWORK_ERROR' || errorType === 'API_ERROR';
}

export default { ADMIN_ERROR_TYPES, classifyAdminApiError, ADMIN_ERROR_COPY, isAdminErrorRetryable };
