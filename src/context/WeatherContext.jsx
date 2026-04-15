import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWeather } from '../lib/api.js';
import { useProfile } from './ProfileContext.jsx';
import { useNetwork } from './NetworkContext.jsx';

const WeatherContext = createContext(null);
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export function WeatherProvider({ children }) {
  const { profile } = useProfile();
  const { isOnline } = useNetwork();

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const cacheRef = useRef({ data: null, location: null, fetchedAt: 0 });

  useEffect(() => {
    if (!isOnline) return;

    const lat = profile?.gpsLat;
    const lng = profile?.gpsLng;
    const location = profile?.location;

    const hasGps = lat != null && lng != null;
    const hasLocation = location && location.trim().length > 0;
    if (!hasGps && !hasLocation) return;

    // Cache check — reuse if same location and within TTL
    const cacheKey = hasGps ? `${lat},${lng}` : location;
    const cache = cacheRef.current;
    if (cache.data && cache.location === cacheKey && (Date.now() - cache.fetchedAt) < CACHE_TTL) {
      if (!weather) { setWeather(cache.data); setResolvedLocation(cache.resolvedLocation); }
      return;
    }

    setWeatherLoading(true);
    const params = hasGps ? { lat, lng } : { location };

    getCurrentWeather(params)
      .then((data) => {
        const w = data.weather || null;
        setWeather(w);
        setResolvedLocation(data.resolvedLocation || null);
        cacheRef.current = { data: w, resolvedLocation: data.resolvedLocation, location: cacheKey, fetchedAt: Date.now() };
      })
      .catch((error) => { console.error('Weather fetch failed:', error); })
      .finally(() => { setWeatherLoading(false); });
  }, [profile?.gpsLat, profile?.gpsLng, profile?.location, isOnline]);

  const value = useMemo(
    () => ({ weather, weatherLoading, resolvedLocation }),
    [weather, weatherLoading, resolvedLocation],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within WeatherProvider');
  return context;
}
