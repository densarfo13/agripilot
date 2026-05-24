/**
 * timingEngine.js — picks the right time-of-day for an action
 * given weather, urgency, and quiet hours.
 *
 *   import { optimalTimingFor, TIMING_SLOT }
 *     from 'src/core/intelligence/timingEngine.js';
 *
 *   const t = optimalTimingFor({
 *     action: 'water', urgency: 'normal',
 *     weather: { temperatureC: 33 }, nowMs: Date.now(),
 *   });
 *   // t.slot    → 'morning' | 'evening' | 'today' | 'now' | 'tomorrow'
 *   // t.reason  → { key, fallback, params }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure rule engine. Inputs are honest signals (action type +
 *   urgency + weather + current local hour + quiet-hours
 *   preference). Output is a slot label + a one-line reason the
 *   surface can render.
 *
 *   It does NOT schedule notifications (notificationOrchestrator
 *   does that) and does NOT predict weather — it just maps
 *   current signals to a calm time-of-day recommendation.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export const TIMING_SLOT = Object.freeze({
  NOW:      'now',
  MORNING:  'morning',
  EVENING:  'evening',
  TODAY:    'today',
  TOMORROW: 'tomorrow',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _currentHour(nowMs) {
  try {
    const d = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
    return d.getHours();
  } catch { return 12; }
}

function _inQuietHours(hour, start, end) {
  if (typeof hour !== 'number') return false;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/**
 * Optimal timing for an action.
 *
 * @param {object} args
 * @param {string} args.action            'water' | 'inspect' | 'spray' | 'harvest' | 'feed'
 * @param {string} [args.urgency]         'low' | 'normal' | 'high'
 * @param {object} [args.weather]         { temperatureC, humidityPct, rainProbability24hPct, windKmh }
 * @param {object} [args.quietHours]      { start, end } 0–23
 * @param {number} [args.nowMs]
 * @returns {{ slot, reason }}
 */
export function optimalTimingFor(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const action = _str(a.action);
    const urgency = _str(a.urgency) || 'normal';
    const w = (a.weather && typeof a.weather === 'object') ? a.weather : {};
    const temp = _num(w.temperatureC);
    const rainProb = _num(w.rainProbability24hPct);
    const wind = _num(w.windKmh);
    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();
    const hour = _currentHour(nowMs);
    const qStart = Number.isFinite(a.quietHours && a.quietHours.start) ? a.quietHours.start : 21;
    const qEnd = Number.isFinite(a.quietHours && a.quietHours.end) ? a.quietHours.end : 7;
    const isQuiet = _inQuietHours(hour, qStart, qEnd);

    // Spraying — wind/rain dominate.
    if (action === 'spray') {
      if ((wind != null && wind >= 25) || (rainProb != null && rainProb >= 50)) {
        return { slot: TIMING_SLOT.TOMORROW, reason: _msg('timing.reason.no_spray',
          'Conditions are not safe for spraying today — try tomorrow.', {}) };
      }
      return { slot: TIMING_SLOT.MORNING, reason: _msg('timing.reason.morning',
        'Spray in the cool morning before wind picks up.', {}) };
    }

    // Watering — heat shifts to morning; cool weather any time.
    if (action === 'water') {
      if (temp != null && temp >= 30) {
        const slot = hour < 12 ? TIMING_SLOT.MORNING : TIMING_SLOT.EVENING;
        return { slot, reason: _msg('timing.reason.heat',
          'Hot day — water in cool hours to limit evaporation.', {}) };
      }
      if (urgency === 'high') {
        return { slot: TIMING_SLOT.NOW, reason: _msg('timing.reason.urgent',
          'Water now — the plant is showing stress.', {}) };
      }
      return { slot: TIMING_SLOT.MORNING, reason: _msg('timing.reason.routine_water',
        'Morning is the calmest time to water steadily.', {}) };
    }

    // Inspect — after rain is the best leaf-inspection moment.
    if (action === 'inspect') {
      if (rainProb != null && rainProb >= 50) {
        return { slot: TIMING_SLOT.TOMORROW, reason: _msg('timing.reason.inspect_after_rain',
          'Inspect leaves after the rain settles tomorrow.', {}) };
      }
      return { slot: TIMING_SLOT.MORNING, reason: _msg('timing.reason.inspect_morning',
        'Morning light is best for spotting changes on leaves.', {}) };
    }

    // Harvest — high urgency overrides; otherwise cool morning.
    if (action === 'harvest') {
      if (urgency === 'high') {
        return { slot: TIMING_SLOT.NOW, reason: _msg('timing.reason.harvest_now',
          'Pick now — quality drops fast at this stage.', {}) };
      }
      return { slot: TIMING_SLOT.MORNING, reason: _msg('timing.reason.harvest_morning',
        'Harvest in the cool morning for best storage life.', {}) };
    }

    // Quiet hours — non-urgent gets pushed to morning.
    if (isQuiet && urgency !== 'high') {
      return { slot: TIMING_SLOT.MORNING, reason: _msg('timing.reason.quiet_hours',
        'Outside quiet hours — handle this in the morning.', {}) };
    }

    return { slot: TIMING_SLOT.TODAY, reason: _msg('timing.reason.today',
      'Any time today works.', {}) };
  } catch {
    return { slot: TIMING_SLOT.TODAY, reason: _msg('timing.reason.today',
      'Any time today works.', {}) };
  }
}

const _module = { optimalTimingFor, TIMING_SLOT };
export default _module;
