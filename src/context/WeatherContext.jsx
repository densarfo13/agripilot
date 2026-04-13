import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentWeather } from '../lib/api.js';
import { useProfile } from './ProfileContext.jsx';
import { useNetwork } from './NetworkContext.jsx';

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
  const { profile } = useProfile();
  const { isOnline } = useNetwork();

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState(null);

  useEffect(() => {
    if (!isOnline) return;

    const lat = profile?.gpsLat;
    const lng = profile?.gpsLng;
    const location = profile?.location;

    const hasGps = lat != null && lng != null;
    const hasLocation = location && location.trim().length > 0;

    if (!hasGps && !hasLocation) return;

    setWeatherLoading(true);

    const params = hasGps ? { lat, lng } : { location };

    getCurrentWeather(params)
      .then((data) => {
        setWeather(data.weather || null);
        setResolvedLocation(data.resolvedLocation || null);
      })
      .catch((error) => { console.error('Failed to load weather:', error); })
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
