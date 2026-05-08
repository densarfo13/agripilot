/**
 * WeatherHeroActionCard — Home Screen weather hero with a single
 * recommended action and CTA. Replaces the read-only WeatherHero
 * card on Home with a larger, action-oriented version that drives
 * the next thing the user should do.
 *
 *   <WeatherHeroActionCard
 *     weather={liveWeather}
 *     mode="farm"           // or "garden"
 *     taskDone={false}      // when true, switches to "on track" copy
 *     onCta={() => …}       // primary CTA handler
 *   />
 *
 * Why a separate component
 * ────────────────────────
 *   The legacy WeatherHeroCard is a pure read-only summary used on
 *   secondary screens. This component is the ACTIONABLE hero used
 *   on Home — it shows the same realistic weather visual, but adds
 *   one short insight + one recommended action + one CTA. Keeping
 *   them separate avoids a prop-explosion and keeps the legacy
 *   surface stable for non-Home consumers.
 *
 * Copy
 * ────
 *   - Resolves an action from the live weather (rain/heat/wind/
 *     dry/cloudy/sunny/unknown).
 *   - Adapts the action copy for Farm vs Garden mode (drainage
 *     vs pots, field vs container, etc.).
 *   - When `taskDone`, replaces the action with a positive
 *     "on track today" message that still keeps the surface
 *     useful (offers a small secondary suggestion).
 *
 * Visuals
 * ───────
 *   - Reuses the existing .weather-hero / .weather-{type} CSS in
 *     src/index.css — same realistic backgrounds + animations,
 *     just sized larger and arranged for the action layout.
 *   - All animations are CSS-only (no JS loops) and respect
 *     prefers-reduced-motion via the global stylesheet.
 *
 * i18n
 * ────
 *   Every visible string uses tSafe() with a defensive English
 *   fallback. New keys live under weather.* / actions.* / home.*
 *   in src/i18n/locales/*.json.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Props are validated defensively (bad weather → unknown).
 *   • Action mapping is memoised.
 *   • Layout uses fixed flex sizing — no shift on data load.
 */

import React, { useMemo } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { getWeatherAction } from '../lib/weatherActionEngine.js';

// All types that have a CSS class in index.css.
const VALID_TYPES = new Set([
  'rain', 'heat', 'wind', 'dry',
  'sunny', 'cloudy', 'unknown', 'normal',
]);

/**
 * Resolve the canonical weather "type" we render for. Prefers the
 * live weatherType from the backend; falls back to the action
 * engine's numeric derivation; finally to "unknown" (calm leaf).
 */
function _resolveType(weather, action) {
  const wt = weather && typeof weather.weatherType === 'string'
    ? weather.weatherType : null;
  if (wt && VALID_TYPES.has(wt)) return wt;
  if (action && VALID_TYPES.has(action.type)) return action.type;
  return 'unknown';
}

/**
 * Farm vs Garden copy table. Each row provides:
 *   { titleKey, titleFallback,
 *     actionKey, actionFallback,           // farm copy
 *     gardenActionKey, gardenActionFallback,
 *     ctaKey, ctaFallback }
 *
 * Keys mirror the spec list (weather.rainLater, actions.checkDrainage,
 * etc.). Every key has a defensive English fallback so a missing
 * locale row never blanks the card.
 */
