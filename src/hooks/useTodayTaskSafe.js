/**
 * useTodayTaskSafe — derives today's actionable task from
 * (crop, cropStage, location, weather) with hard fallbacks at
 * every step. Never throws, never returns null, never reads
 * any legacy task strings.
 *
 *   const task = useTodayTaskSafe({ crop, cropStage, location, weather });
 *   // → { title, reason, urgency, time, cta, source }
 *
 * Behaviour
 *   • Pure function-shaped (uses useMemo for stable identity)
 *     — re-derives only when one of the four inputs changes.
 *   • Delegates the weather → action mapping to the existing
 *     pure decideWeatherAction() helper in
 *     src/lib/weatherActionEngine.js so every consumer of
 *     "today's task" gets the same decision tree.
 *   • Output ALWAYS includes:
 *       title, reason, urgency, time, cta, source
 *     Every field is a non-empty string (urgency ∈
 *     'low'|'medium'|'high'). Callers can render unconditionally.
 *   • The DEFAULT_TASK below matches the May 2026 spec literal
 *     exactly — Home renders it when nothing more specific
 *     applies.
 *
 * Anti-regression rules
 *   • NEVER reads from the legacy task localStorage keys
 *     (farroway_today_task, farroway_task_queue, etc.). The
 *     pilot bypass wipes those at boot; this hook ignores them.
 *   • NEVER includes the historic "Start logging farm costs",
 *     "track profitability", "performance comparison" or
 *     "Refresh crop stage" wording.
 *
 * Strict-rule audit
 *   • Hooks are unconditional (passes
 *     react-hooks/rules-of-hooks).
 *   • SSR-safe — no window / localStorage reads.
 *   • Pure derivation; the caller owns the inputs.
 */

import { useMemo } from 'react';
import { decideWeatherAction } from '../lib/weatherActionEngine.js';

const DEFAULT_TASK = Object.freeze({
  title:   'Check soil moisture around your crop',
  reason:  'Dry weather can stress plants. Water only if the soil feels dry.',
  urgency: 'medium',
  time:    '5 mins',
  cta:     'Mark as done',
  source:  'default',
});

function _trimOrNull(s) {
  if (typeof s !== 'string') return null;
  const v = s.trim();
  return v.length > 0 ? v : null;
}

function _hasCrop(crop) {
  if (!crop) return false;
  if (typeof crop === 'string') return _trimOrNull(crop) != null;
  if (typeof crop === 'object') {
    return _trimOrNull(crop.name)     != null
        || _trimOrNull(crop.cropName) != null
        || _trimOrNull(crop.label)    != null
        || _trimOrNull(crop.cropType) != null;
  }
  return false;
}

function _hasLocation(location) {
  if (!location) return false;
  if (typeof location === 'string') return _trimOrNull(location) != null;
  if (typeof location === 'object') {
    if (location.hasLocation === false) return false;
    return _trimOrNull(location.label)        != null
        || _trimOrNull(location.region)       != null
        || _trimOrNull(location.country)      != null
        || _trimOrNull(location.locationName) != null
        || (Number.isFinite(location.lat) && Number.isFinite(location.lng));
  }
  return false;
}

function _hasUsableWeather(w) {
  if (!w || typeof w !== 'object') return false;
  return Number.isFinite(w.temp)
      || Number.isFinite(w.rainChance)
      || Number.isFinite(w.windSpeed);
}

function _timeForUrgency(urgency) {
  if (urgency === 'high') return '5 mins';
  if (urgency === 'low')  return '5 mins';
  return '5 mins';
}

/**
 * @param {object} params
 * @param {*} [params.crop]       crop string or object with .name
 * @param {*} [params.cropStage]  optional growth stage label
 * @param {*} [params.location]   location string or object
 * @param {*} [params.weather]    weather object from useWeatherSafe
 */
export function useTodayTaskSafe(params) {
  return useMemo(() => {
    let crop, cropStage, location, weather;
    try {
      if (params && typeof params === 'object') {
        crop      = params.crop;
        cropStage = params.cropStage;
        location  = params.location;
        weather   = params.weather;
      }
    } catch { /* hostile params — fall through */ }

    // ─── 1. No crop or no location → setup-prompt task ───
    // The default soil-moisture task assumes a crop exists. If
    // the user hasn't picked one yet OR no location is on file,
    // surface the spec-literal default copy. We deliberately
    // DON'T return a "set up your farm" task here — the Home
    // surface owns the inline "Complete setup" card; this hook
    // is responsible for "today's task" only and must always
    // ship a usable task object.
    if (!_hasCrop(crop) || !_hasLocation(location)) {
      return { ...DEFAULT_TASK };
    }

    // ─── 2. Weather missing → spec-literal default ───
    if (!_hasUsableWeather(weather)) {
      return { ...DEFAULT_TASK };
    }

    // ─── 3. Full inputs → delegate to weatherActionEngine ───
    let action;
    try {
      action = decideWeatherAction({ weather, crop, cropStage, location });
    } catch {
      return { ...DEFAULT_TASK };
    }

    if (!action || typeof action !== 'object') {
      return { ...DEFAULT_TASK };
    }

    const urgency = (action.urgency === 'low'
                  || action.urgency === 'medium'
                  || action.urgency === 'high')
                  ? action.urgency
                  : 'medium';

    return {
      title:   _trimOrNull(action.taskTitle)  || DEFAULT_TASK.title,
      reason:  _trimOrNull(action.taskReason)
            || _trimOrNull(action.reason)
            || DEFAULT_TASK.reason,
      urgency,
      time:    _timeForUrgency(urgency),
      cta:     _trimOrNull(action.cta)        || DEFAULT_TASK.cta,
      source:  'weather-engine',
    };
  }, [params?.crop, params?.cropStage, params?.location, params?.weather]);
}

// Test hooks.
export const _internal = Object.freeze({
  DEFAULT_TASK,
  _hasCrop,
  _hasLocation,
  _hasUsableWeather,
});

export default useTodayTaskSafe;
