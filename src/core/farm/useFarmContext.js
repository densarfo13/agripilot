/**
 * useFarmContext — React hook wrapping the farm-context client.
 *
 *   const { status, data, error, refetch } = useFarmContext(farmId);
 *
 * States:
 *   'idle'    — no farmId yet
 *   'loading' — first fetch in flight
 *   'ready'   — data available
 *   'error'   — fetch failed; `error` is a stable string id
 *
 * Auto-refetches when `farmId` changes. Request is aborted on
 * unmount / farmId change so late responses don't overwrite
 * fresh state.
 */

import { useEffect, useReducer, useCallback, useRef } from 'react';
import {
  INITIAL_CONTEXT_STATE,
  contextStateReducer,
  runFarmContextFetch,
} from './farmContextClient.js';

export function useFarmContext(farmId, opts = {}) {
  const [state, dispatch] = useReducer(contextStateReducer, INITIAL_CONTEXT_STATE);
  const abortRef = useRef(null);

  const doFetch = useCallback(async (id) => {
    // Abort any prior request so a stale response can't win.
    try { abortRef.current?.abort?.(); } catch { /* ignore */ }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    abortRef.current = controller;
    await runFarmContextFetch({
      farmId: id,
      dispatch,
      fetcher: opts.fetcher,
      signal: controller?.signal,
      base:   opts.base,
      credentials: opts.credentials,
    });
  }, [opts.fetcher, opts.base, opts.credentials]);

  // Fetch whenever farmId changes. Empty farmId → reset to idle.
  useEffect(() => {
    if (!farmId) { dispatch({ type: 'reset' }); return; }
    doFetch(farmId);
    return () => {
      try { abortRef.current?.abort?.(); } catch { /* ignore */ }
    };
  }, [farmId, doFetch]);

  const refetch = useCallback(() => {
    if (farmId) doFetch(farmId);
  }, [farmId, doFetch]);

  return {
    status: state.status,
    data:   state.data,
    error:  state.error,
    loading: state.status === 'loading',
    isReady: state.status === 'ready',
    refetch,
  };
}

export default useFarmContext;
