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

import React, { useMemo, useState } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import {
  getWeatherHero, formatAccurateAsOf,
} from '../lib/weatherHeroIntelligence.js';
import { PREMIUM_TOKENS as T } from './premium/tokens.js';
import {
  resolveScene,
  DynamicWeatherBackdrop,
} from '../features/weather/environment/index.js';
// Real weather state imagery (operator-uploaded under
// public/assets/realism/weather/). Bypasses the slot manifest
// for now so the photo lands without filesystem reorganisation.
import { resolveWeatherImage } from '../lib/realVisuals.jsx';

const VALID_TYPES = new Set([
  'rain', 'heat', 'wind', 'dry',
  'sunny', 'cloudy', 'unknown', 'normal',
]);

// Adaptive metric icon — sits inside the dark pill at the bottom-
// left of the action block. Type-aware so a rain card shows the
// drop, a heat card shows a sun, etc. Returns a 14px inline SVG.
function _metricIcon(type) {
  const stroke = 'currentColor';
  switch (type) {
    case 'rain':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"
                fill="rgba(110,180,235,0.95)" stroke={stroke} strokeWidth="0"/>
        </svg>
      );
    case 'heat':
    case 'sunny':
    case 'dry':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="rgba(255,205,120,0.95)"/>
          <g stroke="rgba(255,205,120,0.95)" strokeWidth="1.6" strokeLinecap="round">
            <line x1="12" y1="3"  x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="21"/>
            <line x1="3"  y1="12" x2="5"  y2="12"/>
            <line x1="19" y1="12" x2="21" y2="12"/>
          </g>
        </svg>
      );
    case 'wind':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 9h11a3 3 0 1 0-3-3" stroke="rgba(190,220,235,0.95)" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
          <path d="M3 14h15a3 3 0 1 1-3 3" stroke="rgba(190,220,235,0.95)" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
        </svg>
      );
    case 'cloudy':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 17a5 5 0 0 1 0-10 5 5 0 0 1 4.5 3 4 4 0 0 1 4 7H7z"
                fill="rgba(190,200,210,0.85)"/>
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="rgba(180,220,200,0.85)" strokeWidth="1.6" fill="none"/>
          <path d="M12 7v5l3 2" stroke="rgba(180,220,200,0.85)" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      );
  }
}

