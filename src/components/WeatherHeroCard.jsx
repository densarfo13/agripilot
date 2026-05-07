/**
 * WeatherHeroCard — Home Screen v2 weather hero with subtle
 * animated effects.
 *
 *   <WeatherHeroCard weather={liveWeather} />
 *
 * Accepts the shape returned by useLiveWeather:
 *   {
 *     temp, condition, rainChance, windSpeed,
 *     locationLabel, weatherType, source
 *   }
 * Also accepts the legacy shape (location, no weatherType) for
 * backward compat with the Dashboard loop.weather payload.
 *
 * Animation class selection (CSS in src/index.css):
 *   1. weather.weatherType  (from useLiveWeather / backend)
 *   2. getWeatherAction(w).type (local numeric derivation)
 *   3. 'unknown'            (ultimate fallback → calm leaf pulse)
 *
 * Rules
 *   • Pure presentational. Never throws.
 *   • CSS animations use a single ::before pseudo-element per
 *     condition, disabled by prefers-reduced-motion.
 *   • locationLabel preferred over legacy location field.
 *   • Fallback strings use em-dash so layout never collapses.
 */

import React from 'react';
import { getWeatherAction } from '../lib/weatherActionEngine.js';

// All types that have a CSS class in index.css.
const VALID_TYPES = new Set([
  'rain', 'heat', 'wind', 'dry',
  'sunny', 'cloudy', 'unknown', 'normal',
]);

export default function WeatherHeroCard({ weather }) {
  const w = (weather && typeof weather === 'object' && !Array.isArray(weather))
    ? weather : {};

  // Insight / action text from the numeric decision engine.
  const action = getWeatherAction(w);

  // CSS animation class:
  //   Prefer weather.weatherType (richer vocabulary: sunny/cloudy/unknown)
  //   over action.type (rain/heat/wind/dry/normal).
  const rawType = (typeof w.weatherType === 'string' && VALID_TYPES.has(w.weatherType))
    ? w.weatherType
    : (VALID_TYPES.has(action.type) ? action.type : 'unknown');

  // Display values — em-dash fallbacks so layout never collapses.
  const tempDisplay = (w.temp != null && Number.isFinite(Number(w.temp)))
    ? Math.round(Number(w.temp)) + '°'
    : '—°';

  const conditionDisplay = (typeof w.condition === 'string'
      && w.condition.trim()
      && w.condition !== 'Weather unavailable')
    ? w.condition
    : 'Weather unavailable';

  const rainDisplay = (w.rainChance != null && Number.isFinite(Number(w.rainChance)))
    ? Number(w.rainChance) + '%'
    : '—';

  const windRaw = w.windSpeed != null ? w.windSpeed : w.wind;
  const windDisplay = (windRaw != null && Number.isFinite(Number(windRaw)))
    ? Number(windRaw) + ' km/h'
    : '—';

  // Prefer locationLabel (useLiveWeather shape) over legacy location field.
  const locationDisplay =
    (typeof w.locationLabel === 'string' && w.locationLabel.trim()
     && w.locationLabel !== 'Your area')
      ? w.locationLabel.trim()
    : (typeof w.location === 'string' && w.location.trim())
      ? w.location.trim()
    : 'Your area';

  return (
    <section
      className={`weather-hero weather-${rawType}`}
      data-testid="weather-hero-card"
      data-weather-type={rawType}
    >
      <div className="weather-bg-effect" aria-hidden="true" />

      <div className="weather-top">
        <div className="weather-headline">
          <p className="eyebrow">{'Today’s Weather'}</p>
          <h1>
            <span className="weather-icon" aria-hidden="true">{action.icon}</span>
            {' '}
            {tempDisplay}
          </h1>
          <p className="weather-condition">{conditionDisplay}</p>
        </div>

        <div className="weather-location">{locationDisplay}</div>
      </div>

      <div className="weather-stats">
        <span><strong>Rain</strong> {rainDisplay}</span>
        <span><strong>Wind</strong> {windDisplay}</span>
      </div>

      <div className="weather-action">
        <p><span aria-hidden="true">{'💡 '}</span>{action.insight}</p>
        <strong><span aria-hidden="true">{'👉 '}</span>{action.action}</strong>
      </div>
    </section>
  );
}
