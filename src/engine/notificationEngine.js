/**
 * Notification Decision Engine — pure function, no React, no side effects.
 *
 * Given the same inputs that drive the farmer Home screen, decides whether
 * a farmer should receive a notification today and, if so, which type,
 * with localized title/body keys and a dedupe key that prevents spam.
 *
 * Three notification types only (spec §2):
 *   - daily     → one morning recommended task
 *   - weather   → weather materially changed the action
 *   - critical  → meaningful loss risk if action is delayed
 *
 * The engine NEVER decides "send it" without a concrete action. If there
 * is no actionable task (or the task is already done) it returns
 * { shouldSend: false } — spec §1 forbids generic "open the app" pings.
 */

// ─── Time windows / thresholds ─────────────────────────────
const MORNING_HOUR_START = 6;   // 06:00 local
const MORNING_HOUR_END = 10;    // 10:00 local (generous catch for farmers opening late)
const MIN_FRESH_MINUTES = 60;   // weather older than this = stale → skip
const DAILY_COOLDOWN_H = 18;    // at most one daily per 18h (spec §3)
const WEATHER_COOLDOWN_H = 6;   // at most one weather alert per 6h per reason
const CRITICAL_COOLDOWN_H = 3;  // critical can be faster but still rate-limited

// ─── Helpers ───────────────────────────────────────────────

