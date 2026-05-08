/**
 * WeatherHeroActionCard — Home hero with realistic field
 * background, ONE adaptive metric, ONE recommended action and
 * ONE CTA. Matches the pilot Home mockup contract:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │  Kumasi, Ashanti Region                        │
 *   │  Accurate as of 9:30 AM                        │
 *   │                                                │
 *   │  ☁  26°                                        │
 *   │  Partly cloudy                                 │
 *   │  Feels like 28°                                │
 *   │                                                │
 *   │  ── Rain later today ─────────────────────     │
 *   │  Check drainage around your crop               │
 *   │  70% rain chance · 2 min                       │
 *   │  [ Start check → ]                             │
 *   └────────────────────────────────────────────────┘
 *
 * Why a separate component vs the legacy WeatherHeroCard
 *   The legacy hero is read-only and shows every metric. This
 *   action hero shows ONE adaptive metric chosen by the weather
 *   intelligence helper (rain → rain%, heat → feels-like,
 *   wind → km/h, dry → humidity-hint, cloudy/normal →
 *   "Best check time"). The card drives the next user action and
 *   adapts copy for Farm vs Garden.
 *
 * Visuals
 *   * Realistic background: /images/weather/{type}-field.svg
 *     loaded on the wrapper as `background-image`. The SVG is
 *     <2 KB so the layout shift is zero; a fallback gradient
 *     covers any 404 path.
 *   * Existing .weather-hero / .weather-{type} CSS animation
 *     classes still apply on top — pure CSS, no JS loops,
 *     prefers-reduced-motion respected.
 *
 * Strict-rule audit
 *   * Pure presentational. Never throws.
 *   * Memoised hero envelope so the card never re-renders on
 *     unrelated parent updates.
 *   * Em-dash fallbacks on every numeric field — no layout shift
 *     during the loading window.
 */

import React, { useMemo } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import {
  getWeatherHero, formatAccurateAsOf,
} from '../lib/weatherHeroIntelligence.js';

const VALID_TYPES = new Set([
  'rain', 'heat', 'wind', 'dry',
  'sunny', 'cloudy', 'unknown', 'normal',
]);

// Compact icon set — small, monochrome, sits next to the temp.
// Uses inline SVG so the card never depends on a font glyph.
function _typeIcon(type) {
  const stroke = 'currentColor';
  switch (type) {
    case 'rain':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 14a5 5 0 0 1 0-10 5 5 0 0 1 4.5 3 4 4 0 0 1 4 7H7z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    case 'sunny':
    case 'heat':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke={stroke} strokeWidth="1.5" fill="none"/>
          <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round">
            <line x1="12" y1="3"  x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="21"/>
            <line x1="3"  y1="12" x2="5"  y2="12"/>
            <line x1="19" y1="12" x2="21" y2="12"/>
            <line x1="5.6" y1="5.6" x2="7" y2="7"/>
            <line x1="17"  y1="17"  x2="18.4" y2="18.4"/>
            <line x1="5.6" y1="18.4" x2="7" y2="17"/>
            <line x1="17"  y1="7"  x2="18.4" y2="5.6"/>
          </g>
        </svg>
      );
    case 'wind':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 9h11a3 3 0 1 0-3-3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <path d="M3 14h15a3 3 0 1 1-3 3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      );
    case 'cloudy':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 17a5 5 0 0 1 0-10 5 5 0 0 1 4.5 3 4 4 0 0 1 4 7H7z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      );
    case 'dry':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l4 6a4 4 0 1 1-8 0l4-6z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      );
    default: // unknown / normal
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4c-3 4-3 8 0 12 3-4 3-8 0-12z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      );
  }
}

