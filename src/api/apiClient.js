/**
 * apiClient.js — central HTTP entry point for the v3
 * production-stability layer.
 *
 *   import apiClient from '../api/apiClient.js';
 *   const farmers = await apiClient.get('/farmers');
 *
 * Why this file exists alongside `client.js`
 * ──────────────────────────────────────────
 *   `client.js` is the long-lived axios instance that owns
 *   the cross-cutting concerns: bearer-token attach, V2
 *   cookie refresh on 401, MFA-aware retry queue, request-id
 *   plumbing, network retry. It already does the right thing
 *   for the AUTH lifecycle.
 *
 *   `apiClient.js` (this file) is a thin wrapper on top that
 *   exposes the SPEC's contract for components:
 *     * structured errors with explicit `errorType` strings
 *       (`SESSION_EXPIRED`, `MFA_REQUIRED`, `NETWORK_ERROR`,
 *        `API_ERROR`)
 *     * a normalised `.data` payload — callers don't unwrap
 *       axios responses
 *     * never throws raw backend errors into the React
 *       render path. The thrown shape is always
 *         { errorType, status, code, message, raw }
 *     * fallback bearer-token attach from localStorage if the
 *       auth store hasn't hydrated yet (covers the first
 *       request after a hard reload, before the store
 *       rehydrates from cookie / token storage).
 *
 * Strict-rule audit
 *   * No new auth behaviour — 401 / refresh / step-up / MFA
 *     handling is OWNED by `client.js`. This wrapper only
 *     classifies errors AFTER `client.js` is done with them.
 *   * Backwards-compatible — the existing `client.js`
 *     default export is untouched. Pages that already
 *     `import api from '../api/client.js'` keep working.
 *     New code should prefer `apiClient`.
 */

import api from './client.js';
import { useAuthStore } from '../store/authStore.js';

// ─── Error type taxonomy ───────────────────────────────────
export const API_ERROR_TYPES = Object.freeze({
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  MFA_REQUIRED:    'MFA_REQUIRED',
  NETWORK_ERROR:   'NETWORK_ERROR',
  API_ERROR:       'API_ERROR',
});

/**
 * Read a bearer token from any of the places we might have
 * stashed it. Used as a fallback when the in-memory auth
 * store hasn't hydrated yet (first request after a hard
 * reload). The axios interceptor in `client.js` already
 * attaches from the auth store; this only fills in the gap.
 */
function _bearerFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return (
         localStorage.getItem('farroway_token')
      || localStorage.getItem('farroway_access_token')
      || localStorage.getItem('access_token')
      || null
    );
  } catch {
    return null;
  }
}

/**
 * Best-effort bearer attach. Runs as an axios `transformRequest`
 * style hook just before each apiClient call so the auth
 * store can win when it has a token, and storage fills in
 * otherwise. The underlying `api` interceptor remains
 * authoritative — this is belt-and-braces for the very first
 * request after page reload.
 */
function _withBearer(config = {}) {
  // Only fill in when neither an explicit Authorization nor a
  // store-supplied bearer is already on the request. Avoids
  // overwriting per-call overrides.
  const headers = { ...(config.headers || {}) };
  if (!headers.Authorization && !headers.authorization) {
    const storeToken = (() => {
      try { return useAuthStore.getState().token || null; }
      catch { return null; }
    })();
    const t = storeToken || _bearerFromStorage();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  return { ...config, headers };
}

/**
 * Map an axios error onto our structured shape. Never throws.
 *
 *   { errorType, status, code, message, raw }
 *
 *   errorType:
 *     SESSION_EXPIRED  — 401 (after refresh attempt failed)
 *     MFA_REQUIRED     — code MFA_CHALLENGE_REQUIRED /
 *                        MFA_SETUP_REQUIRED /
 *                        STEP_UP_REQUIRED /
 *                        STEP_UP_EXPIRED
 *     NETWORK_ERROR    — request never reached the server
 *                        (offline, DNS, CORS, CSP, etc.)
 *     API_ERROR        — anything else (4xx/5xx with a payload)
 */
function _structureError(err) {
  if (!err) {
    return {
      errorType: API_ERROR_TYPES.API_ERROR,
      status: null, code: '', message: 'Unknown error', raw: null,
    };
  }

  const status   = (err.response && err.response.status) || err.status || null;
  const data     = (err.response && err.response.data) || {};
  const code     = String(data.code || err.code || '').toUpperCase();
  const message  = data.error || data.message || err.message || 'Request failed';

  // 1. Network failure — no response at all. `client.js`
  //    tags this as `error.isNetworkError`.
  if (err.isNetworkError || (!err.response && err.message)) {
    return {
      errorType: API_ERROR_TYPES.NETWORK_ERROR,
      status: null, code: 'NETWORK', message, raw: err,
    };
  }

  // 2. MFA / step-up — server is asking the user to verify a
  //    second factor. NEVER treated as a session-expiry; the
  //    user is still authenticated, just under-privileged for
  //    this specific endpoint.
  const isMfa =
       code === 'MFA_CHALLENGE_REQUIRED'
    || code === 'MFA_SETUP_REQUIRED'
    || code === 'STEP_UP_REQUIRED'
    || code === 'STEP_UP_EXPIRED'
    || /mfa\s*(required|verification)/i.test(message);
  if (isMfa) {
    return {
      errorType: API_ERROR_TYPES.MFA_REQUIRED,
      status, code, message, raw: err,
    };
  }

  // 3. 401 → session expired. By the time the response gets
  //    here, the axios interceptor in client.js has already
  //    tried (and failed) a V2 cookie refresh.
  if (status === 401) {
    return {
      errorType: API_ERROR_TYPES.SESSION_EXPIRED,
      status, code, message, raw: err,
    };
  }

  // 4. Everything else — generic API failure (404, 500, etc).
  return {
    errorType: API_ERROR_TYPES.API_ERROR,
    status, code, message, raw: err,
  };
}

/**
 * Run an axios request and either return its `.data` payload
 * (success) or throw our structured error shape (failure).
 *
 * Throws ALWAYS the same shape — components can switch on
 * `err.errorType` without sniffing axios internals.
 */
async function _run(method, url, body, config = {}) {
  const cfg = _withBearer(config);
  try {
    let res;
    if (method === 'get' || method === 'delete') {
      res = await api[method](url, cfg);
    } else {
      res = await api[method](url, body, cfg);
    }
    // Always return the .data payload — callers don't unwrap.
    return res && res.data !== undefined ? res.data : res;
  } catch (err) {
    // Structured error throw. `useSafeData` and `AdminState`
    // know this shape; any direct caller can switch on it.
    const structured = _structureError(err);
    // Stash a flag so we don't need brand-detection
    // elsewhere — `err.__farroway === true` means the error
    // came through this wrapper.
    structured.__farroway = true;
    throw structured;
  }
}

// ─── Public API ────────────────────────────────────────────
const apiClient = Object.freeze({
  get:    (url, config)        => _run('get',    url, null, config),
  delete: (url, config)        => _run('delete', url, null, config),
  post:   (url, body, config)  => _run('post',   url, body, config),
  put:    (url, body, config)  => _run('put',    url, body, config),
  patch:  (url, body, config)  => _run('patch',  url, body, config),

  // Re-export classifier for callers that already have an
  // axios error in hand (e.g. legacy pages still using
  // `client.js` directly).
  structureError: _structureError,
});

export default apiClient;
export { _structureError as structureError };
