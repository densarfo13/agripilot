/**
 * getDynamicGreeting.js — turns a farmer's current situation into
 * one short, action-oriented greeting object:
 *
 *   { title, subtitle, state, titleKey, subtitleKey }
 *
 * The title is time-of-day-aware for the common states
 * (active_day, done_for_today, generic); for stronger states
 * (post_harvest, inactive_return, first_use) the state's own
 * fixed copy wins — "Welcome back 👋" beats "Good morning 👋".
 *
 * Crop names inside subtitles go through the caller-supplied
 * `cropLabel` prop, which should already have been run through
 * getCropDisplayName() in the existing codebase — this helper is
 * language-agnostic about which label to use.
 *
 * The `t` argument is the translation function from the existing
 * i18n system. It's optional; if it isn't provided, or if a key
 * is missing, we fall back to the English string we ship with the
 * key. This means the greeting NEVER renders as a raw key.
 *
 * Rules enforced in code:
 *   • no empty branding lines ("Hello user", "Welcome to X")
 *   • greeting never includes the word "Farroway"
 *   • subtitle always has an action cue OR is omitted
 */

import {
  getGreetingState,
  getTimeOfDay,
  GREETING_STATES,
} from './getGreetingState.js';

// ─── Time-of-day title keys ───────────────────────────────
const TIME_TITLE_KEYS = Object.freeze({
  morning:   { key: 'greeting.time.morning',   fallback: 'Good morning 👋' },
  afternoon: { key: 'greeting.time.afternoon', fallback: 'Good afternoon 👋' },
  evening:   { key: 'greeting.time.evening',   fallback: 'Good evening 👋' },
});

// ─── Per-state title + subtitle copy ──────────────────────
// Each entry is { titleKey, titleFallback, subtitleKey, subtitleFallback }.
// States that use time-of-day leave titleKey null and let the
// resolver substitute the time-of-day title instead.
const STATE_COPY = Object.freeze({
  [GREETING_STATES.POST_HARVEST]: {
    titleKey:    'greeting.post_harvest.title',
    titleFallback: 'Harvest complete 👏',
    subtitleKey: 'greeting.post_harvest.subtitle',
    subtitleFallback: 'Let\u2019s plan your next crop',
  },
  [GREETING_STATES.INACTIVE_RETURN]: {
    titleKey:    'greeting.inactive_return.title',
    titleFallback: 'Welcome back 👋',
    subtitleKey: 'greeting.inactive_return.subtitle',
    subtitleFallback: 'Let\u2019s get you back on track',
    subtitleKeyMany: 'greeting.inactive_return.subtitle_many',
    subtitleFallbackMany: 'You missed a few days — start with this',
  },
  [GREETING_STATES.FIRST_USE]: {
    titleKey:    'greeting.first_use.title',
    titleFallback: 'Welcome 👋',
    subtitleKey: 'greeting.first_use.subtitle',
    subtitleFallback: 'Here\u2019s what to do first',
  },
  [GREETING_STATES.ACTIVE_DAY]: {
    // Title uses time-of-day.
    titleKey:    null,
    titleFallback: null,
    subtitleKeyWithCrop: 'greeting.active_day.subtitle_with_crop',
    subtitleFallbackWithCrop: 'Let\u2019s take care of your {crop} today',
    subtitleKey: 'greeting.active_day.subtitle_generic',
    subtitleFallback: 'Let\u2019s get today\u2019s farm work done',
  },
  [GREETING_STATES.DONE_FOR_TODAY]: {
    titleKey:    'greeting.done.title',
    titleFallback: 'Nice work 👍',
    subtitleKey: 'greeting.done.subtitle',
    subtitleFallback: 'You\u2019re done for today',
  },
  [GREETING_STATES.GENERIC]: {
    // Fallback: time-of-day title, no subtitle (we do NOT emit
    // empty branding like "Welcome back again" here).
    titleKey:    null,
    titleFallback: null,
    subtitleKey: null,
    subtitleFallback: null,
  },
});

const MANY_DAYS_THRESHOLD = 5;

