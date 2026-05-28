/**
 * useApiResource.js — RUNTIME hook for ad-hoc resource fetches.
 *
 *   const { data, loading, error, refresh } = useApiResource({
 *     path:        '/auto-notifications/stats',
 *     params:      { from: '2026-05-01' },
 *     enabled:     true,
 *     dependencies: [],
 *   });
 *
 * What this is
 * ────────────
 *   The generic RUNTIME-governed data fetcher for pages that don't
 *   yet have a domain-specific runtime hook (admin tools, one-off
 *   dashboards, exploratory views). It owns the same primitives
 *   the domain hooks own — fetch lifecycle, loading flag, error
 *   state, request cancellation via monotonic id, retry-on-
 *   transient — but is parametrized by endpoint instead of bound
 *   to a domain.
 *
 *   Pages that have a custom domain hook (`useFarmerNotifications-
 *   Runtime`, etc.) should use that instead. This hook exists so
 *   newly-migrated pages can get runtime governance for free even
 *   before their domain hook is written.
 *
 * Retry contract
 *   • GET: ONE retry on TIMEOUT or 5xx (1.2 s back-off).
 *   • POST/PUT/PATCH/DELETE: NOT supported via this hook (use the
 *     domain hook or call api.* directly inside a domain runtime).
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Returns a stable bag per render (useMemo).
 *   • Late responses are discarded when superseded by a fresh fetch.
 *   • RUNTIME → RUNTIME (apiRuntime facade — allowed).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../runtime/apiRuntime.js';

const RUNTIME_VERSION = 'api-resource-v1';
const GET_RETRY_DELAY_MS = 1200;

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Per-hook-instance telemetry counters aren't useful here; the
// gateway interceptor already counts every outbound request.

function _isTransient(err) {
  return _safe(() => {
    if (!err) return false;
    if (!err.response && err.code !== 'ERR_CANCELED') return true;
    const status = err.response && err.response.status;
    return status >= 500 && status < 600;
  }, false);
}

function _sleep(ms) {
  return new Promise((res) => { setTimeout(res, ms); });
}

async function _getWithRetry(path, axiosOpts) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await api.get(path, axiosOpts);
      return Object.freeze({ ok: true, data: res.data, attempts: attempt + 1 });
    } catch (err) {
      lastErr = err;
      if (!_isTransient(err) || attempt === 1) break;
      await _sleep(GET_RETRY_DELAY_MS);
    }
  }
  return Object.freeze({
    ok: false, data: null, error: lastErr, attempts: 2,
  });
}

/**
 * Read a JSON resource via the RUNTIME-governed gateway.
 *
 *   @param {{
 *     path: string,
 *     params?: object,
 *     enabled?: boolean,
 *     dependencies?: any[],
 *   }} opts
 */
export function useApiResource(opts) {
  const path         = opts && opts.path;
  const params       = opts && opts.params;
  const enabled      = !opts || opts.enabled !== false;
  const dependencies = (opts && opts.dependencies) || [];

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const _reqIdRef = useRef(0);
  const _mountedRef = useRef(true);
  useEffect(() => () => { _mountedRef.current = false; }, []);

  // Stable JSON-ish key over params so dependency arrays don't churn.
  const _paramsKey = useMemo(() => {
    if (!params || typeof params !== 'object') return '';
    return _safe(() => JSON.stringify(params), '');
  }, [params]);

  const refresh = useCallback(async () => {
    if (!enabled || !path) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    _reqIdRef.current += 1;
    const myReqId = _reqIdRef.current;
    setLoading(true);
    setError(null);
    const axiosOpts = params ? { params } : undefined;
    const res = await _getWithRetry(path, axiosOpts);
    if (!_mountedRef.current) return;
    if (myReqId !== _reqIdRef.current) return; // stale
    if (res && res.ok) {
      setData(res.data);
    } else {
      setError(res && res.error ? res.error : new Error('fetch_failed'));
    }
    setLoading(false);
    // disabling exhaustive-deps: the consumer's `dependencies` array
    // is the canonical re-fetch signal; params and path travel via
    // closure capture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, path, _paramsKey, ...dependencies]);

  useEffect(() => { refresh(); }, [refresh]);

  return useMemo(() => ({
    data,
    loading,
    error,
    refresh,
    runtimeVersion: RUNTIME_VERSION,
  }), [data, loading, error, refresh]);
}

const _module = { useApiResource };
export default _module;
