/**
 * WeatherContext — centralized weather store for the entire app.
 *
 * Single source of truth: one fetch, one cache, one timer.
 * No component fetches weather independently.
 *
 * Refresh strategy:
 *   1. On mount (app open)
 *   2. On visibility change (tab/app return)
 *   3. Background interval every 20 minutes
 *   4. Manual via refreshWeather()
 *
 * Dedup: concurrent fetch requests are collapsed into one.
 * Staleness: derived from fetchedAt timestamp.
 *
 * Thresholds:
 *   fresh:  <= 20 min
 *   aging:  20–60 min
 *   stale:  > 60 min
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWeather } from '../lib/api.js';
import { useProfile } from './ProfileContext.jsx';
import { useNetwork } from './NetworkContext.jsx';

const WeatherContext = createContext(null);

// ─── Timing constants ────────────────────────────────────
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;   // 20 minutes background refresh
const FRESH_THRESHOLD_MS  = 20 * 60 * 1000;   // <= 20 min = fresh
const AGING_THRESHOLD_MS  = 60 * 60 * 1000;   // 20–60 min = aging
// > 60 min = stale
const MIN_REFETCH_GAP_MS  =  2 * 60 * 1000;   // don't re-fetch within 2 min of last fetch
const VISIBILITY_REFETCH_MS = 5 * 60 * 1000;   // re-fetch on visibility if data > 5 min old

/**
 * Derive staleness category from a fetchedAt timestamp.
 * @param {number|null} fetchedAt - epoch ms
 * @returns {'fresh'|'aging'|'stale'|'none'}
 */
export function getWeatherFreshness(fetchedAt) {
  if (!fetchedAt) return 'none';
  const age = Date.now() - fetchedAt;
  if (age <= FRESH_THRESHOLD_MS) return 'fresh';
  if (age <= AGING_THRESHOLD_MS) return 'aging';
  return 'stale';
}

export function WeatherProvider({ children }) {
  const { profile } = useProfile();
  const { isOnline } = useNetwork();

  const [weather, setWeather] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState(null);

  // Dedup guard — holds the in-flight promise
  const inflightRef = useRef(null);
  const intervalRef = useRef(null);

  // Build location key from profile
  const locationKey = useMemo(() => {
    const lat = profile?.gpsLat;
    const lng = profile?.gpsLng;
    const loc = profile?.location;
    if (lat != null && lng != null) return `${lat},${lng}`;
    if (loc && loc.trim()) return loc.trim();
    return null;
  }, [profile?.gpsLat, profile?.gpsLng, profile?.location]);

  const fetchParams = useMemo(() => {
    const lat = profile?.gpsLat;
    const lng = profile?.gpsLng;
    const loc = profile?.location;
    if (lat != null && lng != null) return { lat, lng };
    if (loc && loc.trim()) return { location: loc.trim() };
    return null;
  }, [profile?.gpsLat, profile?.gpsLng, profile?.location]);

  // ─── Core fetch (deduped) ────────────────────────────────
  const doFetch = useCallback(async (force = false) => {
    if (!fetchParams) return;
    if (!isOnline) return;

    // Skip if fetched very recently (unless forced)
    if (!force && fetchedAt && (Date.now() - fetchedAt) < MIN_REFETCH_GAP_MS) return;

    // Dedup — if a fetch is already in flight, wait for it
    if (inflightRef.current) return inflightRef.current;

    const promise = (async () => {
      setWeatherLoading(true);
      try {
        const data = await getCurrentWeather(fetchParams);
        const w = data.weather || null;
        const now = Date.now();
        setWeather(w);
        setFetchedAt(now);
        setResolvedLocation(data.resolvedLocation || null);
      } catch (err) {
        // Downgrade from console.error to console.warn — weather
        // 5xx is a backend issue (out of frontend scope); the UI
        // already gracefully keeps stale data. console.error here
        // surfaces as a red error in DevTools on every farmer
        // pageview, which was alarming pilot users (visible in
        // recent console screenshots).
        try { console.warn('[weather] fetch failed (keeping stale data):', err && err.message); }
        catch { /* ignore */ }
        // Keep stale data — don't clear weather on error
      } finally {
        setWeatherLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, [fetchParams, isOnline, fetchedAt]);

  // ─── Public refresh function ─────────────────────────────
  const refreshWeather = useCallback(() => doFetch(true), [doFetch]);

  // ─── 1. Fetch on mount / location change ─────────────────
  useEffect(() => {
    if (locationKey && isOnline) {
      doFetch(false);
    }
  }, [locationKey, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2. Visibility change (tab return / app resume) ──────
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (!fetchParams || !isOnline) return;
      // Only re-fetch if data is older than 5 min
      if (!fetchedAt || (Date.now() - fetchedAt) > VISIBILITY_REFETCH_MS) {
        doFetch(false);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchParams, isOnline, fetchedAt, doFetch]);

  // ─── 3. Background interval (20 min) ─────────────────────
  useEffect(() => {
    if (!fetchParams || !isOnline) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      doFetch(false);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchParams, isOnline, doFetch]);

  // ─── Derived state ───────────────────────────────────────
  const freshness = getWeatherFreshness(fetchedAt);
  const isStale = freshness === 'stale';

  const value = useMemo(
    () => ({
      weather,
      weatherLoading,
      resolvedLocation,
      fetchedAt,
      freshness,     // 'fresh' | 'aging' | 'stale' | 'none'
      isStale,
      refreshWeather,
    }),
    [weather, weatherLoading, resolvedLocation, fetchedAt, freshness, isStale, refreshWeather],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within WeatherProvider');
  return context;
}