// Hero weather glyph — sits ABOVE the temperature in the mockup.
// Sized at ~64px and uses warm/cool fills so it reads as a 3D
// icon over the photo background. Each branch returns a single
// inline SVG so the component never depends on a font glyph.
function _typeIcon(type) {
  switch (type) {
    case 'rain':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M16 30a10 10 0 0 1 0-20 10 10 0 0 1 9 6 8 8 0 0 1 7 14H16z"
                fill="#E5E9EE" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8"/>
          <g stroke="#7CC8F0" strokeWidth="2.4" strokeLinecap="round">
            <line x1="20" y1="40" x2="17" y2="48"/>
            <line x1="30" y1="40" x2="27" y2="48"/>
            <line x1="40" y1="40" x2="37" y2="48"/>
            <line x1="50" y1="40" x2="47" y2="48"/>
          </g>
        </svg>
      );
    case 'sunny':
    case 'heat':
    case 'dry':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="sun3d" cx="40%" cy="35%" r="60%">
              <stop offset="0%"  stop-color="#FFE699"/>
              <stop offset="60%" stop-color="#F5B742"/>
              <stop offset="100%" stop-color="#D88E1C"/>
            </radialGradient>
          </defs>
          <g stroke="#F5B742" strokeWidth="3" strokeLinecap="round">
            <line x1="32" y1="6"  x2="32" y2="12"/>
            <line x1="32" y1="52" x2="32" y2="58"/>
            <line x1="6"  y1="32" x2="12" y2="32"/>
            <line x1="52" y1="32" x2="58" y2="32"/>
            <line x1="13" y1="13" x2="17" y2="17"/>
            <line x1="47" y1="47" x2="51" y2="51"/>
            <line x1="13" y1="51" x2="17" y2="47"/>
            <line x1="47" y1="17" x2="51" y2="13"/>
          </g>
          <circle cx="32" cy="32" r="13" fill="url(#sun3d)" stroke="rgba(0,0,0,0.10)" strokeWidth="1"/>
        </svg>
      );
    case 'wind':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <g stroke="#E1ECF2" strokeWidth="3.4" strokeLinecap="round" fill="none">
            <path d="M8 22h32a8 8 0 1 0-8-8"/>
            <path d="M8 34h40a8 8 0 1 1-8 8"/>
            <path d="M8 46h22"/>
          </g>
        </svg>
      );
    case 'cloudy':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="cloudFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFFFF"/>
              <stop offset="100%" stop-color="#C8CFD8"/>
            </linearGradient>
          </defs>
          <path d="M18 44a12 12 0 0 1 0-24 12 12 0 0 1 11 7 10 10 0 0 1 9 17H18z"
                fill="url(#cloudFill)" stroke="rgba(0,0,0,0.10)" strokeWidth="1"/>
        </svg>
      );
    default: // unknown / normal — partly-cloudy 3D combo (matches mockup)
      return (
        <svg width="68" height="56" viewBox="0 0 68 56" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="sunPC" cx="40%" cy="35%" r="60%">
              <stop offset="0%"  stop-color="#FFE699"/>
              <stop offset="60%" stop-color="#F5B742"/>
              <stop offset="100%" stop-color="#D88E1C"/>
            </radialGradient>
            <linearGradient id="cloudPC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FFFFFF"/>
              <stop offset="100%" stop-color="#C8CFD8"/>
            </linearGradient>
          </defs>
          <g stroke="#F5B742" strokeWidth="2.6" strokeLinecap="round">
            <line x1="14" y1="2"  x2="14" y2="6"/>
            <line x1="2"  y1="14" x2="6"  y2="14"/>
            <line x1="6"  y1="6"  x2="9"  y2="9"/>
            <line x1="22" y1="6"  x2="19" y2="9"/>
          </g>
          <circle cx="14" cy="14" r="9" fill="url(#sunPC)" stroke="rgba(0,0,0,0.10)" strokeWidth="0.8"/>
          <path d="M22 46a10 10 0 0 1 0-20 10 10 0 0 1 9 6 8 8 0 0 1 7 14H22z"
                fill="url(#cloudPC)" stroke="rgba(0,0,0,0.10)" strokeWidth="1"/>
        </svg>
      );
  }
}

