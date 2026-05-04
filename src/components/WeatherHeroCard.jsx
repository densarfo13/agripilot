/**
 * WeatherHeroCard — Home Screen v2 weather hero with subtle
 * animated effects.
 *
 *   <WeatherHeroCard weather={loop.weather} />
 *
 * Rules
 *   • Large rounded card (≥ 260 px) with a navy/green gradient.
 *   • Animated effect layer reflects the active weather type:
 *       rain → falling rain lines
 *       heat → soft sun-glow pulse in the corner
 *       wind → drifting wind streaks
 *       dry  → slow background pulse
 *       normal → no animation
 *   • Animations are intentionally low-cost: pure CSS transforms
 *     on a single ::before pseudo-element. Smooth on mobile.
 *   • When the weather payload is missing the card renders
 *     "Weather unavailable" + the fallback action.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • CSS animations live in src/index.css under the
 *     `.weather-rain::before` / `.weather-heat::before` /
 *     `.weather-wind::before` / `.weather-dry::before` rules
 *     — global keyframes are loaded once at boot.
 *   • Inline styles are kept to layout-only; visuals + animations
 *     come from the global stylesheet so prefers-reduced-motion
 *     can disable them centrally.
 */

import React from 'react';
import { getWeatherAction } from '../lib/weatherActionEngine.js';

export default function WeatherHeroCard({ weather }) {
  const w = (weather && typeof weather === 'object' && !Array.isArray(weather))
    ? weather : {};
  const action = getWeatherAction(w);

  // Display values — fall through to em-dash placeholders when
  // the underlying field is missing so the layout never collapses.
  const tempDisplay = (w.temp != null && Number.isFinite(Number(w.temp)))
    ? Math.round(Number(w.temp)) + '\u00B0'
    : '\u2014\u00B0';
  const conditionDisplay = (typeof w.condition === 'string' && w.condition.length > 0)
    ? w.condition
    : 'Weather unavailable';
  const rainDisplay = (w.rainChance != null && Number.isFinite(Number(w.rainChance)))
    ? Number(w.rainChance) + '%'
    : '\u2014';
  const windRaw = w.windSpeed != null ? w.windSpeed : w.wind;
  const windDisplay = (windRaw != null && Number.isFinite(Number(windRaw)))
    ? Number(windRaw) + ' km/h'
    : '\u2014';
  const locationDisplay = (typeof w.location === 'string' && w.location.length > 0)
    ? w.location
    : 'Your area';

  return (
    <section
      className={`weather-hero weather-${action.type}`}
      data-testid="weather-hero-card"
      data-weather-type={action.type}
    >
      <div className="weather-bg-effect" aria-hidden="true" />

      <div className="weather-top">
        <div className="weather-headline">
          <p className="eyebrow">{'Today\u2019s Weather'}</p>
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
        <p><span aria-hidden="true">{'\uD83D\uDCA1 '}</span>{action.insight}</p>
        <strong><span aria-hidden="true">{'\uD83D\uDC49 '}</span>{action.action}</strong>
      </div>
    </section>
  );
}
