/**
 * ForecastContext — 7-day weather forecast store.
 *
 * Fetches from Open-Meteo via weatherForecastService, shares forecast
 * app-wide. Runs the rainfallEngine to produce farmer-friendly alerts.
 *
 * Refresh strategy:
 *   1. On mount / profile change (GPS or country change)
 *   2. On visibility change (tab return) if data > 30 min old
 *   3. Background interval every 30 minutes
 *   4. Manual via refreshForecast()
 *
 * Depends on: ProfileContext (for GPS coords + country code)
 */
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfile } from './ProfileContext.jsx';
import { useNetwork } from './NetworkContext.jsx';
import { fetchForecast } from '../services/weatherForecastService.js';
import { analyzeRainfall, getTopAlert } from '../engine/rainfallEngine.js';

const ForecastContext = createContext(null);

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const MIN_REFETCH_GAP_MS  =  5 * 60 * 1000;
const VISIBILITY_REFETCH_MS = 15 * 60 * 1000;

export function ForecastProvider({ children }) {
  const { profile } = useProfile();
  const { isOnline } = useNetwork();

  const [forecast, setForecast] = useState(null);
  const [rainfall, setRainfall] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);

  const inflightRef = useRef(null);
  const intervalRef = useRef(null);

  // Resolve coordinates from profile
  const coords = useMemo(() => {
    const lat = profile?.gpsLat;
    const lng = profile?.gpsLng;
    const cc = profile?.countryCode || '';
    if (lat != null && lng != null) return { lat, lng, countryCode: cc };
    if (cc) return { countryCode: cc };
    return null;
  }, [profile?.gpsLat, profile?.gpsLng, profile?.countryCode]);

  const locationKey = useMemo(() => {
    if (!coords) return null;
    if (coords.lat != null) return `${coords.lat},${coords.lng}`;
    return coords.countryCode;
  }, [coords]);

  // ─── Core fetch ──────────────────────────────────────────
  const doFetch = useCallback(async (force = false) => {
    if (!coords || !isOnline) return;
    if (!force && fetchedAt && (Date.now() - fetchedAt) < MIN_REFETCH_GAP_MS) return;
    if (inflightRef.current) return inflightRef.current;

    const promise = (async () => {
      setForecastLoading(true);
      try {
        const data = await fetchForecast({
          lat: coords.lat,
          lng: coords.lng,
          countryCode: coords.countryCode,
          force,
        });
        if (data) {
          setForecast(data);
          setFetchedAt(data.fetchedAt);

          // Run rainfall analysis
          const cropStage = profile?.cropStage || '';
          const crop = profile?.cropType || profile?.crop || '';
          const analysis = analyzeRainfall({
            days: data.days,
            cropStage,
            crop,
            isNew: profile?.isNew || false,
          });
          setRainfall(analysis);
        }
      } catch (err) {
        console.warn('Forecast context fetch error:', err);
      } finally {
        setForecastLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, [coords, isOnline, fetchedAt, profile]);

  const refreshForecast = useCallback(() => doFetch(true), [doFetch]);

  // ─── Fetch on mount / location change ────────────────────
  useEffect(() => {
    if (locationKey && isOnline) doFetch(false);
  }, [locationKey, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Visibility change ───────────────────────────────────
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (!coords || !isOnline) return;
      if (!fetchedAt || (Date.now() - fetchedAt) > VISIBILITY_REFETCH_MS) {
        doFetch(false);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [coords, isOnline, fetchedAt, doFetch]);

  // ─── Background interval ────────────────────────────────
  useEffect(() => {
    if (!coords || !isOnline) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => doFetch(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [coords, isOnline, doFetch]);

  // ─── Re-analyze when crop stage changes ──────────────────
  useEffect(() => {
    if (!forecast?.days) return;
    const cropStage = profile?.cropStage || '';
    const crop = profile?.cropType || profile?.crop || '';
    const analysis = analyzeRainfall({
      days: forecast.days,
      cropStage,
      crop,
      isNew: profile?.isNew || false,
    });
    setRainfall(analysis);
  }, [profile?.cropStage, profile?.cropType, profile?.crop, forecast]); // eslint-disable-line react-hooks/exhaustive-deps

  const topAlert = useMemo(() => {
    return rainfall ? getTopAlert(rainfall.alerts) : null;
  }, [rainfall]);

  const value = useMemo(() => ({
    forecast,
    rainfall,
    topAlert,
    forecastLoading,
    fetchedAt,
    refreshForecast,
  }), [forecast, rainfall, topAlert, forecastLoading, fetchedAt, refreshForecast]);

  return <ForecastContext.Provider value={value}>{children}</ForecastContext.Provider>;
}

export function useForecast() {
  const context = useContext(ForecastContext);
  if (!context) throw new Error('useForecast must be used within ForecastProvider');
  return context;
}
