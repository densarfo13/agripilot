/**
 * WeatherActionCard — large actionable weather card on Home.
 *
 *   <WeatherActionCard weather={loop.weather} />
 *
 * Spec (May 2026 Home redesign)
 *   • Replaces the old single-line "weather intel pill" with a
 *     prominent card that takes ≈ 30–40% of the screen height
 *     above the fold so the user immediately sees:
 *       – Temperature + condition (large)
 *       – Rain chance + wind (smaller meta row)
 *       – Insight line (why)
 *       – Action line (what to do)
 *   • The card NEVER replaces the Today's Task card below it.
 *     The task remains the primary action; this card explains
 *     the WHY.
 *   • Tolerant of any weather payload — `normalizeWeather`
 *     handles temp / tempC / tempHighC / temperatureC,
 *     rainChance / precipitationProbability / pop, wind /
 *     windKph / windSpeed, condition / summary / rainfallState.
 *   • When the API returns no usable weather (offline, denied,
 *     unsupported region), the card renders a friendly
 *     "Weather unavailable. Showing general crop guidance."
 *     fallback. Home is never blank.
 *
 * Strict-rule audit
 *   • Pure presentational. No fetches, no side-effects.
 *   • Never throws — bad input falls through to the
 *     normalize/action defaults.
 *   • Inline styles only (matches the rest of Home).
 */

import React from 'react';
import { getWeatherAction, normalizeWeather } from '../../lib/weatherAction.js';
import { tSafe } from '../../i18n/tSafe.js';

function _conditionToIcon(condition, rainChance, temp) {
  const c = String(condition || '').toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return '\u26C8\uFE0F';   // ⛈️
  if (c.includes('rain'))  return '\uD83C\uDF27\uFE0F';                       // 🌧️
  if (c.includes('snow'))  return '\u2744\uFE0F';                             // ❄️
  if (c.includes('wind'))  return '\uD83C\uDF2C\uFE0F';                       // 🌬️ (windy)
  if (c.includes('fog')   || c.includes('mist')) return '\uD83C\uDF2B\uFE0F';  // 🌫️
  if (c.includes('cloud')) return '\u2601\uFE0F';                              // ☁️
  if (c.includes('sun')   || c.includes('clear')) return '\u2600\uFE0F';       // ☀️
  // Numeric fallback: high rain chance → rain icon, hot → sun.
  if (Number.isFinite(rainChance) && rainChance >= 60) return '\uD83C\uDF27\uFE0F';
  if (Number.isFinite(temp) && temp >= 32) return '\u2600\uFE0F';
  return '\uD83C\uDF24\uFE0F'; // 🌤️
}

function _conditionLabel(condition, rainChance, temp) {
  if (typeof condition === 'string' && condition.length > 0) {
    // Title-case the condition string ("light rain" → "Light Rain").
    return condition.replace(/\b\w/g, (m) => m.toUpperCase());
  }
  if (Number.isFinite(rainChance) && rainChance >= 60) return tSafe('home.weather.rain', 'Rain expected');
  if (Number.isFinite(temp) && temp >= 32) return tSafe('home.weather.hotDay', 'Hot day');
  if (Number.isFinite(rainChance) && rainChance <= 20) return tSafe('home.weather.dryDay', 'Dry day');
  return tSafe('home.weather.mostlyClear', 'Mostly clear');
}

export default function WeatherActionCard({ weather, style }) {
  const wx = normalizeWeather(weather);
  const { insight, action } = getWeatherAction(wx);
  const icon  = _conditionToIcon(wx.condition, wx.rainChance, wx.temp);
  const label = _conditionLabel(wx.condition, wx.rainChance, wx.temp);

  // Soft fallback when the entire payload is empty — keeps the
  // card useful instead of blanking out.
  const noWeatherSignal =
    !Number.isFinite(wx.temp)
    && !Number.isFinite(wx.rainChance)
    && !Number.isFinite(wx.wind)
    && !wx.condition;

  return (
    <section
      data-testid="weather-action-card"
      style={{ ...S.card, ...(style || {}) }}
    >
      <div style={S.topRow}>
        <span aria-hidden="true" style={S.icon}>{icon}</span>
        <div style={S.tempStack}>
          <div style={S.temp}>
            {Number.isFinite(wx.temp) ? Math.round(wx.temp) + '\u00B0C' : '\u2014\u00B0C'}
          </div>
          <div style={S.condition}>{label}</div>
        </div>
      </div>

      <div style={S.metaRow}>
        <span style={S.metaItem}>
          <span style={S.metaLabel}>Rain</span>
          <span style={S.metaValue}>
            {Number.isFinite(wx.rainChance) ? wx.rainChance + '%' : '\u2014'}
          </span>
        </span>
        <span style={S.metaDot}>\u00B7</span>
        <span style={S.metaItem}>
          <span style={S.metaLabel}>Wind</span>
          <span style={S.metaValue}>
            {Number.isFinite(wx.wind) ? wx.wind + ' km/h' : '\u2014'}
          </span>
        </span>
      </div>

      <div style={S.insightLine}>
        <span aria-hidden="true" style={S.insightIcon}>{'\uD83D\uDCA1'}</span>
        <span style={S.insightText}>
          {noWeatherSignal
            ? 'Weather unavailable. Showing general crop guidance.'
            : insight}
        </span>
      </div>

      <div style={S.actionLine}>
        <span aria-hidden="true" style={S.actionIcon}>{'\uD83D\uDC49'}</span>
        <span style={S.actionText}>{action}</span>
      </div>
    </section>
  );
}

// ─── Styles ──────────────────────────────────────────────────
//
// 30–40% of viewport height is achieved with `minHeight: 30vh`
// + flex layout that lets the content breathe. The card has its
// own slow fade-in animation (uses the global `farroway-fade-in`
// keyframes injected by index.css) so the transition from
// loading → loaded feels considered.

const S = {
  card: {
    width: '100%',
    maxWidth: '32rem',
    margin: '0 auto 12px',
    minHeight: '30vh',
    background: 'linear-gradient(160deg, rgba(14,165,233,0.18) 0%, rgba(11,29,52,0.95) 70%)',
    border: '1px solid rgba(14,165,233,0.30)',
    borderRadius: 20,
    padding: '20px 22px',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
    animation: 'farroway-fade-in 0.32s ease-out',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  icon: {
    fontSize: 56,
    lineHeight: 1,
    flexShrink: 0,
  },
  tempStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  temp: {
    fontSize: '2.25rem',
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  condition: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 6,
  },
  metaLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(255,255,255,0.55)',
  },
  metaValue: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  metaDot: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.95rem',
  },
  insightLine: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  insightIcon: {
    fontSize: 16,
    lineHeight: 1.2,
    flexShrink: 0,
  },
  insightText: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#FCD34D',
    lineHeight: 1.35,
  },
  actionLine: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  actionIcon: {
    fontSize: 16,
    lineHeight: 1.2,
    flexShrink: 0,
  },
  actionText: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#86EFAC',
    lineHeight: 1.35,
  },
};
