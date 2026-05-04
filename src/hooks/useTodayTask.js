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

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n/index.js';
import { generateTodayTask } from '../intelligence/taskEngine.js';
import { generateSmartTask } from '../lib/taskIntelligence.js';
import { getBestTask }       from '../lib/smartTaskEngine.js';
import { logTaskEvent }      from '../lib/taskEventLogger.js';

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

// ─── useBestTask — ML scoring layer v1 ──────────────────────
//
//   const { bestTask, candidates, recordCompleted, recordSkipped } =
//     useBestTask({ userType, crop, cropStage, region, weather, userHistory });
//
//   <h1>{bestTask.title}</h1>
//   <button onClick={recordCompleted}>{bestTask.cta}</button>
//
// Calls smartTaskEngine.getBestTask() to combine the candidate
// engine + ML scorer + event logging. Fires:
//   • task_generated  — every time the input changes (per top
//     candidate)
//   • task_score      — once per candidate per re-rank
//   • task_completed  — when caller invokes recordCompleted()
//   • task_skipped    — when caller invokes recordSkipped()
//
// All fires are debounced via a ref so a re-render doesn't
// re-emit the same event for the same task title.

export function useBestTask(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const { lang } = useTranslation();

  const result = useMemo(
    () => getBestTask(o),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      lang,
      o.userType,
      _smartCropKey(o.crop),
      o.cropStage,
      o.region,
      _weatherKey(o.weather),
      o.userHistory ? JSON.stringify(o.userHistory) : '',
    ],
  );

  const lastFiredTitle = useRef(null);

  // Fire task_generated + task_score events whenever the best
  // task identity changes. The event sink is fire-and-forget.
  useEffect(() => {
    const best = result && result.bestTask;
    if (!best || !best.title) return;
    if (lastFiredTitle.current === best.title) return;
    lastFiredTitle.current = best.title;
    const baseMeta = {
      crop:             o.crop,
      cropStage:        o.cropStage,
      weather:          o.weather,
      userType:         o.userType,
    };
    logTaskEvent('task_generated', {
      ...baseMeta,
      taskTitle: best.title,
      category:  best.category,
      score:     best.score,
    });
    // Emit one task_score per candidate so the back-end can see
    // the full rank distribution. Cheap — there are only 4
    // candidates and the analytics path is fire-and-forget.
    if (Array.isArray(result.candidates)) {
      for (const c of result.candidates) {
        logTaskEvent('task_score', {
          ...baseMeta,
          taskTitle: c.title,
          category:  c.category,
          score:     c.score,
        });
      }
    }
    try {
      // eslint-disable-next-line no-console
      console.log('Today task source:', best.source);
      // eslint-disable-next-line no-console
      console.log('Today task:', best.title);
    } catch { /* swallow */ }
  }, [result, o.crop, o.cropStage, o.weather, o.userType]);

  const recordCompleted = useCallback((extra = {}) => {
    const best = result && result.bestTask;
    if (!best) return;
    logTaskEvent('task_completed', {
      crop:      o.crop,
      cropStage: o.cropStage,
      weather:   o.weather,
      userType:  o.userType,
      taskTitle: best.title,
      category:  best.category,
      score:     best.score,
      ...extra,
    });
  }, [result, o.crop, o.cropStage, o.weather, o.userType]);

  const recordSkipped = useCallback((extra = {}) => {
    const best = result && result.bestTask;
    if (!best) return;
    logTaskEvent('task_skipped', {
      crop:      o.crop,
      cropStage: o.cropStage,
      weather:   o.weather,
      userType:  o.userType,
      taskTitle: best.title,
      category:  best.category,
      score:     best.score,
      ...extra,
    });
  }, [result, o.crop, o.cropStage, o.weather, o.userType]);

  return {
    bestTask:         result.bestTask,
    candidates:       result.candidates,
    recordCompleted,
    recordSkipped,
  };
}

export { getBestTask };

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
