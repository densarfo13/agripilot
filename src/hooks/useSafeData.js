/**
 * useSafeData — defensive data hook for every admin /
 * dashboard surface.
 *
 *   const {
 *     data, loading, error, errorType, retry, isEmpty,
 *   } = useSafeData(fetcher, options);
 *
 * Spec contract
 * ─────────────
 *   * NEVER throws into render. Every error from the fetcher
 *     is caught and surfaced via state.
 *   * `errorType` is one of the v3 API_ERROR_TYPES strings:
 *       SESSION_EXPIRED  — user must re-auth
 *       MFA_REQUIRED     — second factor needed
 *       NETWORK_ERROR    — couldn't reach the server
 *       API_ERROR        — anything else (4xx/5xx)
 *       null             — no error
 *   * `isEmpty` is true when data is a non-loading, non-error
 *     EMPTY array. Pages should render an empty-state, not
 *     an error, in that case (per spec §2).
 *   * `fallbackData` is returned as `data` until the first
 *     successful fetch resolves. After a failure, `data`
 *     keeps the most recent successful value so a transient
 *     blip doesn't blank a populated table.
 *   * `retry()` is a stable callback that re-runs the
 *     fetcher.
 *
 * Accepts either:
 *   * A fetcher returning `apiClient.get(...).then(...)`-style
 *     payloads — in which case errors are already structured
 *     by `apiClient`.
 *   * A fetcher using the legacy axios `client.js` — in which
 *     case raw errors are run through `structureError()` here.
 *
 * Design note
 * ───────────
 *   The earlier `useAdminData` shipped the same lifecycle
 *   under a different name. It now re-exports from this file
 *   so callers can keep importing either name during the
 *   migration window.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { structureError, API_ERROR_TYPES } from '../api/apiClient.js';

export { API_ERROR_TYPES };

/**
 * Normalise whatever the catch handler received into our
 * structured shape. Already-structured errors (those carrying
 * `__farroway: true`) pass through untouched.
 */
function _normaliseErr(err) {
  if (err && err.__farroway) return err;
  return structureError(err);
}

export default function useSafeData(fetcher, options = {}) {
  const {
    fallbackData,
    fallback,                  // legacy alias
    deps      = [],
    transform = null,
    enabled   = true,
  } = options;

  const initial = fallbackData !== undefined ? fallbackData : fallback;

  const [data,    setData]    = useState(initial);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error,   setError]   = useState(null);   // structured

  // Keep the latest fetcher in a ref so `retry` is stable
  // even when the caller passes an inline arrow function on
  // every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Bumping `tick` triggers a re-fetch via the effect below.
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
        throw new Error('useSafeData: fetcher must be a function');
      }
      const raw = await fn();
      const next = typeof transform === 'function' ? transform(raw) : raw;
      setData(next === undefined ? initial : next);
    } catch (err) {
      // Never re-throw. Classify and surface via state so the
      // page renders a notice rather than crashing.
      setError(_normaliseErr(err));
      // Leave existing `data` in place if it's already populated;
      // only fall back to `initial` when we never had a value.
      if (data === undefined || data === null) setData(initial);
    } finally {
      setLoading(false);
    }
    // `data` deliberately omitted — the function only
    // FETCHES; it doesn't read state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, transform]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, enabled, ...deps]);

  const retry = useCallback(() => setTick((n) => n + 1), []);

  // Empty-state detection — only meaningful for array data.
  // Object payloads need their own emptiness rule and the
  // page handles that itself.
  const isEmpty = !loading && !error
    && Array.isArray(data) && data.length === 0;

  return {
    data,
    loading,
    error:     error ? error.message : null,
    errorType: error ? error.errorType : null,
    retry,
    isEmpty,
    // Raw structured object for callers that need code/status.
    _error:    error,
  };
}
