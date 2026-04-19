/**
 * useUSRecommendations — React hook that calls POST /api/v2/recommend/us
 * and returns { loading, error, data, refresh }.
 *
 * Designed to work with the existing api wrapper; falls back to a
 * plain fetch if the project doesn't expose an axios client for this
 * endpoint yet.
 */
import { useEffect, useState, useCallback } from 'react';

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const err = new Error(`request_failed_${res.status}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch { /* ignore */ }
    throw err;
  }
  return res.json();
}

/**
 * @param {Object} args
 * @param {string} args.state          — postal code or full state name
 * @param {string} args.farmType       — 'backyard' | 'small_farm' | 'commercial'
 * @param {string} [args.beginnerLevel]
 * @param {string} [args.growingStyle] — backyard only
 * @param {string} [args.purpose]      — backyard only
 * @param {number} [args.currentMonth] — 1..12, defaults to today
 * @param {boolean} [args.enabled]     — guard initial fetch (default true)
 */
export function useUSRecommendations(args = {}) {
  const {
    state, farmType, beginnerLevel = 'beginner',
    growingStyle, purpose, currentMonth, enabled = true,
  } = args;

  const [state_, setState_] = useState({ loading: false, error: null, data: null });

  const refresh = useCallback(async () => {
    if (!state || !farmType) {
      setState_({ loading: false, error: 'missing_inputs', data: null });
      return;
    }
    setState_((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await postJSON('/api/v2/recommend/us', {
        country: 'USA', state, farmType,
        beginnerLevel, growingStyle, purpose, currentMonth,
      });
      setState_({ loading: false, error: null, data });
    } catch (err) {
      setState_({ loading: false, error: err?.body?.error || err.message || 'error', data: null });
    }
  }, [state, farmType, beginnerLevel, growingStyle, purpose, currentMonth]);

  useEffect(() => {
    if (!enabled) return;
    if (!state || !farmType) return;
    refresh();
  }, [enabled, refresh, state, farmType]);

  return { ...state_, refresh };
}
