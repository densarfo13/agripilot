/**
 * taskEventLogger.js — fire-and-forget event sink for the ML
 * Task Scoring Layer v1.
 *
 *   import { logTaskEvent } from './lib/taskEventLogger.js';
 *
 *   logTaskEvent('task_generated', { taskTitle, category, score, ... });
 *   logTaskEvent('task_score',     { taskTitle, category, score, ... });
 *   logTaskEvent('task_completed', { taskTitle, category, score, ... });
 *   logTaskEvent('task_skipped',   { taskTitle, category, score, ... });
 *
 * Why a small wrapper
 *   The spec calls for the same payload shape across four event
 *   names. Routing through one helper means a future
 *   reorg / batching / endpoint swap touches one file. The
 *   helper delegates to the existing analytics pipeline
 *   (`safeTrackEvent` / `trackEvent`) so the rest of the app
 *   continues to receive the events through the same channels
 *   it already monitors.
 *
 * Spec payload (May 2026 ML Scoring Layer §4):
 *   {
 *     taskTitle, category, score,
 *     crop, cropStage,
 *     weatherCondition, rainChance,
 *     userType,
 *   }
 *
 *   The helper accepts a richer object and projects only the
 *   spec fields, so callers can pass through their full task
 *   envelope without leaking unrelated metadata.
 *
 * Strict-rule audit
 *   • Synchronous; never throws.
 *   • Caller errors are silently dropped after a console.warn —
 *     a missing analytics module must NEVER crash the engine.
 */

const ALLOWED_EVENT_NAMES = Object.freeze([
  'task_generated',
  'task_score',
  'task_completed',
  'task_skipped',
]);

function _projectPayload(meta) {
  const m = (meta && typeof meta === 'object') ? meta : {};
  // Pull crop name from string OR { name } shape.
  const cropName = (m.crop && typeof m.crop === 'object')
    ? (m.crop.name || '')
    : (typeof m.crop === 'string' ? m.crop : '');
  // Pull weather condition + rainChance from a nested weather
  // object, but accept top-level overrides too.
  const w = (m.weather && typeof m.weather === 'object') ? m.weather : {};
  const weatherCondition = m.weatherCondition != null
    ? String(m.weatherCondition)
    : (typeof w.condition === 'string' ? w.condition : null);
  const rainChance = (typeof m.rainChance === 'number')
    ? m.rainChance
    : (typeof w.rainChance === 'number' ? w.rainChance : null);
  return {
    taskTitle:        typeof m.taskTitle === 'string' ? m.taskTitle.slice(0, 200) : null,
    category:         typeof m.category  === 'string' ? m.category  : null,
    score:            typeof m.score     === 'number' ? m.score     : null,
    crop:             cropName || null,
    cropStage:        typeof m.cropStage === 'string' ? m.cropStage : null,
    weatherCondition: weatherCondition,
    rainChance:       rainChance,
    userType:         m.userType === 'farmer' || m.userType === 'backyard'
                      ? m.userType : null,
  };
}

/**
 * logTaskEvent(eventName, meta)
 *
 * Returns a Promise that always resolves (never rejects).
 */
export async function logTaskEvent(eventName, meta) {
  if (!ALLOWED_EVENT_NAMES.includes(eventName)) {
    try { console.warn('[taskEventLogger] unknown event name:', eventName); }
    catch { /* swallow */ }
    return;
  }
  const payload = _projectPayload(meta);
  // Lazy import so unit tests / non-React contexts don't pull
  // the analytics module unless an event actually fires.
  try {
    const mod = await import('../lib/analytics.js');
    if (mod && typeof mod.safeTrackEvent === 'function') {
      mod.safeTrackEvent(eventName, payload);
      return;
    }
    if (mod && typeof mod.trackEvent === 'function') {
      mod.trackEvent(eventName, payload);
      return;
    }
  } catch { /* analytics module unavailable — diagnostic only */ }
  // Fallback: console-log so engineers can grep DevTools.
  try {
    // eslint-disable-next-line no-console
    console.log('[' + eventName + ']', payload);
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({
  ALLOWED_EVENT_NAMES,
  _projectPayload,
});

export default logTaskEvent;
