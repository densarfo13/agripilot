/**
 * useFarmHealth — satellite-derived land health for the Home card.
 *
 *   const { health, loading, error, refetch } = useFarmHealth(location);
 *
 *   location = { lat: number, lng: number } | null
 *
 * Behaviour
 *   • When location is null/undefined or lat/lng aren't finite,
 *     the hook returns { health: null, loading: false } and
 *     never fires a network request. The card renders the
 *     "Add farm location to unlock land health" empty state.
 *   • When coordinates are present, the hook calls
 *     GET /api/v2/satellite/farm-health?latitude=&longitude=
 *     and normalises the response into the sealed shape below.
 *   • Never throws. Errors surface as { error, health: null }
 *     so the card can render a calm "couldn't load" state.
 *
 * Normalised shape
 *   {
 *     status:    'healthy' | 'watch' | 'critical' | 'unknown',
 *     ndvi:      number | null,             // 0..1
 *     vegetation:'healthy' | 'stressed' | 'sparse' | 'unknown',
 *     droughtRisk: 'low' | 'medium' | 'high' | 'unknown',
 *     score:     number | null,             // 0..100 composite
 *     updatedAt: string | null,             // ISO timestamp
 *   }
 *
 * The NDVI value is intentionally exposed as a 0..1 number — the
 * card never renders the raw score next to a percentage, only the
 * sealed status label (per the recommendation-engine no-raw-scores
 * rule). Operators / admin surfaces can read `ndvi` directly.
 *
 * Strict-rule audit
 *   • Hook order is stable — no conditional hooks.
 *   • AbortController cleans up on unmount.
 *   • SSR-safe (no top-level window access).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../api/apiClient.js';
// Farm Health API Stability Fix — canonical lat/lng guard rejects
// the null-island (0,0) sentinel that unset farm records emit and
// that was causing /v2/satellite/farm-health to 500.
import { inspectCoordinate } from '../lib/geo/coordinateGuard.js';

const TIMEOUT_MS = 8_000;

const EMPTY_HEALTH = Object.freeze({
  status:      'unknown',
  ndvi:        null,
  vegetation:  'unknown',
  droughtRisk: 'unknown',
  score:       null,
  updatedAt:   null,
});

function _normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sat = (raw.satellite && typeof raw.satellite === 'object') ? raw.satellite : {};
  const veg = (raw.vegetationScore && typeof raw.vegetationScore === 'object') ? raw.vegetationScore : {};
  const dr  = (raw.drought && typeof raw.drought === 'object') ? raw.drought : {};

  const ndvi = (() => {
    const v = Number(sat.avgNdvi);
    return Number.isFinite(v) ? v : null;
  })();

  // Map vegetation classification → sealed status label.
  // The classifier ('healthy' | 'stressed' | 'sparse' | 'unknown')
  // already carries the right intent; we only need to fold the
  // drought-risk signal in for the overall status pill.
  const vegetation = String(sat.vegetation || veg.vegetation || 'unknown').toLowerCase();
  const droughtRisk = String(dr.risk || dr.level || 'unknown').toLowerCase();

  const status = (() => {
    if (vegetation === 'sparse' || droughtRisk === 'high') return 'critical';
    if (vegetation === 'stressed' || droughtRisk === 'medium') return 'watch';
    if (vegetation === 'healthy' && droughtRisk !== 'high') return 'healthy';
    return 'unknown';
  })();

  const score = (() => {
    const v = Number(veg.score);
    if (Number.isFinite(v)) return Math.max(0, Math.min(100, Math.round(v)));
    return null;
  })();

  return Object.freeze({
    status,
    ndvi,
    vegetation: ['healthy', 'stressed', 'sparse'].includes(vegetation) ? vegetation : 'unknown',
    droughtRisk: ['low', 'medium', 'high'].includes(droughtRisk) ? droughtRisk : 'unknown',
    score,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  });
}

export function useFarmHealth(location) {
  // Run every input through the canonical guard so 0,0 / NaN /
  // out-of-range / missing values ALL collapse to "no coords"
  // before any network call is attempted. The previous code
  // accepted (0, 0) because Number.isFinite(0) is true — that
  // was the source of the /v2/satellite/farm-health 500s.
  const check = inspectCoordinate(
    location && (location.lat != null ? location.lat : location.latitude),
    location && (location.lng != null ? location.lng : location.longitude),
  );
  const lat = check.valid ? check.lat : null;
  const lng = check.valid ? check.lng : null;
  const hasCoords = check.valid;
  // Dev-only trace so a future "no farm health" report can be
  // diagnosed by grepping [FARM_HEALTH_LOCATION] in DevTools.
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    try {

      console.log('[FARM_HEALTH_LOCATION]', {
        valid:  check.valid,
        reason: check.valid ? null : check.reason,
        lat,
        lng,
      });
    } catch { /* swallow */ }
  }

  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchOnce = useCallback(async () => {
    if (!hasCoords) {
      setHealth(null);
      setLoading(false);
      setError(null);
      return;
    }
    try { abortRef.current && abortRef.current.abort(); } catch { /* swallow */ }
    const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    abortRef.current = ctrl;
    const timer = (ctrl && typeof setTimeout === 'function')
      ? setTimeout(() => { try { ctrl.abort(); } catch { /* swallow */ } }, TIMEOUT_MS)
      : null;

    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get(
        `/v2/satellite/farm-health?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`,
        ctrl ? { signal: ctrl.signal } : undefined,
      );
      if (ctrl && ctrl.signal.aborted) return;
      setHealth(_normalize(data));
    } catch (err) {
      if (ctrl && ctrl.signal.aborted) return;
      setHealth(null);
      setError((err && err.message) || 'farm health unavailable');
    } finally {
      if (timer) try { clearTimeout(timer); } catch { /* swallow */ }
      setLoading(false);
    }
  }, [hasCoords, lat, lng]);

  useEffect(() => {
    fetchOnce();
    return () => {
      try { abortRef.current && abortRef.current.abort(); } catch { /* swallow */ }
    };
  }, [fetchOnce]);

  return useMemo(() => ({
    health,
    loading,
    error,
    hasCoords,
    refetch: fetchOnce,
    EMPTY: EMPTY_HEALTH,
  }), [health, loading, error, hasCoords, fetchOnce]);
}

export default useFarmHealth;
