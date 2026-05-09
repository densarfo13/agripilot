/**
 * sceneResolver.js — EnvironmentSceneResolver.
 *
 * Pure decision function:
 *   ( weather, time, region, season, mode )
 *   → { sceneSlot, lighting, transitionMs, reason }
 *
 * The resolver is the single source of truth for "which photo slot
 * does the home weather hero render right now?". When the slot's
 * photo doesn't exist on disk yet, the consumer (DynamicWeatherBackdrop)
 * falls back to a calm placeholder via <RealisticPhoto> — never a
 * broken image, never a 404.
 *
 *   import { resolveScene } from './sceneResolver.js';
 *
 *   const scene = resolveScene({
 *     weather:  { weatherType: 'rain', condition: 'Light rain' },
 *     hour:     17,
 *     country:  'GH',
 *     region:   'Ashanti',
 *     month:    5,
 *     mode:     'farm',
 *   });
 *   //   scene.sceneSlot     = 'hero-tropical-rain'
 *   //   scene.lighting      = { phase: 'sunset', overlay, tone, ambient }
 *   //   scene.transitionMs  = 600
 *   //   scene.reason        = 'tropical:rain'
 *
 * Strict-rule audit
 *   • Pure. Never throws on bad input.
 *   • Returns frozen objects so consumers cannot mutate.
 *   • Garden mode always wins over region — small-scale gardening
 *     scenes share a single visual vocabulary regardless of country.
 *   • Resolver picks the MOST SPECIFIC available slot first
 *     (region+weather), then falls back to weather-only, then to a
 *     time-of-day default. The fallback chain is documented inline.
 *   • Transition window stays in 400–800ms per the spec.
 */

import { resolveLighting } from './lighting.js';
import { regionEnvironment } from './region.js';
import { resolveSeason } from './season.js';
import { PHOTO_SLOT_LIST } from '../../../assets/realism/photography/manifest.js';

const SLOT_SET = new Set(PHOTO_SLOT_LIST);

const DEFAULT_TRANSITION_MS = 600;

const VALID_WEATHER_TYPES = new Set([
  'rain', 'storm', 'fog',
  'sunny', 'partly-cloudy', 'cloudy',
  'heat', 'wind', 'dry',
  'snow', 'unknown', 'normal',
]);

function _resolveWeatherType(w) {
  if (!w || typeof w !== 'object') return 'unknown';
  const wt = typeof w.weatherType === 'string' ? w.weatherType.toLowerCase() : '';
  if (VALID_WEATHER_TYPES.has(wt)) return wt;

  const cond = String(w.condition || '').toLowerCase();
  const rain = Number(w.rainChance);
  const temp = Number(w.temp);
  const wind = Number(w.windSpeed != null ? w.windSpeed : w.wind);

  if (cond.includes('storm') || cond.includes('thunder')) return 'storm';
  if (cond.includes('fog')   || cond.includes('mist'))    return 'fog';
  if (cond.includes('snow'))                              return 'snow';
  if ((Number.isFinite(rain) && rain >= 60) || cond.includes('rain')) return 'rain';
  if (Number.isFinite(temp) && temp >= 32) return 'heat';
  if ((Number.isFinite(wind) && wind >= 25) || cond.includes('wind')) return 'wind';
  if (cond.includes('partly')) return 'partly-cloudy';
  if (cond.includes('cloud'))  return 'cloudy';
  if (cond.includes('sun') || cond.includes('clear')) return 'sunny';
  if (Number.isFinite(rain) && rain <= 20) return 'dry';
  return 'unknown';
}

/**
 * Pick the slot in the order most-specific → most-generic. The first
 * candidate that matches a known photo slot wins. When none match,
 * we return an empty string which the consumer interprets as "render
 * the calm placeholder" (no broken image, no fallback URL fetch).
 */
function _firstAvailable(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && SLOT_SET.has(c)) return c;
  }
  return '';
}

function _gardenSlot({ weatherType, phase }) {
  // Garden vocabulary collapses weather variants — small-scale
  // scenes don't need the same regional richness as farm scenes.
  if (weatherType === 'rain' || weatherType === 'storm') {
    return _firstAvailable('hero-garden-rainy', 'hero-garden-daylight');
  }
  if (phase === 'sunrise')        return _firstAvailable('hero-garden-sunrise', 'hero-garden-daylight');
  if (phase === 'sunset' || phase === 'dusk') {
    return _firstAvailable('hero-garden-dusk', 'hero-garden-daylight');
  }
  if (phase === 'night')          return _firstAvailable('hero-garden-night', 'hero-garden-daylight');
  return _firstAvailable('hero-garden-daylight', 'hero-garden-balcony');
}

