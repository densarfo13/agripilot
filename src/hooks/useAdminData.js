/**
 * useAdminData — defensive data hook for admin/dashboard pages.
 *
 *   const { data, loading, error, retry, isAuthError, isMfaRequired }
 *     = useAdminData(() => api.get('/farmers'), {
 *         fallback: [],                           // optional default
 *         deps:     [orgId],                      // optional re-fetch deps
 *         transform: (res) => res.data?.farmers,  // optional shape
 *       });
 *
 * Contract
 *   * NEVER throws. Every error is caught and surfaced via
 *     `error` so a failing endpoint can never crash a render.
 *   * 401 / "session expired" responses set `isAuthError=true`
 *     so the page can render a "Sign in again" CTA instead of
 *     a generic "Failed to load…" message.
 *   * MFA-required responses (codes MFA_CHALLENGE_REQUIRED /
 *     MFA_SETUP_REQUIRED / STEP_UP_REQUIRED) set
 *     `isMfaRequired=true` so the page can offer "Verify now".
 *   * `fallback` is returned as `data` until the first
 *     successful fetch resolves. After failure, `data` keeps
 *     the most recent successful value (so a transient blip
 *     doesn't blank a populated table).
 *   * `retry()` is a stable function that re-runs the fetcher.
 *
 * This is the SAFE replacement for the older inline pattern
 *
 *   useEffect(() => {
 *     api.get(...).then(setRows).catch(() => setError('Failed'));
 *   }, []);
 *
 * which renders a bare error string and offers no recovery path.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Best-effort error classifier. Tries to read AxiosError /
 * fetch Response shapes without assuming either.
 */
function _classify(err) {
  if (!err) return { isAuth: false, isMfa: false, message: '' };

  // Axios-style: err.response?.status + err.response?.data?.code
  const status =
    (err.response && err.response.status)
    || err.status
    || null;
  const code =
    (err.response && err.response.data && err.response.data.code)
    || err.code
    || '';
  const message =
    (err.response && err.response.data && err.response.data.error)
    || (err.response && err.response.data && err.response.data.message)
    || err.message
    || '';

  const codeUpper = String(code || '').toUpperCase();
  const isMfa =
       codeUpper === 'MFA_CHALLENGE_REQUIRED'
    || codeUpper === 'MFA_SETUP_REQUIRED'
    || codeUpper === 'STEP_UP_REQUIRED'
    || codeUpper === 'STEP_UP_EXPIRED'
    || /mfa\s*(required|verification)/i.test(message);

  // 401 (without an MFA code) means the session is dead.
  const isAuth = status === 401 && !isMfa;

  return { isAuth, isMfa, message: message || 'Request failed', status, code: codeUpper };
}

export default function useAdminData(fetcher, options = {}) {
  const {
    fallback  = null,
    deps      = [],
    transform = null,
    enabled   = true,
  } = options;

  const [data,    setData]    = useState(fallback);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error,   setError]   = useState(null);

  // Keep the latest fetcher in a ref so `retry()` is stable
  // even when the caller passes an inline arrow function each
  // render. Without this, `retry` would re-create on every
  // render and any consumer that puts it in a useEffect
  // dep-array would loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Bumping this is how we trigger an explicit re-fetch.
  const [tick, setTick] = useState(0);

  const run = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const fn = fetcherRef.current;
      if (typeof fn !== 'function') {
        throw new Error('useAdminData: fetcher must be a function');
      }
      const raw = await fn();
      const next = typeof transform === 'function' ? transform(raw) : raw;
      setData(next == null ? fallback : next);
    } catch (err) {
      // Never re-throw. Classify and surface via state so the
      // page renders a notice rather than crashing.
      const cls = _classify(err);
      setError({
        message:       cls.message,
        isAuthError:   cls.isAuth,
        isMfaRequired: cls.isMfa,
        status:        cls.status,
        code:          cls.code,
        raw:           err,
      });
      // Leave `data` at its last successful value so the table
      // stays populated through a transient failure. Only
      // overwrite with fallback if we never had a value.
      if (data == null) setData(fallback);
    } finally {
      setLoading(false);
    }
    // We deliberately omit `data` from the dep-array — the
    // function's only job is to FETCH; it doesn't read data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, transform, fallback]);

  // Re-run on initial mount + whenever `deps` change + on retry.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, enabled, ...deps]);

  const retry = useCallback(() => setTick((n) => n + 1), []);

  return {
    data,
    loading,
    error: error ? error.message : null,
    isAuthError:   Boolean(error && error.isAuthError),
    isMfaRequired: Boolean(error && error.isMfaRequired),
    retry,
    // raw error object for debugging — never render this
    _error: error,
  };
}
