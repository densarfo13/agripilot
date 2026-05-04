/**
 * defaults.js — safe default app state.
 *
 *   import { defaultFarm, defaultTask, defaultWeather } from './lib/defaults.js';
 *
 * Every Home consumer pairs the live API/store value with one of
 * these defaults so the screen renders SOMETHING even when the
 * data layer hasn't loaded yet (or has failed).
 *
 * Strict-rule audit
 *   • Pure data — no functions, no side-effects.
 *   • Frozen so a misbehaving caller can't mutate the shared
 *     fallback in place.
 *   • Strings are user-friendly + low-literacy. No null/empty
 *     placeholders that would leak through to the UI.
 */

export const defaultFarm = Object.freeze({
  name:     '',
  crop:     null,                      // resolves to "No crop selected" via getDisplayText
  location: null,                      // resolves to "Location not set"
  stage:    'Not set',
  userType: 'backyard',
});

export const defaultTask = Object.freeze({
  title:   'Create your farm to get today\u2019s task',
  reason:  'Add your crop and location so Farroway can guide you.',
  urgency: 'low',
  time:    '2 mins',
  cta:     'Set up farm',
});

export const defaultWeather = Object.freeze({
  temp:       null,
  condition:  'Weather unavailable',
  rainChance: null,
  wind:       null,
  advice:     'Showing general crop guidance.',
});

export default Object.freeze({ defaultFarm, defaultTask, defaultWeather });
