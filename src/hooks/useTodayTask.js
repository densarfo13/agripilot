/**
 * useTodayTask — production-intelligence task hook.
 *
 * Two flavours coexist:
 *
 *   1) useTodayTask({ farm, weather, risks, ... })  (default export)
 *      Synchronous wrapper around `generateTodayTask` from
 *      intelligence/taskEngine.js. Used by NextBestActionCard +
 *      similar surfaces that already pass full context.
 *
 *   2) useSmartTask({ userType, crop, cropStage, region, weather })
 *      Synchronous wrapper around the May 2026 Invisible
 *      Intelligence Engine (taskIntelligence.generateSmartTask).
 *      Used by Home / Tasks / Progress as the canonical fallback
 *      when /api/tasks/today is empty or fails. The same engine
 *      is also reachable from non-React code via the bare
 *      `generateSmartTask` export below.
 *
 * Strict contract
 * ───────────────
 *   • Both hooks are PURE consumers of their engine. No fetch.
 *     The API call lives on the consumer (e.g. TodayTaskCard);
 *     this hook is the deterministic fallback the UI renders
 *     when the network path returns nothing usable.
 *   • Re-run on language change so locale flips are live.
 *   • Stable identity within a single render — useMemo.
 */

import { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n/index.js';
import { generateTodayTask } from '../intelligence/taskEngine.js';
import { generateSmartTask } from '../lib/taskIntelligence.js';

export default function useTodayTask({
  farm = null,
  weather = null,
  risks = null,
  activity = null,
  fundingMatches = null,
  buyerSignals = null,
} = {}) {
  // Subscribe to language change. The engine resolves strings via
  // tStrict (which reads getLanguage at call time), so re-running
  // on a langchange-driven re-render gives us localised copy.
  const { lang } = useTranslation();

  return useMemo(
    () => generateTodayTask({ farm, weather, risks, activity, fundingMatches, buyerSignals }),
    // Memo key includes lang so a language flip recomputes; the
    // input identity is included via a shallow stable-key string
    // so a stable parent prop doesn't churn on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, _stableKey({ farm, weather, risks, activity, fundingMatches, buyerSignals })],
  );
}

function _stableKey(o) {
  try {
    if (!o) return '';
    return [
      o.farm ? (o.farm.id || o.farm.crop || '') + ':' + (o.farm.cropStage || o.farm.stage || '') : '',
      o.weather ? (o.weather.status || '') + ':' + (o.weather.heavyRain ? 'r' : '') + (o.weather.heatHigh ? 'h' : '') : '',
      o.risks  ? (o.risks.pest || '') + ':' + (o.risks.drought || '') : '',
      o.activity ? String(o.activity.daysInactive || 0) : '',
      o.fundingMatches ? String((o.fundingMatches || []).length) : '',
      o.buyerSignals ? (o.buyerSignals.hasListing ? 'l' : '') : '',
    ].join('|');
  } catch {
    return '';
  }
}

// Re-export the engine + URGENCY constants for callers that want
// to read the underlying API directly.
export { generateTodayTask } from '../intelligence/taskEngine.js';
export { URGENCY, ACTION_TYPE, RULE } from '../intelligence/taskEngine.js';

// ─── useSmartTask — May 2026 Invisible Intelligence ────────────
//
//   const task = useSmartTask({
//     userType:  'backyard',
//     crop:      profile?.crop,
//     cropStage: profile?.stage,
//     region:    profile?.location,
//     weather:   { condition: 'rainy', temp: 27, rainChance: 75 },
//   });
//
// Returns the spec's task envelope (title / reason / urgency /
// time / cta / category / region / generatedAt / source) and
// logs the source + title to the console exactly once per
// title change so engineers can confirm the smart path fired.

export function useSmartTask({
  userType  = 'backyard',
  crop      = 'crop',
  cropStage = 'unknown',
  region    = 'your area',
  weather   = null,
} = {}) {
  // Subscribe to language change so locale flips re-render.
  const { lang } = useTranslation();

  const task = useMemo(
    () => generateSmartTask({ userType, crop, cropStage, region, weather: weather || {} }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, userType, _smartCropKey(crop), cropStage, region, _weatherKey(weather)],
  );

  // Diagnostic — fire once per title change so the console
  // doesn't spam on every render but still confirms the smart
  // engine is the canonical task source.
  const lastTitleRef = useRef(null);
  useEffect(() => {
    if (!task || !task.title || lastTitleRef.current === task.title) return;
    lastTitleRef.current = task.title;
    try {
      // eslint-disable-next-line no-console
      console.log('Today task source:', task.source);
      // eslint-disable-next-line no-console
      console.log('Today task:', task.title);
    } catch { /* never throw from a diagnostic */ }
  }, [task]);

  return task;
}

// Re-export the bare engine for non-React callers (TodayTaskCard
// fallback, tests, server-driven previews).
export { generateSmartTask };

function _smartCropKey(c) {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') return c.name || c.id || '';
  return '';
}

function _weatherKey(w) {
  if (!w) return '';
  return [
    String(w.condition || ''),
    String(w.temp ?? ''),
    String(w.rainChance ?? ''),
    String(w.windSpeed ?? ''),
  ].join('|');
}
