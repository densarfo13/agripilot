/**
 * themeWeather.js — map a weather "type" to the matching
 * theme class so the whole app shell can re-tint with one
 * className swap.
 *
 *   import { getWeatherThemeClass } from './lib/themeWeather.js';
 *
 *   const cls = getWeatherThemeClass(weather?.type);
 *   document.body.classList.add(cls);  // or apply on a wrapper
 *
 * Output classes (all defined in src/index.css):
 *   theme-rain   — cooler navy / teal
 *   theme-heat   — warm olive / sand
 *   theme-wind   — muted teal / fog
 *   theme-dry    — earth / clay
 *   theme-normal — base nature-dark green
 *
 * Strict-rule audit
 *   • Pure function. Same input → same output. Never throws.
 *   • Unknown / null inputs → 'theme-normal' fallback.
 *   • Output is always a single, non-empty class string.
 */

const KNOWN_TYPES = Object.freeze(['rain', 'heat', 'wind', 'dry', 'normal']);

export function getWeatherThemeClass(weatherType) {
  const t = typeof weatherType === 'string' ? weatherType.toLowerCase() : '';
  switch (t) {
    case 'rain': return 'theme-rain';
    case 'heat': return 'theme-heat';
    case 'wind': return 'theme-wind';
    case 'dry':  return 'theme-dry';
    case 'normal':
    default:     return 'theme-normal';
  }
}

export const _internal = Object.freeze({ KNOWN_TYPES });

export default getWeatherThemeClass;