function _farmSlot({ weatherType, phase, cluster }) {
  // Most-specific: cluster + weather. Fall back through
  // weather-only, then time-of-day default.
  switch (weatherType) {
    case 'rain':
    case 'storm': {
      if (cluster === 'tropical') return _firstAvailable('hero-tropical-rain', 'hero-rainy-field');
      if (cluster === 'monsoon')  return _firstAvailable('hero-monsoon-rain',  'hero-rainy-field');
      return _firstAvailable(weatherType === 'storm' ? 'hero-storm-field' : 'hero-rainy-field',
                             'hero-rainy-field');
    }
    case 'fog':
      return _firstAvailable('hero-fog-field', 'hero-cloudy-field', 'hero-daylight-field');
    case 'cloudy':
      return _firstAvailable('hero-cloudy-field', 'hero-daylight-field');
    case 'partly-cloudy':
      return _firstAvailable('hero-partly-cloudy', 'hero-daylight-field');
    default:
      // Daylight / sunny / heat / dry / wind / unknown: fall through
      // to the lighting branch so phase drives the variant.
      break;
  }
  // Time-of-day-led variant.
  if (phase === 'sunrise') {
    if (cluster === 'temperate') return _firstAvailable('hero-temperate-sunrise', 'hero-sunrise-field');
    return _firstAvailable('hero-sunrise-field', 'hero-daylight-field');
  }
  if (phase === 'sunset') {
    if (cluster === 'arid')      return _firstAvailable('hero-arid-sunset', 'hero-sunset-field');
    return _firstAvailable('hero-sunset-field', 'hero-dusk-field', 'hero-daylight-field');
  }
  if (phase === 'dusk')  return _firstAvailable('hero-dusk-field', 'hero-daylight-field');
  if (phase === 'night') return _firstAvailable('hero-night-field', 'hero-daylight-field');

  // Plain daylight — pick the cluster-aware variant if it exists.
  if (cluster === 'tropical')  return _firstAvailable('hero-tropical-daylight',  'hero-daylight-field');
  if (cluster === 'monsoon')   return _firstAvailable('hero-monsoon-daylight',   'hero-daylight-field');
  if (cluster === 'temperate') return _firstAvailable('hero-temperate-daylight', 'hero-daylight-field');
  if (cluster === 'arid')      return _firstAvailable('hero-arid-daylight',      'hero-daylight-field');
  if (cluster === 'highland')  return _firstAvailable('hero-highland-daylight',  'hero-daylight-field');
  return _firstAvailable('hero-daylight-field');
}

/**
 * resolveScene(input) — the public entry point.
 *
 *   input fields (all optional; resolver tolerates absence):
 *     weather   { weatherType, condition, rainChance, temp, ... }
 *     hour      0-23 local hour
 *     phase     explicit lighting phase (overrides hour)
 *     country   ISO-2 code
 *     region    admin-1 / human-readable region label
 *     month     1-12 local month
 *     mode      'farm' | 'garden'
 *     transitionMs override (clamped to 400-800)
 */
export function resolveScene(input = {}) {
  const weather = (input.weather && typeof input.weather === 'object') ? input.weather : {};
  const mode    = input.mode === 'garden' ? 'garden' : 'farm';
  const lighting = resolveLighting({ hour: input.hour, phase: input.phase });
  const region   = regionEnvironment({ country: input.country, region: input.region });
  const season   = resolveSeason({ month: input.month, hemisphere: region.hemisphere });
  const weatherType = _resolveWeatherType(weather);

  // Garden mode wins — small-scale scenes have their own vocabulary
  // independent of region.
  let sceneSlot;
  let reason;
  if (mode === 'garden') {
    sceneSlot = _gardenSlot({ weatherType, phase: lighting.phase });
    reason = `garden:${weatherType}:${lighting.phase}`;
  } else {
    sceneSlot = _farmSlot({ weatherType, phase: lighting.phase, cluster: region.cluster });
    reason = `${region.cluster}:${weatherType}:${lighting.phase}`;
  }

  // Transition target — clamped to spec window 400-800ms.
  let transitionMs = Number(input.transitionMs);
  if (!Number.isFinite(transitionMs)) transitionMs = DEFAULT_TRANSITION_MS;
  transitionMs = Math.max(400, Math.min(800, Math.floor(transitionMs)));

  return Object.freeze({
    sceneSlot:    sceneSlot || '',
    lighting,
    region,
    season,
    weatherType,
    transitionMs,
    mode,
    reason,
  });
}

export default resolveScene;
