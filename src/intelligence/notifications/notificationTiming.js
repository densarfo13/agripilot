/**
 * notificationTiming — quiet hours + window classification.
 *
 * SPEC §11
 *   • Avoid late-night pushes (quiet hours: 21:00 – 07:00 local).
 *   • Use morning recommendations, afternoon weather reminders,
 *     evening progress summaries.
 *   • Respect timezone, language, user activity patterns.
 *
 * PURE FUNCTIONS — no Date.now() in module body; every helper
 * accepts a Date so tests can pin time without monkey-patching.
 */

export const QUIET_START_HOUR = 21;   // 21:00 local
export const QUIET_END_HOUR   = 7;    // 07:00 local

export const WINDOW = Object.freeze({
  MORNING:   'morning',     // 06:00–11:59
  AFTERNOON: 'afternoon',   // 12:00–17:59
  EVENING:   'evening',     // 18:00–20:59
  NIGHT:     'night',       // 21:00–05:59 (quiet)
});

/**
 * Classify the supplied moment into one of four windows. Defaults
 * to "now" so callers can drop the second argument in production.
 *
 * @param {Date} [when]
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
export function classifyWindow(when = new Date()) {
  const h = (when instanceof Date) ? when.getHours() : new Date().getHours();
  if (h >= 6  && h < 12) return WINDOW.MORNING;
  if (h >= 12 && h < 18) return WINDOW.AFTERNOON;
  if (h >= 18 && h < 21) return WINDOW.EVENING;
  return WINDOW.NIGHT;
}

/**
 * True when `when` falls inside the quiet block (21:00–06:59).
 * Notifications scheduled for this window are deferred to the
 * next morning slot — even IMPORTANT items respect this.
 *
 * @param {Date} [when]
 */
export function isQuietHours(when = new Date()) {
  const h = (when instanceof Date) ? when.getHours() : new Date().getHours();
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/**
 * Compute the next moment at which delivery can fire for a
 * given message kind. Morning-anchored kinds (task summary,
 * progress recap) shift to the next 07:00 local. Weather hints
 * have a different anchor — see WEATHER_PREFERRED_HOUR.
 *
 * @param {Date} from
 * @param {'morning'|'afternoon'|'evening'} preferred
 * @returns {Date}
 */
export function nextDeliveryAt(from, preferred = WINDOW.MORNING) {
  const out = (from instanceof Date) ? new Date(from.getTime()) : new Date();
  const h   = out.getHours();

  // Hour to land on per preferred window.
  const targetHour = preferred === WINDOW.AFTERNOON
    ? 13
    : preferred === WINDOW.EVENING
      ? 19
      : 8; // morning default

  // If we're already past the target hour today, push to tomorrow.
  if (h >= targetHour) {
    out.setDate(out.getDate() + 1);
  }
  out.setHours(targetHour, 0, 0, 0);
  return out;
}

const _module = {
  QUIET_START_HOUR,
  QUIET_END_HOUR,
  WINDOW,
  classifyWindow,
  isQuietHours,
  nextDeliveryAt,
};
export default _module;
