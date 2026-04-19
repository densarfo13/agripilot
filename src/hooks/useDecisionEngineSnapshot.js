/**
 * useDecisionEngineSnapshot — React hook that polls the
 * /api/v2/decision/snapshot endpoint and returns the current
 * DecisionEngineSnapshot for the logged-in user.
 *
 * Usage:
 *   const { snapshot, loading, error, refetch } = useDecisionEngineSnapshot({
 *     enabled: isDev,
 *     intervalMs: 15_000,
 *   });
 *
 * Hook is cheap: no-op if disabled, aborts on unmount, deduplicates
 * concurrent refreshes. Use it only in dev panels or admin views.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const ENDPOINT = '/api/v2/decision/snapshot';

export function useDecisionEngineSnapshot({
  enabled = true,
  intervalMs = 0,
  body = null,
  fetcher = null,
} = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const inFlight = useRef(false);
  const aliveRef = useRef(true);

  const effectiveFetcher = fetcher || defaultFetcher;

  const refetch = useCallback(async (overrides = {}) => {
    if (!enabled) return null;
    if (inFlight.current) return null;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const out = await effectiveFetcher({ ...(body || {}), ...(overrides || {}) });
      if (!aliveRef.current) return null;
      setSnapshot(out);
      return out;
    } catch (e) {
      if (aliveRef.current) setError(e);
      return null;
    } finally {
      if (aliveRef.current) setLoading(false);
      inFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, body, effectiveFetcher]);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) return () => { aliveRef.current = false; };
    refetch();
    if (!intervalMs) return () => { aliveRef.current = false; };
    const id = setInterval(() => refetch(), Math.max(3000, intervalMs));
    return () => { aliveRef.current = false; clearInterval(id); };
  }, [enabled, intervalMs, refetch]);

  return { snapshot, loading, error, refetch };
}

async function defaultFetcher(body) {
  if (typeof fetch !== 'function') throw new Error('fetch unavailable');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`snapshot fetch failed ${res.status}`);
  return await res.json();
}

export default useDecisionEngineSnapshot;