export default function WeatherHeroActionCard({
  weather,
  mode = 'farm',
  taskDone = false,
  onCta = null,
  onUseMyLocation = null,
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

  // Trust gate — only render numeric temperature when the data
  // genuinely came from the weather API. A fallback / unavailable
  // envelope can carry a numeric `temp: 0` from upstream
  // serialisation; treating it as real produces the "0° on fresh
  // boot" bug operators reported. When the source isn't
  // 'weather-api', we render the em-dash placeholder + the "Add
  // location" prompt path takes over below.
  const _hasRealData = String(w.source || '') === 'weather-api'
    && w.temp != null
    && Number.isFinite(Number(w.temp))
    && typeof w.condition === 'string'
    && w.condition.trim()
    && w.condition !== 'Weather unavailable';

  // Display values — em-dash fallbacks so layout never collapses.
  const tempDisplay = _hasRealData
    ? Math.round(Number(w.temp)) + '°'
    : '—°';

  const conditionDisplay = _hasRealData
    ? w.condition
    : tSafe('weather.addLocation', 'Add location for accurate weather.');

  const feelsLikeNum = _hasRealData
    ? ((w.feelsLike != null && Number.isFinite(Number(w.feelsLike)))
        ? Math.round(Number(w.feelsLike))
        : Math.round(Number(w.temp)))
    : null;
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

  // Dynamic Realistic Weather Environment (May 2026 §1-§14) —
  // the static SVG `bgImage` returned by getWeatherHero is now
  // a fallback only. The canonical backdrop is the region/time/
  // season/mode-aware scene resolved via resolveScene(), rendered
  // by <DynamicWeatherBackdrop> with crossfade transition + calm
  // fallback when the real photo isn't on disk yet.
  const scene = useMemo(() => {
    const now = (() => { try { return new Date(); } catch { return null; } })();
    return resolveScene({
      weather: w,
      hour:    now ? now.getHours() : undefined,
      month:   now ? (now.getMonth() + 1) : undefined,
      country: w.country || w.countryCode || '',
      region:  w.regionName || w.region || '',
      mode,
    });
  }, [w, mode]);

  // Real weather state imagery — pulls from public/assets/realism/
  // weather/*.webp.jpeg via the resolver. Maps rain/storm/drought/
  // misty → matching photo. When type doesn't map (or the image
  // fails to load), the existing DynamicWeatherBackdrop stays as
  // the visible layer.
  const realWeatherSrc = useMemo(() => resolveWeatherImage(type), [type]);
  const [realWeatherErrored, setRealWeatherErrored] = useState(false);

  function handleCta() {
    if (typeof onCta === 'function') {
      try { onCta({ type, taskDone, mode }); }
      catch { /* swallow — UI must not crash */ }
    }
  }

  return (
    <DynamicWeatherBackdrop
      scene={scene}
      altText={`${type} scene`}
      rounded={22}
      testId={`${testId}-backdrop`}
      style={{ minHeight: '19rem' }}
    >
    <section
      className={`weather-hero weather-hero-action weather-${type}`}
      data-testid={testId}
      data-weather-type={type}
      data-mode={mode}
      data-done={taskDone ? 'true' : 'false'}
      data-real-photo={realWeatherSrc && !realWeatherErrored ? 'true' : 'false'}
      style={S.section}
    >
      {/* Real weather photograph — sits behind every content
          layer so the existing DynamicWeatherBackdrop, CSS
          animation layer, and section text all paint over it.
          When the photo errors / no real image fits, the
          existing dynamic backdrop remains the visible layer. */}
      {realWeatherSrc && !realWeatherErrored && (
        <img
          src={realWeatherSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setRealWeatherErrored(true)}
          style={S.realWeatherPhoto}
          aria-hidden="true"
          data-testid={`${testId}-real-photo`}
        />
      )}
      {/* Animation layer (rain drops, sun glow, wind streaks) on
          top of the background image. Pure CSS; reduced-motion
          safe via the global stylesheet. */}
      <div className="weather-bg-effect" aria-hidden="true" />

      <div style={S.headerRow}>
        <div style={S.locRow}>
          <span style={S.locPin} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"
                    stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round"/>
              <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
            </svg>
          </span>
          <span style={S.location}>{locationDisplay}</span>
        </div>
        {accurateAsOf && (
          <div style={S.accurateRow}>
            <span style={S.accurateAsOf}>
              {tSafe('weather.accurateAsOf', 'Accurate as of')} {accurateAsOf}
            </span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={S.refreshIcon}>
              <path d="M3 12a9 9 0 0 1 16-5.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
              <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M21 12a9 9 0 0 1-16 5.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
              <path d="M5 20v-4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        )}
      </div>

      <div style={S.tempBlock}>
        {/* Hero glyph above the temperature — only renders when we
            have real weather data. The previous build painted a
            3D sun/cloud/rain icon even on an empty fallback,
            which looked like a fake placeholder graphic on a
            fresh account. When _hasRealData is false the card
            shows the "Add location" prompt + the inline GPS CTA
            below instead. */}
        {_hasRealData && (
          <span style={S.heroIcon} aria-hidden="true">{_typeIcon(type)}</span>
        )}
        {_hasRealData ? (
          <>
            <span style={S.tempValue}>{tempDisplay}</span>
            <p style={S.condition}>{conditionDisplay}</p>
            {feelsLikeLine && !taskDone && (
              <p style={S.feelsLike}>{feelsLikeLine}</p>
            )}
          </>
        ) : (
          <div style={S.locationPrompt} data-testid="weather-hero-location-prompt">
            <p style={S.locationPromptTitle}>
              {tSafe('weather.addLocationTitle', 'Add location to unlock weather tips')}
            </p>
            <p style={S.locationPromptBody}>
              {tSafe(
                'weather.addLocationBody',
                'Live temperature, rain chance, and best action time appear once we know where your crop is.',
              )}
            </p>
            {typeof onUseMyLocation === 'function' && (
              <button
                type="button"
                onClick={() => { try { onUseMyLocation(); } catch { /* swallow */ } }}
                style={S.locationCta}
                data-testid="weather-hero-use-my-location"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"
                        stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round"/>
                  <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
                </svg>
                <span>{tSafe('weather.useMyLocation', 'Use my location')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div style={S.actionBlock}>
        {/* Layout: two-column row matching the May 2026 premium
            mockup. Left column carries the title + subtitle +
            adaptive-metric chip; right column carries the
            "X min" estimate pill and the primary CTA stacked. */}
        <div style={S.actionRow}>
          <div style={S.actionLeft}>
            <h2 style={S.actionTitle} data-testid="weather-hero-action-title">
              {insightTitle}
            </h2>
            <p style={S.actionLine} data-testid="weather-hero-action-line">
              {actionLine}
            </p>
            {!taskDone && hero && _hasRealData && (
              <div style={S.metricChip} data-testid="weather-hero-action-meta">
                <span style={S.metricIconWrap} aria-hidden="true">
                  {_metricIcon(type)}
                </span>
                <span style={S.metricLabel}>
                  {hero.metricValue
                    ? `${hero.metricValue} ${tSafe(hero.metricKey, hero.metricFb)}`
                    : tSafe(hero.metricKey, hero.metricFb)}
                </span>
              </div>
            )}
          </div>

          <div style={S.actionRight}>
            {minutesLine && (
              <div style={S.timePill} data-testid="weather-hero-action-time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" fill="none"/>
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
                <span>{minutesLine}</span>
              </div>
            )}
            {/* May 2026 Garden Home refinement (spec §3) — the
                inline CTA that used to live here was a second
                copy of the same `Start check` button rendered
                full-width below. Two CTAs with identical
                handler + label = exactly the duplication the
                spec calls out. The bottom CTA stays as the
                canonical primary action. */}
          </div>
        </div>

        {/* Hidden meta text — preserved for older a11y queries
            and tests that grep for the line. Visible content is
            the chip + pill above. */}
        {(metricLine || minutesLine) && (
          <p style={{ ...S.metaLine, position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
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
    </DynamicWeatherBackdrop>
  );
}

const S = {
  // May 2026 Garden Home refinement (spec §2) — minHeight
  // dropped from 24rem to 19rem (~21% reduction). The card
  // was carrying ~5rem of empty atmosphere padding the spec
  // explicitly flagged. Bottom padding also tightened from
  // 1.25 to 1rem so the CTA sits closer to the action content.
  section: {
    minHeight: '19rem',
    padding:    '1.15rem 1.2rem 1rem',
    display:    'flex',
    flexDirection: 'column',
    gap:        '0.7rem',
    color:      'rgba(255,255,255,0.96)',
    overflow:   'hidden',
    position:   'relative',
    // Ensures the global .weather-hero CSS picks up the right
    // border-radius regardless of where this component is mounted.
    borderRadius: '22px',
  },
  // Real weather state photo — absolute fill, sits underneath
  // the content + the existing CSS animation layer + the
  // bottom-gradient. The card text reads cleanly because the
  // gradient overlay in the global .weather-hero CSS still
  // darkens the lower half.
  realWeatherPhoto: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
    pointerEvents: 'none',
    // Subtle filter to integrate with the dark companion theme
    // — drops saturation slightly so the photo doesn't fight the
    // ochre/olive caption palette. Real photographs from the
    // operator upload are already well-composed; this is a 5%
    // tonal adjustment, not a stylization.
    filter: 'saturate(0.92) brightness(0.86)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    position: 'relative',
    zIndex: 1,
  },
  locRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'rgba(255,255,255,0.95)',
  },
  locPin: {
    display: 'inline-flex',
    color: 'rgba(255,255,255,0.92)',
  },
  location: {
    fontSize: '0.92rem',
    fontWeight: 700,
    letterSpacing: '0.005em',
  },
  accurateRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'rgba(255,255,255,0.78)',
  },
  accurateAsOf: {
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.005em',
  },
  refreshIcon: {
    flexShrink: 0,
  },
  tempBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    marginTop: '0.4rem',
    position: 'relative',
    zIndex: 1,
  },
  heroIcon: {
    display: 'inline-flex',
    marginBottom: '0.45rem',
    filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.45))',
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
    width: 0,
    height: 0,
    overflow: 'hidden',
    flexShrink: 0,
    // Visible icon is rendered above the temperature, NOT next
    // to it (mockup style). Kept as a hidden node so existing
    // a11y queries that grep for the inline SVG still resolve.
  },
  tempValue: {
    fontSize: '4rem',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    lineHeight: 1.0,
    color: '#FFFFFF',
    textShadow: '0 2px 18px rgba(0,0,0,0.55)',
  },
  condition: {
    margin: '0.15rem 0 0',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.96)',
    textShadow: '0 1px 10px rgba(0,0,0,0.45)',
  },
  feelsLike: {
    margin: '0.15rem 0 0',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.78)',
  },
  // Empty-state replacement for the fake 3D weather glyph +
  // temperature stack. Renders when _hasRealData is false so the
  // user sees a calm prompt + GPS CTA instead of placeholder art.
  locationPrompt: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: '22rem',
    marginTop: '0.3rem',
  },
  locationPromptTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: 'rgba(255,255,255,0.97)',
    lineHeight: 1.25,
    textShadow: '0 1px 12px rgba(0,0,0,0.45)',
  },
  locationPromptBody: {
    margin: 0,
    fontSize: '0.86rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.4,
  },
  locationCta: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.55rem 0.95rem',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  actionBlock: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '0.85rem',
    borderTop: '1px solid rgba(255,255,255,0.16)',
    position: 'relative',
    zIndex: 1,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '0.65rem',
  },
  actionLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    minWidth: 0,
    flex: 1,
  },
  actionRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.55rem',
    flexShrink: 0,
  },
  actionTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: 'rgba(255,255,255,0.98)',
    lineHeight: 1.2,
  },
  actionLine: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 1.4,
  },
  metricChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    marginTop: '0.15rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.92)',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(8,18,28,0.55)',
    border: '1px solid rgba(255,255,255,0.10)',
    flexShrink: 0,
  },
  metricLabel: {
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  timePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    // Soft-ochre estimate text — warm amber on the dark photo.
    color: '#F5C97D',
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.01em',
    padding: '0 0.1rem',
  },
  metaLine: {
    margin: '0.1rem 0 0',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: '0.02em',
  },
  // Ochre primary CTA (Soft Ochre design system, May 2026).
  // Reads from PREMIUM_TOKENS so a future palette update flows
  // here without a code change. Reserves green for health/growth
  // signals only — primary actions live on the ochre gradient.
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.95rem 1.45rem',
    border: 'none',
    borderRadius: '999px',
    background: `linear-gradient(180deg, ${T.ochre} 0%, ${T.ochreActive} 100%)`,
    color: '#FFFFFF',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 50,
    minWidth: 168,
    justifyContent: 'center',
    boxShadow: '0 10px 28px rgba(185,133,63,0.40)',
    letterSpacing: '0.005em',
  },
  ctaArrow: {
    fontSize: '1.15rem',
    fontWeight: 800,
    lineHeight: 1,
    marginLeft: '0.15rem',
  },
};