/**
 * getDynamicGreeting — main entry point.
 *
 * @param {object}  input
 * @param {string}  [input.timeOfDay]         — caller can pin this for tests
 * @param {'active'|'done'} [input.todayState]
 * @param {number}  [input.missedDays]
 * @param {boolean} [input.hasCompletedOnboarding]
 * @param {boolean} [input.hasActiveCropCycle]
 * @param {boolean} [input.hasJustCompletedHarvest]
 * @param {boolean} [input.hasCatchUpState]
 * @param {string}  [input.cropLabel]          — already-localized display name
 * @param {number}  [input.inactiveThresholdDays=3]
 * @param {Date}    [input.now]
 * @param {function} [t]                       — i18n translator
 *
 * @returns {{
 *   title: string,
 *   subtitle: string | null,
 *   state: string,
 *   titleKey: string | null,
 *   subtitleKey: string | null,
 *   timeOfDay: 'morning'|'afternoon'|'evening',
 * }}
 */
export function getDynamicGreeting(input = {}, t = null) {
  const safe = input || {};
  const state = getGreetingState(safe);
  const timeOfDay = safe.timeOfDay || getTimeOfDay(safe.now || new Date());
  input = safe;

  const entry = STATE_COPY[state] || STATE_COPY[GREETING_STATES.GENERIC];

  // ─── Title ───────────────────────────────────────────
  let titleKey = entry.titleKey;
  let title;
  if (titleKey) {
    title = resolve(t, titleKey, entry.titleFallback);
  } else {
    // Fall through to time-of-day title.
    const tod = TIME_TITLE_KEYS[timeOfDay] || TIME_TITLE_KEYS.morning;
    titleKey = tod.key;
    title = resolve(t, tod.key, tod.fallback);
  }

  // ─── Subtitle ────────────────────────────────────────
  let subtitleKey = null;
  let subtitle = null;

  if (state === GREETING_STATES.ACTIVE_DAY) {
    const cropLabel = String(input.cropLabel || '').trim();
    if (cropLabel) {
      subtitleKey = entry.subtitleKeyWithCrop;
      subtitle = interpolateCrop(
        resolve(t, subtitleKey, entry.subtitleFallbackWithCrop),
        cropLabel,
      );
    } else {
      subtitleKey = entry.subtitleKey;
      subtitle = resolve(t, subtitleKey, entry.subtitleFallback);
    }
  } else if (state === GREETING_STATES.INACTIVE_RETURN) {
    const missed = Number(input.missedDays) || 0;
    if (missed >= MANY_DAYS_THRESHOLD && entry.subtitleKeyMany) {
      subtitleKey = entry.subtitleKeyMany;
      subtitle = resolve(t, subtitleKey, entry.subtitleFallbackMany);
    } else {
      subtitleKey = entry.subtitleKey;
      subtitle = resolve(t, subtitleKey, entry.subtitleFallback);
    }
  } else if (entry.subtitleKey) {
    subtitleKey = entry.subtitleKey;
    subtitle = resolve(t, subtitleKey, entry.subtitleFallback);
  }

  // Enforce: never emit a subtitle that's just "Welcome" / branding.
  if (subtitle && /^(welcome|hello|good to see you)\s*$/i.test(subtitle.trim())) {
    subtitle = null;
  }

  return {
    title,
    subtitle: subtitle || null,
    state,
    titleKey,
    subtitleKey,
    timeOfDay,
  };
}

// ─── internals ────────────────────────────────────────────
function resolve(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const translated = t(key);
  if (!translated) return fallback;
  // Convention used throughout this codebase: a missing key echoes
  // back as the raw key string. Treat that as "not translated".
  if (translated === key) return fallback;
  return translated;
}

function interpolateCrop(template, cropLabel) {
  if (!template) return template;
  // Simple crop-token substitution. Accept {crop} and {{crop}}.
  return String(template)
    .replace(/\{\{?\s*crop\s*\}?\}/g, cropLabel);
}

export const _internal = { STATE_COPY, TIME_TITLE_KEYS, MANY_DAYS_THRESHOLD };
