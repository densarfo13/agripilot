/**
 * reminderEngine.js — message-picker for the daily retention loop.
 *
 * Pure: takes facts in, returns the i18n key + sensible English
 * fallback for a single message. Caller renders via tStrict.
 *
 * Three reminder variants (per spec §1)
 * ─────────────────────────────────────
 *   • default                   "Today's farm task is ready"
 *   • weather rain warning      "Rain today — check your farm plan"
 *   • missed yesterday          "You missed a task. Let's get back on track."
 *
 * Plus the spec §5 micro-reward picker — small encouraging messages
 * shown subtly after a task completion, deterministic per-day so
 * the same message doesn't flicker on re-render. NOT random per
 * call (that would feel jittery on slow networks where the
 * completion screen re-mounts as data lands).
 *
 * Plus the spec §7 return-incentive picker — fires when the user
 * has been away ≥ 2 days. Single message: "We've prepared your
 * next steps".
 *
 * No state, no side effects. Caller decides when to show what.
 */

const REMINDER = Object.freeze({
  DEFAULT:   { key: 'retention.reminder.default',   fallback: "Today's farm task is ready" },
  WEATHER:   { key: 'retention.reminder.weather',   fallback: 'Rain today — check your farm plan' },
  MISSED:    { key: 'retention.reminder.missed',    fallback: "You missed a task. Let's get back on track." },
  RETURN:    { key: 'retention.reminder.return',    fallback: "We've prepared your next steps" },
  ALL_DONE:  { key: 'retention.reminder.allDone',   fallback: "You're done for today" },
  NEW_STREAK:{ key: 'retention.reminder.newStreak', fallback: "Let's start a new streak today" },
});

const MICRO = Object.freeze([
  { key: 'retention.micro.goodProgress', fallback: 'Good progress today' },
  { key: 'retention.micro.keepGoing',    fallback: 'Keep it going' },
  { key: 'retention.micro.doingGreat',   fallback: "You're doing great" },
]);

/**
 * Look at the rainfall signal on the weather summary the existing
 * page already loads (Open-Meteo). The shape varies — accept the
 * common variants without adding any new fetch.
 */
function _isRainExpected(weather) {
  if (!weather || typeof weather !== 'object') return false;
  if (weather.status === 'unavailable') return false;
  // Newer engine: explicit `rainfallState`.
  const state = String(weather.rainfallState || weather.rainfall || '').toLowerCase();
  if (state === 'rain' || state === 'raining' || state === 'rainingnow'
      || state === 'rainlater' || state === 'heavyrain'
      || state === 'moderate_rain' || state === 'heavy_rain' || state === 'light_rain') {
    return true;
  }
  // Fallback: precipitation probability percentages.
  const pop = Number(weather.precipitationProbability ?? weather.pop);
  if (Number.isFinite(pop) && pop >= 60) return true;
  // Fallback: precipitation millimetres in the next 24h.
  const mm = Number(weather.precipMm24h ?? weather.precipMm);
  if (Number.isFinite(mm) && mm >= 2) return true;
  return false;
}

/**
 * Pick the reminder banner for today.
 *
 * @param {object} args
 * @param {object} args.retention   shape returned by getRetentionState()
 * @param {boolean} args.missedYesterday  cheaper to pass in than recompute
 * @param {object|null} args.weather  the page's existing weather summary
 * @param {boolean} args.todayCompleted  whether today's primary task is done
 * @param {number|null} args.daysSinceVisit  result of daysSinceLastVisit()
 * @returns {{ key: string, fallback: string, variant: string } | null}
 */
export function pickReminderMessage({
  retention,
  missedYesterday: missedFlag,
  weather,
  todayCompleted,
  daysSinceVisit,
} = {}) {
  // Done for today wins — no banner clutter on a clean day.
  if (todayCompleted) {
    return { ...REMINDER.ALL_DONE, variant: 'all_done' };
  }
  // Long absence trumps everything else (return incentive).
  if (Number.isFinite(daysSinceVisit) && daysSinceVisit >= 2) {
    return { ...REMINDER.RETURN, variant: 'return' };
  }
  // Missed-yesterday with a streak that's about to reset gets a
  // soft "let's start a new streak" rather than the harsher "you
  // missed a task" — both stay non-punitive.
  if (missedFlag) {
    if (retention && retention.streakDays > 0) {
      return { ...REMINDER.MISSED, variant: 'missed' };
    }
    return { ...REMINDER.NEW_STREAK, variant: 'new_streak' };
  }
  // Rain signal trumps the default reminder.
  if (_isRainExpected(weather)) {
    return { ...REMINDER.WEATHER, variant: 'weather' };
  }
  return { ...REMINDER.DEFAULT, variant: 'default' };
}

/**
 * Pick a micro-reward message. Deterministic per-day so re-renders
 * on the completion screen never flicker between strings, but
 * different on consecutive days for variety.
 *
 * @param {Date} [now]  override for tests
 * @returns {{ key: string, fallback: string }}
 */
export function pickMicroReward(now = new Date()) {
  // Lightweight day-of-year hash → index into MICRO.
  const dayKey = (now.getFullYear() * 1000) + (now.getMonth() * 32) + now.getDate();
  const idx = ((dayKey % MICRO.length) + MICRO.length) % MICRO.length;
  return MICRO[idx];
}

/**
 * "Browser-notification (basic)" hook the spec calls for in §1.
 * Fires a lightweight `Notification(...)` when:
 *   • the browser supports the API
 *   • permission is already 'granted' (we never *prompt* here —
 *     a prompt should be initiated from a user-gesture flow, not
 *     a passive page load)
 *   • the message text is non-empty
 *
 * Returns true if a notification was fired. Never throws.
 */
export function maybeShowBrowserNotification(text, opts = {}) {
  try {
    if (!text || typeof text !== 'string') return false;
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    new Notification(text, {
      icon: opts.icon || '/icons/farroway-192.png',
      tag:  opts.tag  || 'farroway-daily-reminder',
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}

// Test seams.
export const _internal = Object.freeze({ REMINDER, MICRO, _isRainExpected });
