/**
 * notificationDecisionEngine.js — pure decision helper for the
 * Indispensable Home Loop §11.
 *
 *   import { getNotificationForToday } from '../core/notificationDecisionEngine.js';
 *
 *   const notif = getNotificationForToday({
 *     weather:   { humidity, rainExpected },
 *     memory:    getUserMemory(),
 *     riskLevel: 'low' | 'medium' | 'high',
 *     hasPrimaryAction: true,
 *     timeOfDay: 'morning' | 'afternoon' | 'evening',
 *   });
 *
 *   // → null when no notification should fire today, or:
 *   // {
 *   //   key,                       // stable de-dup key
 *   //   type,                      // 'morning_first_action' | 'rain' | 'humidity' | 'inactive'
 *   //   priority,                  // 'high' | 'medium' | 'low'
 *   //   titleKey, titleFallback,
 *   //   bodyKey,  bodyFallback,
 *   // }
 *
 * What this is NOT
 * ────────────────
 *   • Not a sender. We never call Twilio / SendGrid / push from
 *     here — this returns a *decision*. The existing
 *     `src/lib/notifications/notificationDispatcher.js` is the
 *     real send pipeline; this engine is a tiny opinionated
 *     decider for the Home Loop spec that other code can route
 *     into the dispatcher (or not).
 *   • Not a scheduler. Caller picks the time-of-day; we just
 *     decide what's appropriate given the inputs.
 *
 * Limits (per spec §11)
 * ─────────────────────
 *   • At most 1 morning notification (the first matching rule wins)
 *   • At most 1 risk notification (separate from morning — caller
 *     decides whether to combine)
 *   • No generic reminders — we only emit when a real signal fires
 */

const TYPE_MORNING  = 'morning_first_action';
const TYPE_RAIN     = 'rain';
const TYPE_HUMIDITY = 'humidity';
const TYPE_INACTIVE = 'inactive';

function _today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function _missedDays(memory) {
  if (!memory || typeof memory !== 'object') return 0;
  const explicit = Number(memory.missedDays);
  if (Number.isFinite(explicit)) return explicit;
  // Derive from lastActiveDate (ISO yyyy-mm-dd) when missedDays
  // isn't materialised.
  const last = memory.lastActiveDate;
  if (!last) return 0;
  const lastTs = new Date(String(last) + 'T00:00:00Z').getTime();
  if (!Number.isFinite(lastTs)) return 0;
  const now = Date.now();
  const days = Math.floor((now - lastTs) / 86_400_000);
  return Math.max(0, days);
}

/**
 * @param {{
 *   weather?: { humidity?: number, rainExpected?: boolean },
 *   memory?: object,
 *   riskLevel?: 'low'|'medium'|'high',
 *   hasPrimaryAction?: boolean,
 *   timeOfDay?: 'morning'|'afternoon'|'evening',
 * }} input
 * @returns {object|null}
 */
export function getNotificationForToday(input = {}) {
  const w   = (input.weather && typeof input.weather === 'object') ? input.weather : {};
  const mem = (input.memory  && typeof input.memory  === 'object') ? input.memory  : {};
  const day = _today();

  const humidity     = Number(w.humidity);
  const rainExpected = w.rainExpected === true;
  const isHumid      = Number.isFinite(humidity) && humidity > 70;
  const inactive     = _missedDays(mem) >= 2;
  const isMorning    = String(input.timeOfDay || 'morning').toLowerCase() === 'morning';

  // Precedence (per spec §11):
  //   1. inactive 2+ days → "back on track" (highest user-impact)
  //   2. rain expected    → "check before watering"
  //   3. high humidity    → "check leaves"
  //   4. morning + has primary action → "open Farroway first"
  //
  // Only one is returned per call. Caller may invoke a second
  // time with different `timeOfDay` to fetch a risk notification.

  if (inactive) {
    return {
      key:           `inactive:${day}`,
      type:          TYPE_INACTIVE,
      priority:      'medium',
      titleKey:      'notification.inactive.title',
      titleFallback: 'Welcome back',
      bodyKey:       'notification.inactive.body',
      bodyFallback:  'Let\u2019s get back on track \u2014 start with one quick check.',
    };
  }

  if (rainExpected) {
    return {
      key:           `rain:${day}`,
      type:          TYPE_RAIN,
      priority:      'high',
      titleKey:      'notification.rain.title',
      titleFallback: 'Rain expected today',
      bodyKey:       'notification.rain.body',
      bodyFallback:  'Rain expected \u2014 check before watering today.',
    };
  }

  if (isHumid) {
    return {
      key:           `humidity:${day}`,
      type:          TYPE_HUMIDITY,
      priority:      'high',
      titleKey:      'notification.humidity.title',
      titleFallback: 'Humidity is high',
      bodyKey:       'notification.humidity.body',
      bodyFallback:  'Humidity is high \u2014 check leaves today.',
    };
  }

  if (isMorning && input.hasPrimaryAction === true) {
    return {
      key:           `morning:${day}`,
      type:          TYPE_MORNING,
      priority:      'medium',
      titleKey:      'notification.morning.title',
      titleFallback: 'Open Farroway first',
      bodyKey:       'notification.morning.body',
      // Daily Habit Loop §8 — copy must mirror Home's trigger.
      bodyFallback:  'Before you water\u2014check Farroway first',
    };
  }

  return null;
}

export const _internal = Object.freeze({
  TYPE_MORNING, TYPE_RAIN, TYPE_HUMIDITY, TYPE_INACTIVE,
  _today, _missedDays,
});
