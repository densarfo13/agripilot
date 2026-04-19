/**
 * i18n/format — locale-aware number, date, relative-time, and plural
 * formatters for Farroway.
 *
 * These wrappers prefer the browser's Intl APIs for the selected
 * language (hi-IN, en-US, fr-FR, etc.) and fall back to plain numbers/
 * ISO strings when Intl or the locale isn't available so we never
 * break the UI on older devices.
 *
 * Plural rules use Intl.PluralRules when present, falling back to a
 * tiny one/other splitter so we still get grammatical strings on
 * locales like Hindi where 0 and 1 behave differently from English.
 */

const LANG_TO_LOCALE = {
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',
  ha: 'ha-NG',
  tw: 'ak-GH',
  hi: 'hi-IN',
};

function resolveLocale(lang) {
  return LANG_TO_LOCALE[lang] || LANG_TO_LOCALE.en;
}

/**
 * Format a number in the requested language.
 *   formatNumber(1234, 'hi') → '१,२३४' (native digits)
 */
export function formatNumber(value, lang, opts = {}) {
  if (!Number.isFinite(value)) return String(value ?? '');
  try {
    return new Intl.NumberFormat(resolveLocale(lang), opts).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Keep digits Latin even for Hindi when the number sits inside a
 * noun phrase where native digits would look odd (e.g. "5 एकड़").
 * Farmers tend to recognize Latin digits for measurements, so by
 * default we keep the numeric grouping but leave digits as-is.
 */
export function formatCount(value, lang) {
  if (!Number.isFinite(value)) return String(value ?? '');
  try {
    return new Intl.NumberFormat(resolveLocale(lang), {
      useGrouping: true,
      numberingSystem: 'latn',
    }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a date for display.
 *   formatDate(Date.now(), 'hi', { dateStyle: 'medium' }) → '१८ अप्रैल २०२६'
 */
export function formatDate(value, lang, opts = { dateStyle: 'medium' }) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(resolveLocale(lang), opts).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format a relative time span ("2 min ago") using Intl.RelativeTimeFormat.
 * Returns null if the API is unavailable so the caller can fall back
 * to its own translation key.
 */
export function formatRelativeTime(value, lang, now = Date.now()) {
  const t = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(t)) return null;
  if (typeof Intl === 'undefined' || !Intl.RelativeTimeFormat) return null;
  try {
    const rtf = new Intl.RelativeTimeFormat(resolveLocale(lang), { numeric: 'auto' });
    const deltaSec = Math.round((t - now) / 1000);
    const abs = Math.abs(deltaSec);
    if (abs < 60) return rtf.format(deltaSec, 'second');
    if (abs < 3600) return rtf.format(Math.round(deltaSec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(deltaSec / 3600), 'hour');
    return rtf.format(Math.round(deltaSec / 86400), 'day');
  } catch {
    return null;
  }
}

/**
 * Pick 'one' or 'other' category using Intl.PluralRules, with a
 * simple count===1 fallback when the API is unavailable.
 *   pluralCategory(1, 'hi') → 'one'
 *   pluralCategory(2, 'en') → 'other'
 */
export function pluralCategory(count, lang) {
  if (typeof Intl !== 'undefined' && Intl.PluralRules) {
    try {
      return new Intl.PluralRules(resolveLocale(lang)).select(count);
    } catch { /* fallthrough */ }
  }
  return count === 1 ? 'one' : 'other';
}

/**
 * Resolve a count-aware key: given a base key like 'count.tasksLeft',
 * returns 'count.tasksLeft_one' or 'count.tasksLeft_other' based on
 * the plural category for `count` in `lang`. Call sites pair this
 * with a regular `t()` so the translator can author two variants.
 */
export function pluralKey(baseKey, count, lang) {
  const cat = pluralCategory(count, lang);
  return `${baseKey}_${cat}`;
}