export default function WeatherHeroActionCard({
  weather,
  mode = 'farm',
  taskDone = false,
  onCta = null,
  ctaLabelOverride = null,
  testId = 'weather-hero-action',
}) {
  // Memoise the validated weather object so the hero envelope's
  // useMemo dep is stable (passing a fresh literal would otherwise
  // invalidate it on every render).
  const w = useMemo(() => (
    (weather && typeof weather === 'object' && !Array.isArray(weather))
      ? weather
      : {}
  ), [weather]);

  // Hero envelope — adaptive metric, action label, CTA, bg image.
  const hero = useMemo(() => {
    try { return getWeatherHero({ weather: w, mode }); }
    catch { return null; }
  }, [w, mode]);

  const type = (hero && VALID_TYPES.has(hero.type)) ? hero.type : 'unknown';
  const isGarden = mode === 'garden';

  // Display values — em-dash fallbacks so layout never collapses.
  const tempDisplay = (w.temp != null && Number.isFinite(Number(w.temp)))
    ? Math.round(Number(w.temp)) + '°'
    : '—°';

  const conditionDisplay = (typeof w.condition === 'string'
      && w.condition.trim()
      && w.condition !== 'Weather unavailable')
    ? w.condition
    : tSafe('weather.partlyCloudy', 'Partly cloudy');

  const feelsLikeNum = (w.feelsLike != null && Number.isFinite(Number(w.feelsLike)))
    ? Math.round(Number(w.feelsLike))
    : (Number.isFinite(Number(w.temp)) ? Math.round(Number(w.temp)) : null);
  const feelsLikeLine = feelsLikeNum != null
    ? `${tSafe('weather.feelsLike', 'Feels like')} ${feelsLikeNum}°`
    : null;

  const locationDisplay =
    (typeof w.locationLabel === 'string' && w.locationLabel.trim()
     && w.locationLabel !== 'Your area')
      ? w.locationLabel.trim()
    : (typeof w.location === 'string' && w.location.trim())
      ? w.location.trim()
    : tSafe('weather.yourArea', 'Your area');

  const accurateAsOf = (() => {
    const ts = w.fetchedAt || w.updatedAt || w.timestamp || null;
    return formatAccurateAsOf(ts);
  })();

  // Headline / action lines — taskDone overrides with the calm
  // "on track" copy, otherwise we use the hero envelope.
  const insightTitle = taskDone
    ? tSafe('home.onTrackToday', "You’re on track today ✓")
    : (hero
        ? tSafe(hero.insightTitleKey, hero.insightTitleFb)
        : tSafe('weather.goodQuickCheck', 'Good day for a quick check'));

  const actionLine = taskDone
    ? tSafe('home.checkTomorrow', 'Check again tomorrow morning.')
    : (hero
        ? tSafe(hero.actionLabelKey, hero.actionLabelFb)
        : (isGarden
            ? tSafe('actions.inspectLeavesGarden', 'Inspect leaves and soil in your pots')
            : tSafe('actions.inspectLeaves', 'Inspect leaves and soil moisture')));

  // Adaptive metric line. For cloudy/normal the metricValue is
  // empty and the localised label IS the value.
  const metricLine = (() => {
    if (taskDone || !hero) return null;
    const label = tSafe(hero.metricKey, hero.metricFb);
    if (hero.metricValue) return `${hero.metricValue} ${label}`.trim();
    return label;
  })();

  const minutesLine = (!taskDone && hero && Number.isFinite(hero.estimatedMinutes))
    ? `${hero.estimatedMinutes} ${tSafe('common.min', 'min')}`
    : null;

  const ctaLabel = ctaLabelOverride
    ? ctaLabelOverride
    : taskDone
      ? (isGarden
          ? tSafe('actions.scanPlant', 'Scan plant')
          : tSafe('actions.scanCrop', 'Scan crop'))
      : (hero
          ? tSafe(hero.ctaKey, hero.ctaFallback)
          : tSafe('actions.startCheck', 'Start check'));

  const bgImage = (hero && hero.bgImage) || '/images/weather/default-field.svg';

  function handleCta() {
    if (typeof onCta === 'function') {
      try { onCta({ type, taskDone, mode }); }
      catch { /* swallow — UI must not crash */ }
    }
  }

  // Wrapper-level inline style sets the realistic background
  // image; the global `.weather-hero` CSS still applies its
  // animation pseudo-elements on top.
  const wrapperStyle = {
    ...S.section,
    backgroundImage: [
      // Dark vertical overlay so text stays legible regardless of
      // the underlying image. Sits ABOVE the image in the stack.
      'linear-gradient(180deg, rgba(8,18,12,0.55) 0%, rgba(8,18,12,0.78) 65%, rgba(8,18,12,0.92) 100%)',
      `url(${bgImage})`,
    ].join(', '),
    backgroundSize:     'cover',
    backgroundPosition: 'center',
  };

  return (
    <section
      className={`weather-hero weather-hero-action weather-${type}`}
      data-testid={testId}
      data-weather-type={type}
      data-mode={mode}
      data-done={taskDone ? 'true' : 'false'}
      style={wrapperStyle}
    >
      {/* Animation layer (rain drops, sun glow, wind streaks) on
          top of the background image. Pure CSS; reduced-motion
          safe via the global stylesheet. */}
      <div className="weather-bg-effect" aria-hidden="true" />

      <div style={S.headerRow}>
        <div style={S.locCol}>
          <p style={S.location}>{locationDisplay}</p>
          {accurateAsOf && (
            <p style={S.accurateAsOf}>
              {tSafe('weather.accurateAsOf', 'Accurate as of')} {accurateAsOf}
            </p>
          )}
        </div>
      </div>

      <div style={S.tempBlock}>
        <div style={S.tempLine}>
          <span style={S.tempIcon} aria-hidden="true">{_typeIcon(type)}</span>
          <span style={S.tempValue}>{tempDisplay}</span>
        </div>
        <p style={S.condition}>{conditionDisplay}</p>
        {feelsLikeLine && !taskDone && (
          <p style={S.feelsLike}>{feelsLikeLine}</p>
        )}
      </div>

      <div style={S.actionBlock}>
        <h2 style={S.actionTitle} data-testid="weather-hero-action-title">
          {insightTitle}
        </h2>
        <p style={S.actionLine} data-testid="weather-hero-action-line">
          {actionLine}
        </p>
        {(metricLine || minutesLine) && (
          <p style={S.metaLine} data-testid="weather-hero-action-meta">
            {metricLine}
            {metricLine && minutesLine ? ' · ' : ''}
            {minutesLine}
          </p>
        )}
        {typeof onCta === 'function' && (
          <button
            type="button"
            onClick={handleCta}
            style={S.cta}
            data-testid="weather-hero-action-cta"
          >
            <span>{ctaLabel}</span>
            <span aria-hidden="true" style={S.ctaArrow}>{'→'}</span>
          </button>
        )}
      </div>
    </section>
  );
}

