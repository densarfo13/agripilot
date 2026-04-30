/**
 * dailyTrigger.js — pure evaluator for the daily SMS / push trigger.
 *
 * Spec §4 of the retention sprint. The job is to decide WHETHER a
 * single daily nudge should fire today and WHAT it should say —
 * **not** to dispatch the message. Actual delivery flows through
 * the existing notification dispatcher (`src/lib/notifications/*`)
 * + Twilio backend; we do not duplicate or replace either.
 *
 * Decision rules (per spec)
 * ─────────────────────────
 *   1. At most ONE trigger fires per local day.
 *   2. Only fires when:
 *        • the user has been inactive for ≥ 24h (no completion AND
 *          no app visit yesterday or today), OR
 *        • a meaningful weather signal applies (rain expected /
 *          dry conditions favourable for sowing or spraying)
 *   3. Suppressed when:
 *        • there is no eligible task to point at (no clutter)
 *        • the trigger has already fired today
 *        • the user has opted out (caller checks; we only return
 *          the candidate payload)
 *
 * Return shape
 * ────────────
 *   null                                — nothing to do
 *   { variant, messageKey, fallback,    — trigger candidate; caller
 *     vars, taskId, channels }            forwards to the dispatcher
 *
 * Single-flight memoisation lives in the same retention store
 * (`farroway:retention:visit` + `dailyTriggerSentISO`). The
 * caller calls `markTriggerSent()` after the dispatcher accepts
 * the payload so the next invocation today is a no-op.
 */

import {
  getRetentionState,
  daysSinceLastVisit,
} from './streakStore.js';

const STORAGE_KEY = 'farroway:retention:trigger';

function _todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch { return null; }
}

function _write(value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch { return false; }
}

/** True when a trigger has not yet fired for today's local date. */
export function shouldEvaluateTriggerToday(now = new Date()) {
  const cur = _read();
  return !cur || cur.lastSentISO !== _todayISO(now);
}

/**
 * Mark today as having delivered a trigger. Call after the
 * notification dispatcher accepts the payload (returning the entry
 * id is enough; on dispatcher failure the caller should NOT mark
 * sent so the next tick can retry).
 */
export function markTriggerSent(payload, now = new Date()) {
  const today = _todayISO(now);
  _write({
    lastSentISO: today,
    variant:     payload?.variant || null,
    taskId:      payload?.taskId  || null,
  });
}

/**
 * Reset (debug). Not called automatically.
 */
export function clearTriggerHistory() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ─── Weather signal classification (small, narrow) ─────────
//
// We deliberately reuse the same weather-summary shape the existing
// engines already pass into the page (Open-Meteo classifier). No
// new fetch.

function _classifyWeather(weather) {
  if (!weather || typeof weather !== 'object') return null;
  if (weather.status === 'unavailable') return null;
  const state = String(weather.rainfallState || weather.rainfall || '').toLowerCase();
  if (state === 'rain' || state === 'raining' || state === 'rainingnow'
      || state === 'rainlater' || state === 'heavyrain'
      || state === 'moderate_rain' || state === 'heavy_rain' || state === 'light_rain') {
    return 'rain_expected';
  }
  // Dry signal: explicit "dry" enum OR low precipitation + low humidity.
  if (state === 'dry' || state === 'verydry' || state === 'very_dry') {
    return 'dry';
  }
  const pop = Number(weather.precipitationProbability ?? weather.pop);
  const mm  = Number(weather.precipMm24h ?? weather.precipMm);
  if (Number.isFinite(pop) && pop < 20 && Number.isFinite(mm) && mm < 1) {
    return 'dry';
  }
  return null;
}

// ─── Activity classification ───────────────────────────────

function _hoursSince(iso, now = new Date()) {
  if (!iso) return null;
  // streakStore stores YYYY-MM-DD only; treat as local-midnight of
  // that day for the gap calculation. That's a conservative
  // overestimate (good — we'd rather under-trigger than spam).
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!Number.isFinite(y)) return null;
  const last = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0).getTime();
  const cur  = now.getTime();
  if (!Number.isFinite(last) || !Number.isFinite(cur)) return null;
  return Math.max(0, (cur - last) / (60 * 60 * 1000));
}

/**
 * Decide whether to send a daily trigger.
 *
 * @param {object} args
 * @param {object|null} args.weather    page's existing weather summary
 * @param {object|null} args.primaryTask  current primary task (id + title)
 *   The trigger only fires when an eligible task exists; "no clutter"
 *   is enforced here, not at the call site.
 * @param {string[]} [args.channels]    delivery channels caller wants;
 *   defaults to ['sms','push']. We pass them through verbatim — the
 *   existing dispatcher consumes the same shape.
 * @param {Date} [args.now]             override for tests
 * @returns {null | {
 *   variant: 'inactivity'|'rain_expected'|'dry',
 *   messageKey: string,
 *   fallback: string,
 *   vars: object,
 *   taskId: string|null,
 *   channels: string[]
 * }}
 */
export function evaluateDailyTrigger({
  weather = null,
  primaryTask = null,
  channels = ['sms', 'push'],
  now = new Date(),
} = {}) {
  // Gate 1: max 1/day.
  if (!shouldEvaluateTriggerToday(now)) return null;
  // Gate 2: must have a task to point at — no clutter.
  if (!primaryTask || !primaryTask.id) return null;

  const taskHint = (primaryTask.title || primaryTask.detail || '').toString().trim();

  // Gate 3a: weather signal trumps generic inactivity. Rain warning
  // first because it's actionable today (don't spray, protect harvest).
  const wx = _classifyWeather(weather);
  if (wx === 'rain_expected') {
    return {
      variant:    'rain_expected',
      messageKey: 'retention.trigger.weather.rain',
      fallback:   `Rain today — protect your farm. ${taskHint}`.trim(),
      vars:       { taskHint },
      taskId:     primaryTask.id,
      channels,
    };
  }
  if (wx === 'dry') {
    return {
      variant:    'dry',
      messageKey: 'retention.trigger.weather.dry',
      fallback:   `Dry conditions today — good time to ${taskHint}`.trim(),
      vars:       { taskHint },
      taskId:     primaryTask.id,
      channels,
    };
  }

  // Gate 3b: inactivity ≥ 24h. We measure by the LATEST of
  // lastVisitISO / lastCompletionISO, so opening the app today
  // (without completing a task) doesn't suppress tomorrow's nudge.
  const ret = getRetentionState();
  const visitH = _hoursSince(ret.lastVisitISO, now);
  const compH  = _hoursSince(ret.lastCompletionISO, now);
  const dormantH = (() => {
    if (visitH == null && compH == null) return Infinity; // never seen
    if (visitH == null) return compH;
    if (compH  == null) return visitH;
    return Math.min(visitH, compH);
  })();
  if (dormantH >= 24) {
    return {
      variant:    'inactivity',
      messageKey: 'retention.trigger.inactivity',
      fallback:   `Your farm needs attention today. ${taskHint}`.trim(),
      vars:       { taskHint },
      taskId:     primaryTask.id,
      channels,
    };
  }

  // No condition met today.
  return null;
}

// ─── Test seam ─────────────────────────────────────────────

export const _internal = Object.freeze({
  STORAGE_KEY,
  _todayISO,
  _classifyWeather,
  _hoursSince,
});
