/**
 * Task Timing Engine — smart timing intelligence.
 *
 * Computes a farmer-friendly timing phrase for a task, such as:
 *   - "Do today"
 *   - "Do this week"
 *   - "Before rain Thursday"
 *   - "While conditions stay dry"
 *   - "By Fri, 19 Apr"
 *
 * Pure function: no React, no API calls.
 * Uses forecast.dailyRain[] (from rainfallEngine) to detect rain windows
 * and produce weather-aware timing when the forecast gives us a concrete day.
 *
 * Inputs:
 *   - autopilotEnrichment — { timingKey, urgency, weatherReason }
 *   - rainfall            — { dailyRain[] } with dayIndex 0 = today, 1 = tomorrow…
 *   - language            — current locale (en, fr, sw, ha, tw)
 *   - t                   — i18n translation function
 *   - now                 — Date reference (defaults to new Date())
 *
 * Output: { text, kind, dayIndex }
 *   - text      — localized phrase to render
 *   - kind      — 'today' | 'this_week' | 'rain_deadline' | 'dry_window' | 'generic'
 *   - dayIndex  — 0..6 (only set for rain_deadline / dry_window)
 */

// ─── Date / day helpers ─────────────────────────────────────

/**
 * Map of language code → Intl locale tag.
 * Falls back to 'en' for Twi/Hausa/Swahili where Intl has partial coverage —
 * we use i18n day/month keys for those languages instead.
 */
const INTL_LOCALE = {
  en: 'en-GB',
  fr: 'fr-FR',
  sw: 'sw-KE',
  ha: 'ha',
  tw: 'en-GB', // fallback; formatted day/month always read from t() keys
};

/**
 * Short day-of-week i18n keys (Mon..Sun, 1..7 to match Intl).
 * Keys live in translations.js under date.day.*
 */
const DAY_KEYS = ['date.day.sun', 'date.day.mon', 'date.day.tue', 'date.day.wed', 'date.day.thu', 'date.day.fri', 'date.day.sat'];

/**
 * Short month keys under date.month.*
 */
const MONTH_KEYS = [
  'date.month.jan', 'date.month.feb', 'date.month.mar', 'date.month.apr',
  'date.month.may', 'date.month.jun', 'date.month.jul', 'date.month.aug',
  'date.month.sep', 'date.month.oct', 'date.month.nov', 'date.month.dec',
];

/**
 * Return a localized short day name from a Date.
 * Always goes through i18n so all 5 languages have consistent coverage.
 */
function shortDayName(date, t) {
  const idx = date.getDay(); // 0 = Sunday
  return t(DAY_KEYS[idx]);
}

/**
 * Return a localized short date like "19 Apr".
 */
function shortDate(date, t) {
  const day = date.getDate();
  const month = t(MONTH_KEYS[date.getMonth()]);
  return `${day} ${month}`;
}

/**
 * Day difference between two dates (calendar days, ignoring time-of-day).
 */
