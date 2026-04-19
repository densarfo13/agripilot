/**
 * buildWelcomeMessage.js — state-aware two-line header for the
 * Home screen. Replaces the generic "Hello {name}" greeting with
 * a composition that always reinforces the farmer's current
 * situation.
 *
 *   buildWelcomeMessage({
 *     name, farmerState, weatherNow, timeOfDay, staleData, t, now,
 *   }) → { line1, line2, line1Key?, line2Key?, state }
 *
 * Priority (enforced in code, not docs):
 *
 *   1. STRONG STATE — harvest_complete / post_harvest /
 *      returning_inactive / stale_offline / first_use. These
 *      override time-of-day because the situation is more
 *      informative than what hour it is.
 *   2. WEATHER CONTEXT — rain/heat today. Second line blends
 *      time-of-day greeting + weather cue ("Dry now — rain
 *      later today").
 *   3. TIME-OF-DAY — plain "Good morning, {name}" + a short,
 *      context-flavored second line.
 *
 * Rules:
 *   • Never emit "Hello {name}" alone — there's always a line2
 *     with substance.
 *   • Never emit high-confidence weather claims when data is
 *     stale — the stale_offline branch handles that.
 *   • All localized via t() with English fallback baked in, so
 *     the UI never renders a raw i18n key.
 */

import { STATE_TYPES } from '../farmerState/statePriority.js';

function resolve(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  if (!v || v === key) return fallback;
  return v;
}

function interpolate(text, vars = {}) {
  if (!text) return text;
  return String(text).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) =>
    vars[k] == null ? '' : String(vars[k]));
}

