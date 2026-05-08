/**
 * weatherHeroIntelligence.js — adaptive weather → home-hero envelope.
 *
 *   import { getWeatherHero } from './lib/weatherHeroIntelligence.js';
 *
 *   const hero = getWeatherHero({
 *     weather, mode, crop, cropStage, region, recentScan,
 *   });
 *
 *   // hero shape:
 *   //   type             — 'rain' | 'heat' | 'wind' | 'dry'
 *   //                    | 'cloudy' | 'sunny' | 'unknown'
 *   //   insightTitleKey  — i18n key
 *   //   insightTitleFb   — English fallback
 *   //   actionLabelKey
 *   //   actionLabelFb
 *   //   metricKey        — adaptive metric label (i18n)
 *   //   metricValue      — formatted number/string
 *   //   ctaKey
 *   //   ctaFallback
 *   //   estimatedMinutes — number (rounded)
 *   //   bgImage          — '/images/weather/<type>-field.svg'
 *
 * Why this is distinct from weatherActionEngine.js
 *   getWeatherAction returns a richer task envelope (taskTitle,
 *   reason, urgency) that lives on the today-task surface. This
 *   helper returns ONLY what the home weather hero renders — one
 *   adaptive metric, one insight, one action — and decides which
 *   metric is the relevant one for the current weather type
 *   (rain → rain%, heat → feels-like, wind → km/h, dry → humidity,
 *   cloudy/normal → "Best check time").
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Bad input → falls through to the unknown branch.
 *   • All output strings come back as { key, fallback } pairs so
 *     the renderer can run them through tSafe() for translation.
 *   • Estimated minutes is a fixed-per-type small number — never
 *     a free-text string — so layout never shifts.
 */

const TYPE_BG = Object.freeze({
  rain:    '/images/weather/rain-field.svg',
  heat:    '/images/weather/heat-field.svg',
  wind:    '/images/weather/wind-field.svg',
  dry:     '/images/weather/dry-field.svg',
  cloudy:  '/images/weather/cloudy-field.svg',
  sunny:   '/images/weather/sunny-field.svg',
  normal:  '/images/weather/default-field.svg',
  unknown: '/images/weather/default-field.svg',
});

/**
 * Resolve the canonical weather "type" we render for. Prefers the
 * live weatherType from the backend; falls back to the numeric
 * derivation from rainChance/temp/wind; finally to "unknown".
 */
function _resolveType(w) {
  const known = new Set(['rain','heat','wind','dry','cloudy','sunny','normal','unknown']);
  const wt = w && typeof w.weatherType === 'string' ? w.weatherType : null;
  if (wt && known.has(wt)) return wt;

  const rain = Number(w && w.rainChance);
  const temp = Number(w && w.temp);
  const wind = Number(w && (w.windSpeed != null ? w.windSpeed : w.wind));
  const cond = String(w && w.condition || '').toLowerCase();

  if ((Number.isFinite(rain) && rain >= 60) || cond.includes('rain')) return 'rain';
  if (Number.isFinite(temp) && temp >= 32)                            return 'heat';
  if ((Number.isFinite(wind) && wind >= 25) || cond.includes('wind')) return 'wind';
  if (Number.isFinite(rain) && rain <= 20)                            return 'dry';
  if (cond.includes('cloud'))                                         return 'cloudy';
  if (cond.includes('sun')  || cond.includes('clear'))                return 'sunny';
  return 'unknown';
}

/**
 * Compute the "feels like" approximation when the API doesn't
 * provide one. Uses a tiny offset based on temp + wind / humidity
 * so the value still tracks the live weather without claiming to
 * be an actual heat-index calculation.
 */
function _feelsLike(w) {
  const explicit = Number(w && w.feelsLike);
  if (Number.isFinite(explicit)) return Math.round(explicit);
  const temp = Number(w && w.temp);
  if (!Number.isFinite(temp)) return null;
  const wind = Number(w && (w.windSpeed != null ? w.windSpeed : w.wind));
  const offset =
    (Number.isFinite(wind) && wind >= 20) ? -2
      : (temp >= 30) ? +2
      : 0;
  return Math.round(temp + offset);
}

/**
 * "Best check time" hint for cloudy/normal/unknown branches —
 * coarse but useful: morning before 10, midday slot, or late
 * afternoon depending on current local hour.
 */
function _bestCheckTime() {
  let h = 9;
  try { h = new Date().getHours(); } catch { /* swallow */ }
  if (h < 10)  return { key: 'weather.bestCheckMorning',   fallback: 'Best before 10 AM' };
  if (h < 14)  return { key: 'weather.bestCheckMidday',    fallback: 'Best around midday' };
  return         { key: 'weather.bestCheckAfternoon', fallback: 'Best late afternoon' };
}

/**
 * getWeatherHero(params) → hero envelope for the home card.
 */