const COPY = Object.freeze({
  rain: {
    titleKey: 'weather.rainLater',
    titleFallback: 'Rain expected later',
    actionKey: 'actions.checkDrainage',
    actionFallback: 'Check drainage around your crop',
    gardenActionKey: 'actions.protectPots',
    gardenActionFallback: 'Move small pots away from heavy rain',
    ctaKey: 'actions.startCheck',
    ctaFallback: 'Start check',
  },
  heat: {
    titleKey: 'weather.warmAfternoon',
    titleFallback: 'Warm afternoon expected',
    actionKey: 'actions.checkSoilMoisture',
    actionFallback: 'Check field moisture early',
    gardenActionKey: 'actions.checkPotMoisture',
    gardenActionFallback: 'Small pots may dry quickly today',
    ctaKey: 'actions.startCheck',
    ctaFallback: 'Start check',
  },
  dry: {
    titleKey: 'weather.dryToday',
    titleFallback: 'Dry conditions today',
    actionKey: 'actions.waterIfDry',
    actionFallback: 'Water only if soil feels dry',
    gardenActionKey: 'actions.waterPotsIfDry',
    gardenActionFallback: 'Water pots only if the soil feels dry',
    ctaKey: 'actions.checkSoil',
    ctaFallback: 'Check soil',
  },
  wind: {
    titleKey: 'weather.windStress',
    titleFallback: 'Wind may stress plants',
    actionKey: 'actions.supportWeakPlants',
    actionFallback: 'Support weak stems in the field',
    gardenActionKey: 'actions.supportContainers',
    gardenActionFallback: 'Support weak stems or containers',
    ctaKey: 'actions.checkPlants',
    ctaFallback: 'Check plants',
  },
  cloudy: {
    titleKey: 'weather.goodQuickCheck',
    titleFallback: 'Good day for a quick check',
    actionKey: 'actions.inspectLeaves',
    actionFallback: 'Inspect leaves and soil moisture',
    gardenActionKey: 'actions.inspectLeavesGarden',
    gardenActionFallback: 'Inspect leaves and soil in your pots',
    ctaKey: 'actions.startCheck',
    ctaFallback: 'Start check',
  },
  sunny: {
    titleKey: 'weather.warmAndDry',
    titleFallback: 'Warm and dry',
    actionKey: 'actions.checkSoilMoisture',
    actionFallback: 'Check soil moisture before noon',
    gardenActionKey: 'actions.checkPotMoisture',
    gardenActionFallback: 'Check your pots before midday sun',
    ctaKey: 'actions.startCheck',
    ctaFallback: 'Start check',
  },
  normal: {
    titleKey: 'weather.goodQuickCheck',
    titleFallback: 'Good day for a quick check',
    actionKey: 'actions.inspectLeaves',
    actionFallback: 'Check your crop or plant today',
    gardenActionKey: 'actions.inspectLeavesGarden',
    gardenActionFallback: 'Check your plants and pots today',
    ctaKey: 'actions.startCheck',
    ctaFallback: 'Start check',
  },
  unknown: {
    titleKey: 'weather.goodQuickCheck',
    titleFallback: 'Good day for a quick check',
    actionKey: 'actions.inspectLeaves',
    actionFallback: 'Check your crop or plant today',
    gardenActionKey: 'actions.inspectLeavesGarden',
    gardenActionFallback: 'Check your plants and pots today',
    ctaKey: 'actions.startCheck',
    ctaFallback: 'Start check',
  },
});

