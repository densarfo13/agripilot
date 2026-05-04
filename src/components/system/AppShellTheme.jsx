/**
 * AppShellTheme — reads the current weather and applies the
 * matching `theme-*` class to <body> so the entire app shell
 * (gradient, cards, accents) re-tints with a single class swap.
 *
 *   <AppShellTheme />   // mounted ONCE in App.jsx
 *
 * Pure observer — renders nothing. Side-effect-only via
 * useEffect. The classes themselves live in src/index.css
 * under `body.theme-rain` / `theme-heat` / `theme-wind` /
 * `theme-dry` / `theme-normal`.
 *
 * Resolution chain
 *   1. Use the existing weather-action engine to convert the
 *      raw weather payload into a 'rain' | 'heat' | 'wind' |
 *      'dry' | 'normal' type. This is the same engine the
 *      WeatherHeroCard uses, so the card and the shell tint
 *      always agree.
 *   2. Map the type → class via getWeatherThemeClass.
 *   3. Toggle the class on document.body. On unmount /
 *      remount / next render the previous class is removed
 *      first so we never accumulate multiple theme- classes.
 *
 * Safety
 *   • Never throws. Every step try/catched. Missing weather
 *     context falls through to 'theme-normal'.
 *   • Honours the existing useWeather() context — no extra
 *     API calls.
 */

import { useEffect } from 'react';
import { useWeather } from '../../context/WeatherContext.jsx';
import { getWeatherAction } from '../../lib/weatherActionEngine.js';
import { getWeatherThemeClass } from '../../lib/themeWeather.js';

const ALL_THEME_CLASSES = Object.freeze([
  'theme-rain', 'theme-heat', 'theme-wind', 'theme-dry', 'theme-normal',
]);

export default function AppShellTheme() {
  // useWeather throws outside its provider — but App.jsx wraps
  // the entire tree in WeatherProvider, so the hook resolves
  // fine here. Defensive try/catch around the engine call only.
  const { weather } = useWeather();

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined;
    let cls = 'theme-normal';
    try {
      const action = getWeatherAction(weather || {});
      cls = getWeatherThemeClass(action && action.type);
    } catch { cls = 'theme-normal'; }

    // Remove any prior theme-* class before applying the new
    // one. Guards against double-class accumulation if a hot
    // module reload re-runs the effect.
    try {
      for (const c of ALL_THEME_CLASSES) {
        document.body.classList.remove(c);
      }
      document.body.classList.add(cls);
    } catch { /* never throw from a side-effect */ }

    return () => {
      // Don't strip the class on unmount — the theme should
      // persist between view transitions. Only clear on full
      // page reload (browser does that for us).
    };
  }, [weather]);

  return null;
}

// Test hook.
export const _internal = Object.freeze({ ALL_THEME_CLASSES });