function pickTimeOfDay(timeOfDay, now) {
  if (timeOfDay === 'morning' || timeOfDay === 'afternoon' || timeOfDay === 'evening') {
    return timeOfDay;
  }
  const d = now instanceof Date ? now : new Date(now || Date.now());
  // UTC hours so the decision is deterministic regardless of
  // local timezone. Callers that need local-time greetings pass
  // an explicit `timeOfDay` override.
  const h = d.getUTCHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function weatherSubtitle(weatherNow, t) {
  if (!weatherNow) return null;
  const rainHigh = weatherNow.rainRisk === 'high'
    || Number(weatherNow.rainMmNext24h) >= 25;
  const heatHigh = weatherNow.heatRisk === 'high'
    || Number(weatherNow.tempHighC) >= 35;
  if (rainHigh && weatherNow.rainRiskNow !== 'high') {
    return {
      key: 'home.subtitle.dry_now_rain_later',
      fallback: 'Dry now \u2014 rain later today',
    };
  }
  if (rainHigh) {
    return {
      key: 'home.subtitle.rain_coming',
      fallback: 'Rain is coming later today',
    };
  }
  if (heatHigh) {
    return {
      key: 'home.subtitle.heat_expected',
      fallback: 'Heat expected today',
    };
  }
  return null;
}

function timeOfDayKey(tod) {
  return ({
    morning:   'home.welcome.good_morning_name',
    afternoon: 'home.welcome.good_afternoon_name',
    evening:   'home.welcome.good_evening_name',
  })[tod] || 'home.welcome.good_morning_name';
}

function timeOfDayFallback(tod) {
  return ({
    morning:   'Good morning, {name}',
    afternoon: 'Good afternoon, {name}',
    evening:   'Good evening, {name}',
  })[tod] || 'Good morning, {name}';
}

/**
 * Main entry. Never throws; always returns a stable object
 * shape even for empty / malformed input.
 */
export function buildWelcomeMessage(input = {}) {
  const safe = input && typeof input === 'object' ? input : {};
  const {
    name = '', farmerState = null, weatherNow = null,
    timeOfDay = null, staleData = false, t = null, now = Date.now(),
  } = safe;
  const displayName = String(name || '').trim() || resolve(t, 'home.welcome.fallback_name', 'there');
  const tod = pickTimeOfDay(timeOfDay, now);
  const stateType = farmerState?.stateType || null;

  // 1. STRONG STATES override everything.
  if (stateType === STATE_TYPES.HARVEST_COMPLETE) {
    return {
      line1: resolve(t, 'home.welcome.harvest_complete', 'Harvest complete 🌾'),
      line2: resolve(t, 'home.subtitle.prepare_field_next_cycle',
        'Prepare your field for the next cycle'),
      line1Key: 'home.welcome.harvest_complete',
      line2Key: 'home.subtitle.prepare_field_next_cycle',
      state: stateType,
    };
  }
  if (stateType === STATE_TYPES.POST_HARVEST) {
    return {
      line1: resolve(t, 'home.welcome.post_harvest', 'Post-harvest check-in'),
      line2: resolve(t, 'home.subtitle.review_next_crop', 'Review your next crop'),
      line1Key: 'home.welcome.post_harvest',
      line2Key: 'home.subtitle.review_next_crop',
      state: stateType,
    };
  }
  if (stateType === STATE_TYPES.FIELD_RESET) {
    return {
      line1: resolve(t, 'home.welcome.field_reset', 'Finish clearing your field'),
      line2: resolve(t, 'home.subtitle.field_cleanup_first',
        'Clear the field before the next planting'),
      line1Key: 'home.welcome.field_reset',
      line2Key: 'home.subtitle.field_cleanup_first',
      state: stateType,
    };
  }
  if (stateType === STATE_TYPES.RETURNING_INACTIVE) {
    const template = resolve(t, 'home.welcome.welcome_back_name', 'Welcome back, {name}');
    return {
      line1: interpolate(template, { name: displayName }),
      line2: resolve(t, 'home.subtitle.lets_get_back_on_track',
        'Let\u2019s get back on track'),
      line1Key: 'home.welcome.welcome_back_name',
      line2Key: 'home.subtitle.lets_get_back_on_track',
      state: stateType,
    };
  }
  if (stateType === STATE_TYPES.STALE_OFFLINE || staleData === true) {
    return {
      line1: resolve(t, 'home.welcome.based_on_last_update',
        'Based on your last update'),
      line2: resolve(t, 'home.subtitle.check_field_today', 'Check your field today'),
      line1Key: 'home.welcome.based_on_last_update',
      line2Key: 'home.subtitle.check_field_today',
      state: stateType || 'stale_offline',
    };
  }
  if (stateType === STATE_TYPES.FIRST_USE) {
    const template = resolve(t, 'home.welcome.welcome_name', 'Welcome, {name}');
    return {
      line1: interpolate(template, { name: displayName }),
      line2: resolve(t, 'home.subtitle.lets_set_up',
        'Let\u2019s set up your first crop'),
      line1Key: 'home.welcome.welcome_name',
      line2Key: 'home.subtitle.lets_set_up',
      state: stateType,
    };
  }

  // 2. Time-of-day greeting + weather cue
  const todKey = timeOfDayKey(tod);
  const todFallback = timeOfDayFallback(tod);
  const line1 = interpolate(resolve(t, todKey, todFallback), { name: displayName });
  const weatherSub = !staleData ? weatherSubtitle(weatherNow, t) : null;
  if (weatherSub) {
    return {
      line1,
      line2: resolve(t, weatherSub.key, weatherSub.fallback),
      line1Key: todKey,
      line2Key: weatherSub.key,
      state: stateType || 'active_cycle',
    };
  }

  // 3. Generic state-flavored subtitle — we always emit SOMETHING
  //    for line2 so the greeting never looks empty.
  const activeSub = stateType === STATE_TYPES.ACTIVE_CYCLE
    ? { key: 'home.subtitle.here_whats_next', fallback: 'Here\u2019s what\u2019s next' }
    : { key: 'home.subtitle.nothing_urgent', fallback: 'Nothing urgent — check today\u2019s task' };
  return {
    line1,
    line2: resolve(t, activeSub.key, activeSub.fallback),
    line1Key: todKey,
    line2Key: activeSub.key,
    state: stateType || 'active_cycle',
  };
}

export const _internal = {
  pickTimeOfDay, weatherSubtitle, timeOfDayKey, timeOfDayFallback, interpolate,
};