export default function WeatherHeroActionCard({
  weather,
  mode = 'farm',
  taskDone = false,
  onCta = null,
  ctaLabelOverride = null,
  testId = 'weather-hero-action',
}) {
  // Memoise the validated weather object so the action useMemo
  // below has a stable dep — passing a fresh `{}` literal on
  // every render would otherwise invalidate the cache each time
  // (and trip react-hooks/exhaustive-deps).
  const w = useMemo(() => (
    (weather && typeof weather === 'object' && !Array.isArray(weather))
      ? weather
      : {}
  ), [weather]);

  // Action envelope from the numeric engine — gives us the icon
  // and a base type even when weather.weatherType is missing.
  const action = useMemo(() => {
    try { return getWeatherAction(w); }
    catch { return null; }
  }, [w]);

  const type = _resolveType(w, action);
  const isGarden = mode === 'garden';
  const copy = COPY[type] || COPY.unknown;

  // Display values — em-dash fallbacks so layout never collapses.
  const tempDisplay = (w.temp != null && Number.isFinite(Number(w.temp)))
    ? Math.round(Number(w.temp)) + '°'
    : '—°';

  const conditionDisplay = (typeof w.condition === 'string'
      && w.condition.trim()
      && w.condition !== 'Weather unavailable')
    ? w.condition
    : tSafe('weather.unavailable', 'Weather unavailable');

  const rainDisplay = (w.rainChance != null && Number.isFinite(Number(w.rainChance)))
    ? Number(w.rainChance) + '%'
    : '—';

  const windRaw = w.windSpeed != null ? w.windSpeed : w.wind;
  const windDisplay = (windRaw != null && Number.isFinite(Number(windRaw)))
    ? Number(windRaw) + ' km/h'
    : '—';

  const locationDisplay =
    (typeof w.locationLabel === 'string' && w.locationLabel.trim()
     && w.locationLabel !== 'Your area')
      ? w.locationLabel.trim()
    : (typeof w.location === 'string' && w.location.trim())
      ? w.location.trim()
    : tSafe('weather.yourArea', 'Your area');

  // Headline / action lines. When the user has already marked the
  // day's task done, we swap to a positive "on track" surface that
  // still offers a single optional secondary nudge so the page does
  // not feel dead.
  const headline = taskDone
    ? tSafe('home.onTrackToday', "You’re on track today ✓")
    : tSafe(copy.titleKey, copy.titleFallback);

  const actionLine = taskDone
    ? tSafe('home.checkTomorrow', 'Check again tomorrow morning.')
    : isGarden
      ? tSafe(copy.gardenActionKey, copy.gardenActionFallback)
      : tSafe(copy.actionKey, copy.actionFallback);

  const ctaLabel = ctaLabelOverride
    ? ctaLabelOverride
    : taskDone
      ? (isGarden
          ? tSafe('actions.scanPlant', 'Scan plant')
          : tSafe('actions.scanCrop', 'Scan crop'))
      : tSafe(copy.ctaKey, copy.ctaFallback);

  // Icon comes from the action envelope; fall back to a calm leaf.
  const icon = (action && action.icon) || '🌿';

  function handleCta() {
    if (typeof onCta === 'function') {
      try { onCta({ type, taskDone, mode }); }
      catch { /* swallow — UI must not crash */ }
    }
  }

  return (
    <section
      className={`weather-hero weather-hero-action weather-${type}`}
      data-testid={testId}
      data-weather-type={type}
      data-mode={mode}
      data-done={taskDone ? 'true' : 'false'}
      style={S.section}
    >
      {/* Reuses the existing CSS animation layer (rain drops, sun
          glow, wind streaks). Pure CSS — no JS loop, no per-frame
          render. Hidden behind prefers-reduced-motion. */}
      <div className="weather-bg-effect" aria-hidden="true" />

      <div className="weather-top" style={S.topRow}>
        <div className="weather-headline">
          <p className="eyebrow" style={S.eyebrow}>
            {tSafe('weather.todayWeather', 'Today’s Weather')}
          </p>
          <h1 style={S.tempLine}>
            <span className="weather-icon" aria-hidden="true">{icon}</span>
            {' '}
            {tempDisplay}
          </h1>
          <p className="weather-condition" style={S.condition}>
            {conditionDisplay}
          </p>
        </div>

        <div className="weather-location" style={S.location}>
          {locationDisplay}
        </div>
      </div>

      <div className="weather-stats" style={S.stats}>
        <span>
          <strong>{tSafe('weather.rain', 'Rain')}</strong> {rainDisplay}
        </span>
        <span>
          <strong>{tSafe('weather.wind', 'Wind')}</strong> {windDisplay}
        </span>
      </div>

      <div className="weather-action" style={S.actionBlock}>
        <h2 style={S.actionTitle} data-testid="weather-hero-action-title">
          {headline}
        </h2>
        <p style={S.actionLine} data-testid="weather-hero-action-line">
          {actionLine}
        </p>
        {typeof onCta === 'function' && (
          <button
            type="button"
            onClick={handleCta}
            style={S.cta}
            data-testid="weather-hero-action-cta"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </section>
  );
}

const S = {
  // The section uses the global .weather-hero class for backdrop +
  // animation. These inline rules add the larger Home sizing without
  // forking the CSS — the legacy WeatherHeroCard keeps its smaller
  // default look on other surfaces.
  section: {
    minHeight: '14.5rem',
    paddingBottom: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  topRow: {
    alignItems: 'flex-start',
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.6875rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 700,
    opacity: 0.78,
  },
  tempLine: {
    margin: '0.15rem 0 0',
    fontSize: '2.4rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.05,
  },
  condition: {
    margin: '0.15rem 0 0',
    fontSize: '0.95rem',
    fontWeight: 600,
    opacity: 0.85,
  },
  location: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    opacity: 0.75,
    paddingTop: '0.35rem',
  },
  stats: {
    fontSize: '0.85rem',
    opacity: 0.85,
  },
  actionBlock: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  actionTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '-0.005em',
    color: 'rgba(255,255,255,0.96)',
  },
  actionLine: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.45,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
    padding: '0.78rem 1.25rem',
    border: 'none',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.92)',
    color: '#0B1D34',
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: 44,
    boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
    letterSpacing: '0.005em',
  },
};