export function getWeatherHero(params) {
  const p = (params && typeof params === 'object') ? params : {};
  const w = (p.weather && typeof p.weather === 'object') ? p.weather : {};
  const mode = p.mode === 'garden' ? 'garden' : 'farm';
  const isGarden = mode === 'garden';

  const type = _resolveType(w);
  const bgImage = TYPE_BG[type] || TYPE_BG.unknown;

  // Common values used by multiple branches.
  const rainPct = Number.isFinite(Number(w.rainChance)) ? Number(w.rainChance) : null;
  const wind    = Number.isFinite(Number(w.windSpeed != null ? w.windSpeed : w.wind))
    ? Number(w.windSpeed != null ? w.windSpeed : w.wind) : null;
  const feelsLike = _feelsLike(w);

  switch (type) {
    case 'rain': {
      return Object.freeze({
        type, bgImage,
        insightTitleKey: 'weather.rainLaterToday',
        insightTitleFb:  'Rain later today',
        actionLabelKey: isGarden ? 'actions.movePotsFromRain' : 'actions.checkDrainage',
        actionLabelFb:  isGarden
          ? 'Move small pots away from heavy rain'
          : 'Check drainage around your crop',
        metricKey: 'weather.rainChance',
        metricFb:  'rain chance',
        metricValue: rainPct != null ? rainPct + '%' : '—',
        ctaKey: 'actions.startCheck',
        ctaFallback: 'Start check',
        estimatedMinutes: 2,
      });
    }
    case 'heat': {
      return Object.freeze({
        type, bgImage,
        insightTitleKey: 'weather.warmAfternoonExpected',
        insightTitleFb:  'Warm afternoon expected',
        actionLabelKey: isGarden ? 'actions.checkSoilBeforeNoon' : 'actions.checkSoilMoisture',
        actionLabelFb:  isGarden
          ? 'Check soil before noon'
          : 'Check soil moisture early',
        metricKey: 'weather.feelsLike',
        metricFb:  'Feels like',
        metricValue: feelsLike != null ? feelsLike + '°' : '—',
        ctaKey: isGarden ? 'actions.checkPlant' : 'actions.checkSoil',
        ctaFallback: isGarden ? 'Check plant' : 'Check soil',
        estimatedMinutes: 2,
      });
    }
    case 'wind': {
      return Object.freeze({
        type, bgImage,
        insightTitleKey: 'weather.windStress',
        insightTitleFb:  'Wind may stress plants',
        actionLabelKey: isGarden ? 'actions.supportContainers' : 'actions.supportWeakPlants',
        actionLabelFb:  isGarden
          ? 'Support weak stems or containers'
          : 'Support weak stems',
        metricKey: 'weather.windSpeed',
        metricFb:  'wind',
        metricValue: wind != null ? wind + ' km/h' : '—',
        ctaKey: 'actions.checkPlants',
        ctaFallback: 'Check plants',
        estimatedMinutes: 3,
      });
    }
    case 'dry': {
      return Object.freeze({
        type, bgImage,
        insightTitleKey: 'weather.dryToday',
        insightTitleFb:  'Dry conditions today',
        actionLabelKey: isGarden ? 'actions.waterPotsIfDry' : 'actions.waterIfDry',
        actionLabelFb:  isGarden
          ? 'Water pots only if the soil feels dry'
          : 'Water only if soil feels dry',
        metricKey: 'weather.humidityHint',
        metricFb:  'soil hint',
        metricValue: rainPct != null ? rainPct + '% rain' : 'Low rain',
        ctaKey: 'actions.checkSoil',
        ctaFallback: 'Check soil',
        estimatedMinutes: 2,
      });
    }
    case 'sunny': {
      return Object.freeze({
        type, bgImage,
        insightTitleKey: 'weather.warmAndDry',
        insightTitleFb:  'Warm and dry',
        actionLabelKey: isGarden ? 'actions.checkPotMoisture' : 'actions.checkSoilMoisture',
        actionLabelFb:  isGarden
          ? 'Check your pots before midday sun'
          : 'Check soil moisture before noon',
        metricKey: 'weather.feelsLike',
        metricFb:  'Feels like',
        metricValue: feelsLike != null ? feelsLike + '°' : '—',
        ctaKey: 'actions.startCheck',
        ctaFallback: 'Start check',
        estimatedMinutes: 2,
      });
    }
    case 'cloudy':
    case 'normal':
    case 'unknown':
    default: {
      const best = _bestCheckTime();
      return Object.freeze({
        type, bgImage,
        insightTitleKey: 'weather.goodQuickCheck',
        insightTitleFb:  'Good day for a quick check',
        actionLabelKey: isGarden ? 'actions.inspectLeavesGarden' : 'actions.inspectLeaves',
        actionLabelFb:  isGarden
          ? 'Inspect leaves and soil in your pots'
          : 'Inspect leaves and soil moisture',
        metricKey: best.key,
        metricFb:  best.fallback,
        // For the cloudy/normal branch the metric IS the time hint,
        // so we leave metricValue empty — the renderer shows the
        // localised label as the value line.
        metricValue: '',
        ctaKey: 'actions.startCheck',
        ctaFallback: 'Start check',
        estimatedMinutes: 2,
      });
    }
  }
}

/**
 * Format the "Accurate as of HH:MM" line for the hero header.
 * Returns a 12-hour clock string (e.g. "9:30 AM") localised by
 * the runtime; falls back to a stable HH:MM if Intl misbehaves.
 */
export function formatAccurateAsOf(timestamp) {
  const t = (timestamp instanceof Date) ? timestamp
          : (timestamp != null) ? new Date(timestamp)
          : new Date();
  if (Number.isNaN(t.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric', minute: '2-digit',
    }).format(t);
  } catch {
    const h = String(t.getHours()).padStart(2, '0');
    const m = String(t.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

export default getWeatherHero;
