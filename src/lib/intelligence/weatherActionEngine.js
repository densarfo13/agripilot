/**
 * weatherActionEngine.js — thin adapter on top of the existing
 * insightFormatter so the farm-intelligence layer exposes a single
 * clean contract to the UI:
 *
 *   getWeatherAction({ weather, crop, cropStage, farmType, forecastDays })
 *     → {
 *       condition:      short human line ("Dry weather for the next 3 days")
 *       conditionKey:   i18n key for `condition`
 *       timeWindow:     "Later today" | "Next 3 days" | …
 *       timeWindowKey:  i18n key
 *       primaryAction:  one short action to take *first*
 *       primaryActionKey
 *       secondaryAction?: second action, if the underlying formatter
 *                         produced one
 *       secondaryActionKey?
 *       why:           one-liner the UI can show under "Why this?"
 *       tone:          'info' | 'warn' | 'danger'
 *       ruleTag:       debugging tag from the formatter
 *       tier:          echoed farm-type tier
 *     } | null
 *
 * Returns null when the weather payload is missing or status is
 * uncommanding (e.g. 'ok'/'unavailable'); the UI should then hide the
 * banner rather than fabricate a weak hint.
 */

import { formatWeatherInsight } from '../farmer/insightFormatter.js';

// Mapping from ruleTag → "why" explanation (one short sentence). Keys
// are stable, so translations can attach via the i18n chain.
const WHY_BY_RULE = Object.freeze({
  weather_excessive_heat: {
    fallback: 'Heat stress can scorch leaves and dry topsoil fast; acting early protects the crop.',
    key:      'farmer.insight.weather.why.hot',
  },
  weather_low_rain: {
    fallback: 'Several dry days mean topsoil moisture drops fast — irrigating early keeps roots active.',
    key:      'farmer.insight.weather.why.dry',
  },
  weather_rain_expected: {
    fallback: 'Incoming rain can damage exposed seed and flood poorly-drained plots.',
    key:      'farmer.insight.weather.why.rain',
  },
});

export function getWeatherAction({
  weather = null,
  crop = null,
  cropStage = null,
  farmType = null,
  forecastDays = 3,
} = {}) {
  const raw = formatWeatherInsight({
    weather,
    crop,
    stage:    cropStage,
    farmType,
    forecastDays,
  });
  if (!raw) return null;

  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  const keys    = Array.isArray(raw.actionKeys) ? raw.actionKeys : [];
  const primaryAction    = actions[0] || null;
  const primaryActionKey = keys[0]    || null;
  const secondaryAction    = actions[1] || null;
  const secondaryActionKey = keys[1]    || null;

  if (!primaryAction) return null;   // nothing actionable → hide banner

  const why = WHY_BY_RULE[raw.ruleTag] || { fallback: '', key: null };

  return Object.freeze({
    condition:        raw.condition,
    conditionKey:     raw.conditionKey,
    timeWindow:       raw.timeWindow,
    timeWindowKey:    raw.timeWindowKey,
    primaryAction,
    primaryActionKey,
    secondaryAction,
    secondaryActionKey,
    why:              why.fallback,
    whyKey:           why.key,
    tone:             raw.tone,
    ruleTag:          raw.ruleTag,
    tier:             raw.tier || null,
  });
}

export const _internal = Object.freeze({ WHY_BY_RULE });