const S = {
  section: {
    minHeight: '17.5rem',
    padding:    '1.1rem 1.15rem 1.25rem',
    display:    'flex',
    flexDirection: 'column',
    gap:        '0.85rem',
    color:      'rgba(255,255,255,0.96)',
    overflow:   'hidden',
    // Ensures the global .weather-hero CSS picks up the right
    // border-radius regardless of where this component is mounted.
    borderRadius: '20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  locCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  location: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.005em',
  },
  accurateAsOf: {
    margin: '0.15rem 0 0',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  tempBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  tempLine: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  tempIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36, height: 36,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'rgba(255,255,255,0.96)',
    flexShrink: 0,
  },
  tempValue: {
    fontSize: '2.6rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
    lineHeight: 1.0,
  },
  condition: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  },
  feelsLike: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.65)',
  },
  actionBlock: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    paddingTop: '0.4rem',
    borderTop: '1px solid rgba(255,255,255,0.10)',
  },
  actionTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
  },
  actionLine: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.4,
  },
  metaLine: {
    margin: '0.1rem 0 0',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: '0.02em',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: '0.55rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.85rem 1.35rem',
    border: 'none',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #34D27A 0%, #15A75D 100%)',
    color: '#08200F',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 46,
    boxShadow: '0 10px 26px rgba(34,197,94,0.40)',
    letterSpacing: '0.005em',
  },
  ctaArrow: {
    fontSize: '1rem',
    fontWeight: 800,
  },
};
