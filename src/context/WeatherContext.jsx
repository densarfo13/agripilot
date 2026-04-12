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

  useEffect(() => {
    const lat = profile?.gpsLat;
    const lng = profile?.gpsLng;

    if (!isOnline || lat === null || lat === undefined || lng === null || lng === undefined) {
      return;
    }

    setWeatherLoading(true);

    getCurrentWeather(lat, lng)
      .then((data) => { setWeather(data.weather || null); })
      .catch((error) => { console.error('Failed to load weather:', error); })
      .finally(() => { setWeatherLoading(false); });
  }, [profile?.gpsLat, profile?.gpsLng, isOnline]);

  const value = useMemo(() => ({ weather, weatherLoading }), [weather, weatherLoading]);

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within WeatherProvider');
  return context;
}
