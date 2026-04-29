/**
 * useTodayTask — thin React hook that calls the production
 * intelligence taskEngine and re-runs on language change so the
 * resolved title / instruction / reason update live.
 *
 * Usage
 * ─────
 *   import useTodayTask from '../hooks/useTodayTask.js';
 *
 *   const task = useTodayTask({
 *     farm,             // active farm shape
 *     weather,          // optional — falls through to default rule
 *     risks,            // optional — { pest, drought }
 *     activity,         // optional — { daysInactive }
 *     fundingMatches,   // optional
 *     buyerSignals,     // optional — { hasListing }
 *   });
 *
 *   // task is NEVER null; render directly:
 *   <h1>{task.title}</h1>
 *   <p>{task.instruction}</p>
 *
 * Strict contract
 * ───────────────
 *   • Pure consumer of generateTodayTask. No side effects.
 *   • Re-runs on language change (subscribes via useTranslation),
 *     so a farmer flipping to French sees the new rendered strings
 *     on the next render without remounting the page.
 *   • Stable identity within a single render — uses useMemo.
 */

import { useMemo } from 'react';
import { useTranslation } from '../i18n/index.js';
import { generateTodayTask } from '../intelligence/taskEngine.js';

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
