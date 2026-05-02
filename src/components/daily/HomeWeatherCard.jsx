/**
 * HomeWeatherCard.jsx \u2014 small Home weather surface
 * (Final Location Autofill + Weather Integration \u00a77).
 *
 *   <HomeWeatherCard />
 *
 * What ships
 * ──────────
 * Reads the persisted location from `farroway_location`,
 * fetches current weather via getWeatherForLocation, and
 * renders a small card with:
 *   \u2022 summary  ("Rainy", "Humid", "Hot", "Dry", "Windy",
 *                "Normal", or "Weather unavailable")
 *   \u2022 temperature (when available)
 *   \u2022 rain chance (when available)
 *   \u2022 humidity   (when available)
 *
 * Spec \u00a77 fallback: when the service returns the safe-default
 * shape, render a single helper line:
 *   "Weather unavailable \u2014 showing general guidance."
 *
 * Side effect: writes the fetched weather into
 * `farroway_weather_cache` so DailyPlanCard's existing reader
 * picks it up on the next render. This keeps the card and
 * the engine looking at the same numbers without rewiring
 * the engine's input pipeline.
 *
 * Strict-rule audit
 *   \u2022 Reads from existing stores only on mount; one fetch
 *     against Open-Meteo via the weather service.
 *   \u2022 Inline styles only. All visible text via tSafe.
 *   \u2022 Self-hides when there's no persisted location \u2014 no
 *     point fetching weather without coords or country.
 *   \u2022 Defensive every step: a corrupt cache or a malformed
 *     service response collapses to the unavailable card,
 *     never crashes.
 */

import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { loadLocation } from '../../utils/locationStore.js';
import {
  getWeatherForLocation,
  getDefaultWeather,
} from '../../core/weatherService.js';

const C = {
  ink:     '#EAF2FF',
  inkSoft: 'rgba(255,255,255,0.65)',
  border:  'rgba(255,255,255,0.10)',
};

const S = {
  card: {
    margin: '0.75rem 0',
    padding: '12px 14px',
    borderRadius: 14,
    background: 'linear-gradient(180deg, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.04) 100%)',
    border: '1px solid rgba(59,130,246,0.22)',
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardUnavailable: {
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  summary: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: C.ink,
    textTransform: 'capitalize',
  },
  temp: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    color: '#FCD34D',
  },
  metricsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    fontSize: '0.8125rem',
    color: C.inkSoft,
  },
  metric: { display: 'inline-flex', gap: 4, alignItems: 'baseline' },
  metricVal: { color: C.ink, fontWeight: 700 },
  unavailable: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#FDE68A',
    lineHeight: 1.45,
  },
};

/**
 * Persist the spec-shape weather into the existing
 * `farroway_weather_cache` slot so DailyPlanCard's engine
 * reader (`buildGrowingContext`) picks it up. The reader
 * tolerates either short field names (rainChance, humidity,
 * temp, wind) or the longer ones (relativeHumidity,
 * temperatureC, windKmh) \u2014 we write the short names so the
 * engine's first match hits.
 */
function _writeWeatherCache(weather) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!weather || typeof weather !== 'object') return;
    localStorage.setItem('farroway_weather_cache', JSON.stringify({
      // Engine field names (short).
      rainChance:  weather.rainChance,
      humidity:    weather.humidity,
      temp:        weather.temperature,
      wind:        weather.wind,
      // Plus the full spec shape so downstream surfaces that
      // want the booleans / summary don't have to re-compute.
      rainExpected: weather.rainExpected,
      summary:     weather.summary,
      fetchedAt:   Date.now(),
    }));
  } catch { /* swallow */ }
}

export default function HomeWeatherCard({ style }) {
  useTranslation();
  const [weather, setWeather] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const location = (() => {
      try { return loadLocation(); } catch { return null; }
    })();
    // Self-hide when no location \u2014 we can't fetch weather
    // without coords or even a country name. The card stays
    // unmounted; spec \u00a77 says self-hide via the parent's
    // conditional.
    if (!location) {
      setLoaded(true);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const w = await getWeatherForLocation(location);
        if (!cancelled) setWeather(w);
      } catch {
        if (!cancelled) setWeather(getDefaultWeather());
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist into the engine's cache as soon as we have data
  // \u2014 even the safe-default shape, so the engine can branch
  // on rainExpected: false / null fields instead of hitting
  // a stale older cache.
  React.useEffect(() => {
    if (weather) _writeWeatherCache(weather);
  }, [weather]);

  // Don't render until we know there's something to show
  // (avoids a layout flicker between mount and the fetch).
  if (!loaded) return null;
  if (!weather) return null;

  const isUnavailable = weather.summary === 'Weather unavailable';
  const cardStyle = {
    ...S.card,
    ...(isUnavailable ? S.cardUnavailable : null),
    ...(style || {}),
  };

  if (isUnavailable) {
    return (
      <section style={cardStyle} data-testid="home-weather-card" data-state="unavailable">
        <p style={S.unavailable}>
          {tSafe('home.weather.unavailable',
            'Weather unavailable \u2014 showing general guidance.')}
        </p>
      </section>
    );
  }

  return (
    <section style={cardStyle} data-testid="home-weather-card" data-state="ok">
      <div style={S.headerRow}>
        <p style={S.summary}>
          {tSafe(`home.weather.summary.${weather.summary}`,
            weather.summary.charAt(0).toUpperCase() + weather.summary.slice(1))}
        </p>
        {weather.temperature != null ? (
          <p style={S.temp} data-testid="home-weather-temp">
            {Math.round(weather.temperature)}{'\u00B0'}
          </p>
        ) : null}
      </div>
      <div style={S.metricsRow}>
        {typeof weather.rainChance === 'number' ? (
          <span style={S.metric} data-testid="home-weather-rain">
            <span>{tSafe('home.weather.rain', 'Rain')}{':'}</span>
            <span style={S.metricVal}>{weather.rainChance}%</span>
          </span>
        ) : null}
        {typeof weather.humidity === 'number' ? (
          <span style={S.metric} data-testid="home-weather-humidity">
            <span>{tSafe('home.weather.humidity', 'Humidity')}{':'}</span>
            <span style={S.metricVal}>{weather.humidity}%</span>
          </span>
        ) : null}
        {typeof weather.wind === 'number' ? (
          <span style={S.metric} data-testid="home-weather-wind">
            <span>{tSafe('home.weather.wind', 'Wind')}{':'}</span>
            <span style={S.metricVal}>{Math.round(weather.wind)} km/h</span>
          </span>
        ) : null}
      </div>
    </section>
  );
}