function daysBetween(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Add n days to a date.
 */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ─── Rain window detection ──────────────────────────────────

/**
 * Find the index of the first wet day in the forecast,
 * starting from tomorrow (dayIndex 1) onwards.
 * Returns -1 if no wet day is found in the window.
 */
function findNextRainDay(dailyRain = []) {
  for (let i = 1; i < dailyRain.length; i++) {
    if (dailyRain[i]?.isWet) return i;
  }
  return -1;
}

/**
 * Find the last dry day before the next rain day.
 * Returns -1 if rain starts today or there's no rain coming.
 */
function findLastDryDay(dailyRain = []) {
  const nextRain = findNextRainDay(dailyRain);
  if (nextRain <= 0) return -1;
  // Last dry day = nextRain - 1
  return nextRain - 1;
}

// ─── Core entry point ──────────────────────────────────────

/**
 * Produce a timing phrase for a task.
 *
 * Strategy:
 *   1. If a weather-triggered rule references rain and we have forecast data,
 *      show the exact day ("Before rain Thu" / "By Fri, 19 Apr").
 *   2. If urgency is 'critical' or 'today', show a today/urgent phrase.
 *   3. Otherwise, fall back to the rule's static timingKey (already localized).
 *
 * @param {Object} params
 * @param {Object|null} params.enrichment - Autopilot enrichment (timingKey, urgency, weatherReason)
 * @param {Object|null} params.rainfall - Rainfall guidance with dailyRain[]
 * @param {Function} params.t - i18n translation function
 * @param {string} params.language - current locale code
 * @param {Date} [params.now] - reference time (defaults to new Date())
 * @returns {{ text: string|null, kind: string, dayIndex: number|null }}
 */
export function getTaskTimingContext({ enrichment, rainfall, t, language, now } = {}) {
  if (!enrichment) return { text: null, kind: 'generic', dayIndex: null };

  const nowDate = now instanceof Date ? now : new Date();
  const dailyRain = rainfall?.dailyRain || [];
  const timingKey = enrichment.timingKey || null;
  const urgency = enrichment.urgency || null;
  const weatherReason = enrichment.weatherReason || null;

  // ─── 1. Rain-aware timing (highest value) ─────────────────
  if (dailyRain.length > 0) {
    const nextRainIdx = findNextRainDay(dailyRain);

    // (a) Rule says "before rain" → show the actual day if rain is coming
    //     within the visible 7-day window and it's not today.
    if (weatherReason === 'rain_expected' && nextRainIdx > 0 && nextRainIdx <= 6) {
      const rainDate = addDays(nowDate, nextRainIdx);
      const dayName = shortDayName(rainDate, t);

      // Tomorrow gets a named phrase; later days get "Before rain <Day>"
      if (nextRainIdx === 1) {
        return {
          text: t('timing.beforeRainTomorrow'),
          kind: 'rain_deadline',
          dayIndex: nextRainIdx,
        };
      }

      // "Before rain Thu" / "Before rain Fri, 19 Apr" when ≥4 days out
      const dateLabel = nextRainIdx >= 4
        ? `${dayName}, ${shortDate(rainDate, t)}`
        : dayName;

      return {
        text: t('timing.beforeRainOnDay', { day: dateLabel }),
        kind: 'rain_deadline',
        dayIndex: nextRainIdx,
      };
    }

    // (b) Rule says "wait for dry weather" → show when the next dry window starts
    if (weatherReason === 'rain_now' || timingKey === 'timing.waitForDryWeather') {
      // Find first dry day from tomorrow onward
      for (let i = 1; i < dailyRain.length; i++) {
        if (!dailyRain[i]?.isWet) {
          const dryDate = addDays(nowDate, i);
          const dayName = shortDayName(dryDate, t);
          if (i === 1) {
            return {
              text: t('timing.dryStartsTomorrow'),
              kind: 'dry_window',
              dayIndex: i,
            };
          }
          return {
            text: t('timing.dryStartsOnDay', { day: dayName }),
            kind: 'dry_window',
            dayIndex: i,
          };
        }
      }
    }

    // (c) "While conditions dry" + rain coming soon → add deadline
    if (timingKey === 'timing.whileConditionsDry' && nextRainIdx > 0 && nextRainIdx <= 5) {
      const rainDate = addDays(nowDate, nextRainIdx);
      const dayName = shortDayName(rainDate, t);
      return {
        text: t('timing.doBeforeRainOnDay', { day: dayName }),
        kind: 'rain_deadline',
        dayIndex: nextRainIdx,
      };
    }
  }

  // ─── 2. Urgency-driven phrasing ──────────────────────────
  if (urgency === 'critical') {
    return {
      text: t(timingKey || 'timing.doNow'),
      kind: 'today',
      dayIndex: 0,
    };
  }

  if (urgency === 'today') {
    // Prefer the rule's timingKey because it carries weather context
    // (e.g. "Heat is high today" vs plain "Do today").
    return {
      text: t(timingKey || 'timing.doToday'),
      kind: 'today',
      dayIndex: 0,
    };
  }

  if (urgency === 'this_week') {
    return {
      text: t(timingKey || 'timing.doThisWeek'),
      kind: 'this_week',
      dayIndex: null,
    };
  }

  // ─── 3. Fallback — use the rule's localized timing phrase as-is
  if (timingKey) {
    return { text: t(timingKey), kind: 'generic', dayIndex: null };
  }

  return { text: null, kind: 'generic', dayIndex: null };
}

/**
 * Public helpers for other UI surfaces (CropSummary etc.) that want
 * consistent localized day/date formatting without touching Intl directly.
 */
export function formatShortDay(date, t) {
  return shortDayName(date instanceof Date ? date : new Date(date), t);
}

export function formatShortDate(date, t) {
  return shortDate(date instanceof Date ? date : new Date(date), t);
}

export function formatRelativeDay(date, t, now = new Date()) {
  const target = date instanceof Date ? date : new Date(date);
  const diff = daysBetween(now, target);
  if (diff === 0) return t('date.today');
  if (diff === 1) return t('date.tomorrow');
  if (diff === -1) return t('date.yesterday');
  if (diff >= 2 && diff <= 6) return shortDayName(target, t);
  return shortDate(target, t);
}

// Intl locale export — available for components that want native formatting
// but shouldn't be depended on for ha/tw/sw where we prefer i18n keys.
export { INTL_LOCALE };
