/**
 * useTrustScore — Phase 7B: fetch the trust score for a farmer.
 *
 *   const { score, level, building, loading } = useTrustScore(farmerId);
 *
 * Returns:
 *   score    {number | null}  0–100 when available, null when building/error
 *   level    {'high'|'medium'|'low'|null}
 *   building {boolean}        true → show "Building trust score…" neutral badge
 *   loading  {boolean}        true while the request is in flight
 *
 * Guarantees:
 *   • Never throws.
 *   • Passing null / '' for farmerId skips the fetch entirely.
 *   • Caches by farmerId: won't re-fetch if farmerId hasn't changed.
 *   • Cancels in-flight request on unmount or farmerId change.
 *   • On any error → building: true (neutral badge, no crash).
 */

import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

const INITIAL = Object.freeze({
  score:    null,
  level:    null,
  building: true,
  loading:  false,
});

export default function useTrustScore(farmerId) {
  const [state,   setState] = useState(INITIAL);
  const lastId  = useRef('');

  useEffect(() => {
    const id = String(farmerId || '').trim();

    // Empty id → reset to neutral, no fetch.
    if (!id) {
      lastId.current = '';
      setState(INITIAL);
      return;
    }

    // Same id as last render → no re-fetch.
    if (id === lastId.current) return;
    lastId.current = id;

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    (async () => {
      try {
        const res = await api.get(
          `/v2/trust/score?farmerId=${encodeURIComponent(id)}`,
        );
        if (cancelled) return;

        const d = res && res.data ? res.data : null;
        if (!d || d.building) {
          setState({ score: null, level: null, building: true, loading: false });
        } else {
          setState({
            score:    Number.isFinite(Number(d.score)) ? Number(d.score) : null,
            level:    typeof d.level === 'string' ? d.level : null,
            building: false,
            loading:  false,
          });
        }
      } catch {
        // API down, network error, 4xx/5xx → show neutral "Building…" badge.
        if (!cancelled) {
          setState({ score: null, level: null, building: true, loading: false });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [farmerId]);

  return state;
}