function todayDateStr(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isInMorningWindow(now = new Date()) {
  const h = now.getHours();
  return h >= MORNING_HOUR_START && h < MORNING_HOUR_END;
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (60 * 60 * 1000);
}

function minutesSince(epochMs) {
  if (!epochMs) return Infinity;
  return (Date.now() - epochMs) / (60 * 1000);
}

function recentlySent(history = [], dedupeKey, withinHours) {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return history.some(e => e.dedupeKey === dedupeKey && e.sentAt >= cutoff);
}

function anyRecentByType(history = [], type, withinHours) {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return history.some(e => e.type === type && e.sentAt >= cutoff);
}

// ─── Weather signal extraction ─────────────────────────────
// Small, deterministic rules — same spirit as autopilot buildRuleContext.

function readWeatherFlags(weather, forecast) {
  const out = { rainingNow: false, rainTodayLikely: false, rainTomorrowLikely: false, isDryHot: false, isWindy: false, stale: false };
  if (!weather) { out.stale = true; return out; }

  const currentPrecip = weather.current?.precipitation ?? 0;
  const wmoCode = weather.current?.weatherCode ?? weather.current?.weather_code ?? 0;
  const todayPrecip = weather.daily?.precipitation_sum?.[0] ?? 0;
  const wind = weather.current?.windSpeed ?? weather.current?.wind_speed_10m ?? 0;
  const temp = weather.current?.temperature ?? weather.current?.temperature_2m ?? 0;
  const humidity = weather.current?.humidity ?? weather.current?.relative_humidity_2m ?? 50;

  out.rainingNow = currentPrecip >= 0.5 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(wmoCode);
  out.rainTodayLikely = !out.rainingNow && todayPrecip >= 2;
  out.isDryHot = temp >= 32 && humidity <= 45;
  out.isWindy = wind >= 20;

  const tomorrow = forecast?.dailyRain?.[1];
  out.rainTomorrowLikely = !!(tomorrow && tomorrow.isWet);

  return out;
}

// ─── Rule set ─────────────────────────────────────────────
// Each rule is checked in order; first match wins.
// A rule returns a NotificationDecision shape or null.

function buildDedupeKey({ type, actionKey, dateStr, reason }) {
  return [type, actionKey || 'generic', dateStr, reason || 'none'].join('|');
}

/**
 * Critical-risk rules — ran first because they ignore the morning window.
 */
function checkCritical({ currentTask, urgency, flags, dateStr, cropStage, actionKey }) {
  if (flags.stale) return null;

  // 1. Exposed harvest + rain today/tomorrow → protect NOW
  const atHarvest = ['harvest', 'post_harvest'].includes(cropStage || '');
  if (atHarvest && (flags.rainTodayLikely || flags.rainingNow)) {
    return {
      shouldSend: true,
      type: 'critical',
      titleKey: 'notification.critical.rain_harvest.title',
      bodyKey: 'notification.critical.rain_harvest.body',
      deeplinkTarget: currentTask?.id ? `/dashboard?task=${currentTask.id}` : '/dashboard',
      urgency: 'critical',
      dedupeKey: buildDedupeKey({ type: 'critical', actionKey: 'protect_harvest', dateStr, reason: 'rain_today' }),
    };
  }

  // 2. Explicit critical urgency from decision engine → escalate
  if (urgency === 'critical' && currentTask) {
    return {
      shouldSend: true,
      type: 'critical',
      titleKey: 'notification.critical.generic.title',
      bodyKey: 'notification.critical.generic.body',
      deeplinkTarget: `/dashboard?task=${currentTask.id}`,
      urgency: 'critical',
      dedupeKey: buildDedupeKey({ type: 'critical', actionKey: actionKey || currentTask.id, dateStr, reason: 'urgency_critical' }),
    };
  }

  return null;
}

/**
 * Weather-triggered rules — only when weather materially changes action.
 */
function checkWeather({ currentTask, flags, dateStr, cropStage }) {
  if (flags.stale || !currentTask) return null;
  const title = (currentTask.title || '').toLowerCase();
  const action = (currentTask.actionType || '').toLowerCase();
  const textMatch = (k) => title.includes(k) || action.includes(k);

  // Spray + windy → delay
  if (flags.isWindy && (textMatch('spray') || textMatch('fungicid') || textMatch('pesticid'))) {
    return {
      shouldSend: true,
      type: 'weather',
      titleKey: 'notification.weather.delay_spray.title',
      bodyKey: 'notification.weather.delay_spray.body',
      deeplinkTarget: `/dashboard?task=${currentTask.id}`,
      urgency: 'today',
      dedupeKey: buildDedupeKey({ type: 'weather', actionKey: 'delay_spray', dateStr, reason: 'wind' }),
    };
  }

  // Heat high + watering or growing stage → water today
  if (flags.isDryHot && (textMatch('water') || textMatch('irrigat'))) {
    return {
      shouldSend: true,
      type: 'weather',
      titleKey: 'notification.weather.water_heat.title',
      bodyKey: 'notification.weather.water_heat.body',
      deeplinkTarget: `/dashboard?task=${currentTask.id}`,
      urgency: 'today',
      dedupeKey: buildDedupeKey({ type: 'weather', actionKey: 'water_heat', dateStr, reason: 'heat' }),
    };
  }

  // Rain tomorrow + harvest task → protect today
  if (flags.rainTomorrowLikely && (textMatch('harvest') || textMatch('pick'))) {
    return {
      shouldSend: true,
      type: 'weather',
      titleKey: 'notification.weather.protect_harvest.title',
      bodyKey: 'notification.weather.protect_harvest.body',
      deeplinkTarget: `/dashboard?task=${currentTask.id}`,
      urgency: 'today',
      dedupeKey: buildDedupeKey({ type: 'weather', actionKey: 'protect_harvest', dateStr, reason: 'rain_tomorrow' }),
    };
  }

  return null;
}

/**
 * Daily task rule — one morning nudge if there is a real pending task
 * and the farmer hasn't already completed it today.
 */
function checkDaily({ currentTask, completedToday, actionKey, dateStr, urgency }) {
  if (!currentTask) return null;
  if (completedToday) return null;

  // Urgency determines message template so copy isn't generic
  const bucketKey = urgency === 'today' ? 'today' : urgency === 'this_week' ? 'week' : 'generic';

  return {
    shouldSend: true,
    type: 'daily',
    titleKey: `notification.daily.${bucketKey}.title`,
    bodyKey: `notification.daily.${bucketKey}.body`,
    deeplinkTarget: `/dashboard?task=${currentTask.id}`,
    urgency: urgency || 'this_week',
    dedupeKey: buildDedupeKey({ type: 'daily', actionKey: actionKey || currentTask.id, dateStr, reason: bucketKey }),
    titleVars: { task: currentTask.title || '' },
    bodyVars: { task: currentTask.title || '' },
  };
}

// ─── Public API ───────────────────────────────────────────

/**
 * Produce a NotificationDecision for the given farm/crop/weather context.
 *
 * @param {Object} params
 * @param {Object} params.farm              - Active farm profile
 * @param {string} params.crop              - Crop code
 * @param {string} params.cropStage         - Current crop stage
 * @param {Object} params.weather           - Weather payload (current + daily)
 * @param {Object} params.forecast          - Rainfall engine output (dailyRain[])
 * @param {Object} params.currentTask       - The same task Home is showing
 * @param {string} params.urgency           - From urgency resolver
 * @param {boolean} params.completedToday   - Did farmer already complete it today?
 * @param {Array}  params.history           - Notification history ring buffer
 * @param {number} params.weatherFetchedAt  - epoch ms — used to skip stale data
 * @param {Object} params.preferences       - { daily, weather, critical, quietHoursOk }
 * @param {Date}   params.now               - defaults to new Date()
 * @returns {Object} { shouldSend, type?, titleKey?, bodyKey?, deeplinkTarget?, urgency?, dedupeKey?, skipReason? }
 */
export function getDailyNotificationDecision(params = {}) {
  const {
    farm, crop, cropStage, weather, forecast,
    currentTask, urgency, completedToday, history = [],
    weatherFetchedAt, preferences = {}, now = new Date(),
    actionKey,
  } = params;

  const prefs = {
    daily: preferences.daily !== false,
    weather: preferences.weather !== false,
    critical: preferences.critical !== false,
  };

  // ─── Early exits ────────────────────────────────────────
  if (!farm) return { shouldSend: false, skipReason: 'no_farm' };
  if (!currentTask && !weather) return { shouldSend: false, skipReason: 'no_context' };

  // Spec §13: trust over volume — stale weather can produce wrong advice.
  if (weatherFetchedAt && minutesSince(weatherFetchedAt) > MIN_FRESH_MINUTES) {
    return { shouldSend: false, skipReason: 'stale_weather' };
  }

  const dateStr = todayDateStr(now);
  const flags = readWeatherFlags(weather, forecast);

  // ─── 1. Critical — first priority, ignores morning window ─
  if (prefs.critical) {
    const crit = checkCritical({ currentTask, urgency, flags, dateStr, cropStage, actionKey });
    if (crit) {
      if (recentlySent(history, crit.dedupeKey, CRITICAL_COOLDOWN_H)) {
        return { shouldSend: false, skipReason: 'deduped_critical' };
      }
      return { ...crit, scheduledTime: now.toISOString() };
    }
  }

  // ─── 2. Weather-triggered — only if action materially changes ─
  if (prefs.weather) {
    const wx = checkWeather({ currentTask, flags, dateStr, cropStage });
    if (wx) {
      if (recentlySent(history, wx.dedupeKey, WEATHER_COOLDOWN_H)) {
        return { shouldSend: false, skipReason: 'deduped_weather' };
      }
      return { ...wx, scheduledTime: now.toISOString() };
    }
  }

  // ─── 3. Daily — morning window + no duplicate today ──────
  if (prefs.daily) {
    if (!isInMorningWindow(now)) {
      return { shouldSend: false, skipReason: 'outside_morning_window' };
    }
    if (anyRecentByType(history, 'daily', DAILY_COOLDOWN_H)) {
      return { shouldSend: false, skipReason: 'already_sent_today' };
    }
    const daily = checkDaily({ currentTask, completedToday, actionKey, dateStr, urgency });
    if (daily) {
      if (recentlySent(history, daily.dedupeKey, DAILY_COOLDOWN_H)) {
        return { shouldSend: false, skipReason: 'deduped_daily' };
      }
      return { ...daily, scheduledTime: now.toISOString() };
    }
  }

  return { shouldSend: false, skipReason: 'no_actionable_rule' };
}

// Exposed for tests
export const _internal = { readWeatherFlags, isInMorningWindow, todayDateStr, buildDedupeKey };
