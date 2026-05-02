/**
 * retentionMessages.js — adaptive Home banner copy (Retention
 * Loop spec §5).
 *
 *   import { pickAdaptiveMessage } from '../core/retentionMessages.js';
 *
 *   const msg = pickAdaptiveMessage({
 *     daysSinceLastCompletion: 0,    // null when never completed
 *     weather: { humidity: 80, rainChance: 70 },
 *   });
 *   // → string|null  (null = no banner today, render nothing)
 *
 * Design rules
 * ────────────
 *   • Pure function. No I/O, no side effects.
 *   • Returns ONE message at most — the spec is calm-by-default.
 *     The Home card already shows a priority + reason + tasks +
 *     tomorrow preview; an adaptive message is the OPTIONAL
 *     cherry on top, not a stack of banners.
 *   • Order of preference:
 *       1. consistency praise   (yesterday completed)
 *       2. comeback nudge       (missed 2+ days)
 *       3. weather risk         (humidity OR rain)
 *       4. null                 (no banner today)
 *
 *     The user's behaviour signal (1, 2) wins over the weather
 *     signal so a returning user sees the welcome-back nudge
 *     first; a first-time user with no completion history
 *     falls through to weather.
 *
 *   • Returned strings are short, calm, no exclamation marks
 *     beyond the spec wording. They humanise gracefully if
 *     translations fall back to English.
 *
 * Why this lives outside the engine
 * ─────────────────────────────────
 * The dailyPlanEngine's contract is locked at the spec shape
 * (priority/reason/tasks/riskAlerts/tomorrow). Retention
 * messaging is a SEPARATE concern (engagement, not guidance),
 * so it gets its own module. The Home card composes both.
 */

// Each entry pairs a stable translation key with the English
// fallback. The fallback is what `tStrict` returns when the
// active locale is missing the key (or when the strict
// translator is bypassed in node-mode tests). Returning the
// pair instead of a raw string lets the engine stay pure (no
// React / i18n import) while the card render path resolves
// the user-visible copy via tStrict so non-EN locales see
// translated wording.
const MESSAGE = Object.freeze({
  consistency: {
    key:      'daily.adaptive.consistency',
    fallback: 'Great consistency. Keep going today.',
  },
  comeback: {
    key:      'daily.adaptive.comeback',
    fallback: 'Let\u2019s get back on track. Start with one quick check.',
  },
  highHumidity: {
    key:      'daily.adaptive.highHumidity',
    fallback: 'Humidity is high today \u2014 watch for leaf spots.',
  },
  rainExpected: {
    key:      'daily.adaptive.rainExpected',
    fallback: 'Rain is expected \u2014 avoid overwatering.',
  },
});

// Same thresholds the dailyPlanEngine uses so Home doesn't
// flash one wording for the engine's risk and a different one
// for the banner.
const HUMIDITY_THRESHOLD   = 70; // %
const RAIN_CHANCE_THRESHOLD = 60; // %

function _wNum(weather, ...keys) {
  if (!weather || typeof weather !== 'object') return null;
  for (const k of keys) {
    const v = weather[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * pickAdaptiveMessage(input) → string | null
 *
 * @param {object} input
 * @param {number|null} input.daysSinceLastCompletion
 *        — full days since the user last completed a task.
 *          0    = completed today
 *          1    = completed yesterday (consistency branch)
 *          ≥ 2  = missed 2+ days (comeback branch)
 *          null = never completed (skip behaviour branch)
 * @param {object} [input.weather] — optional weather snapshot.
 * @returns {{ key:string, fallback:string }|null}
 *          A translation key + English fallback. The card
 *          resolves the user-visible copy via tStrict; when
 *          there's no banner today, returns null.
 */
export function pickAdaptiveMessage(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const days = (typeof i.daysSinceLastCompletion === 'number' && Number.isFinite(i.daysSinceLastCompletion))
    ? Math.max(0, i.daysSinceLastCompletion)
    : null;

  // Behavioural signal first.
  // Spec §5 — "If user completed tasks yesterday: Great
  // consistency..." We treat days === 1 as the canonical
  // "yesterday" case. days === 0 (already completed today)
  // is also celebrated with the same consistency line — the
  // user is on a roll, no need to suppress the nudge.
  if (days === 0 || days === 1) return MESSAGE.consistency;
  if (days != null && days >= 2)  return MESSAGE.comeback;

  // Weather signal second. Rain wins over humidity when both
  // apply because "skip watering" is the more actionable nudge
  // (humidity is informational; rain changes today's task).
  const w = i.weather || null;
  const rainChance = _wNum(w, 'rainChance', 'rain', 'precipChance', 'rainProbability');
  if (rainChance != null && rainChance >= RAIN_CHANCE_THRESHOLD) {
    return MESSAGE.rainExpected;
  }
  const humidity = _wNum(w, 'humidity', 'relativeHumidity');
  if (humidity != null && humidity > HUMIDITY_THRESHOLD) {
    return MESSAGE.highHumidity;
  }

  // No behavioural signal AND no weather signal → don't show
  // a banner. The card is calmer this way; the daily plan
  // alone is a complete experience.
  return null;
}

/**
 * pickCompletionFeedback(type) → { key, fallback }
 *
 * Spec §4 — the toast that fires after a task is marked done.
 * Garden vs farm wording so the user feels the message was
 * written for what THEY are growing. Returns a translation
 * key + English fallback; the card resolves via tStrict.
 */
export function pickCompletionFeedback(type) {
  if (type === 'farm') {
    return {
      key:      'daily.completionFeedback.farm',
      fallback: 'Nice work \uD83D\uDE9C You\u2019re staying ahead of crop problems.',
    };
  }
  // Default to garden wording for any other / unknown type so
  // a missing type never produces an awkward farm-only line on
  // a backyard surface.
  return {
    key:      'daily.completionFeedback.garden',
    fallback: 'Nice work \uD83C\uDF31 You\u2019re keeping your plant healthy.',
  };
}

/**
 * pickAllDoneTomorrowPreview(planTomorrow) → { text, key, fallback }
 *
 * Spec §7 — when every task is complete today, the Home card
 * surfaces a calm "see you tomorrow" preview.
 *
 *   • When the dailyPlanEngine produced a tomorrowPreview, we
 *     surface it verbatim through `text` (it's already weather-
 *     aware AND already routed through tStrict at the engine
 *     boundary, so re-keying it would lose the personalised
 *     wording like "Watering may not be needed tomorrow.")
 *   • When the engine emitted nothing, we hand back the spec's
 *     default copy as a `key` + `fallback` pair so the card
 *     can resolve it via tStrict and non-EN locales translate.
 */
export function pickAllDoneTomorrowPreview(planTomorrow) {
  if (typeof planTomorrow === 'string' && planTomorrow.trim()) {
    return { text: planTomorrow.trim(), key: null, fallback: planTomorrow.trim() };
  }
  return {
    text:     null,
    key:      'daily.allDone.defaultPreview',
    fallback: 'Tomorrow: check again for early signs of stress.',
  };
}

export default {
  pickAdaptiveMessage,
  pickCompletionFeedback,
  pickAllDoneTomorrowPreview,
};
