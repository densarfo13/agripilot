/**
 * generateLocalizedTask — client-side task title/detail generator.
 *
 * Produces a `{ title, detail, eta }` payload using translation keys,
 * so tasks regenerate automatically when the language changes.
 * Mirrors the server's taskWordingHelpers in shape, but keeps all
 * copy behind t() keys so the Today page never shows mixed languages.
 *
 *   generateLocalizedTask({ type: 'watering', crop: 'tomato', timing: 'today' }, t)
 *     → { title: 'Water tomatoes today', detail: 'Keep the top inch...', eta: '15 min' }
 *
 * Supported `type`:
 *   'watering' | 'planting' | 'pest_inspection' | 'fertilizer' |
 *   'harvest'  | 'weed_control' | 'custom'
 *
 * For any raw server-sent task row, call `localizeServerTask(task, t)`
 * to look up a crop-aware localized title or fall back to the raw
 * title — never a half-translated mix.
 */

/**
 * Crop labels keyed off the i18n dictionary so the crop name stays
 * in the user's language ("tomatoes" vs "टमाटर" vs "ntɔs"). When a
 * crop key is missing we humanize the raw string.
 */
function cropLabel(cropKey, t) {
  if (!cropKey) return t('generatedTask.crop.generic');
  const key = `generatedTask.crop.${cropKey}`;
  const v = t(key);
  // When the t() resolver humanizes the key we detect it and fall
  // back to the raw crop key lower-cased.
  if (v && !/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(v)) return v;
  return String(cropKey).replace(/_/g, ' ');
}

/** Timing labels — same i18n namespace as crop labels. */
function timingLabel(timing, t) {
  if (!timing) return t('generatedTask.timing.today');
  const key = `generatedTask.timing.${timing}`;
  const v = t(key);
  return v || timing;
}

/**
 * Build a localized task for a known type.
 *
 * @param {Object} input
 * @param {string} input.type
 * @param {string} input.crop       crop key, e.g. 'tomato', 'peanut'
 * @param {string} [input.timing]   'today' | 'this_week' | 'this_month'
 * @param {Object} [input.extra]    additional interpolation vars
 * @param {Function} t              bound translator from useAppSettings
 */
export function generateLocalizedTask({ type, crop, timing = 'today', extra = {} }, t) {
  const vars = { crop: cropLabel(crop, t), timing: timingLabel(timing, t), ...extra };
  const titleKey = `generatedTask.${type}.title`;
  const detailKey = `generatedTask.${type}.detail`;
  const etaKey = `generatedTask.${type}.eta`;
  return {
    title: t(titleKey, vars),
    detail: t(detailKey, vars),
    eta: t(etaKey, vars),
  };
}

/**
 * Localize a task row that came back from the server.
 *
 * Resolution order (per the no-English-leak rule — Apr 2026):
 *   1. `task.titleKey` → t(key, vars)                              (preferred)
 *   2. `getLocalizedTaskTitle(task.id, task.title, lang)`          (phrase map)
 *   3. raw `task.title` literal                                     (last resort)
 *
 * Same chain applies to `detailKey` → `getLocalizedTaskDescription`
 * → raw detail.  The phrase-map fallback (step 2) is what catches
 * server-emitted English-only titles like "Clear your field" that
 * lack a titleKey — without this hop those strings leaked through
 * the Today/Tasks UI in non-English languages.
 *
 * The `lang` parameter is optional; when absent the phrase-map
 * lookup short-circuits and we fall straight to the raw value
 * (so callers that don't have an active language still get safe
 * behaviour).
 */
import {
  getLocalizedTaskTitle,
  getLocalizedTaskDescription,
} from './taskTranslations.js';

// Calm-UI Upgrade §3 — short, action-first title overrides. The
// legacy server task engine (server/lib/farmTaskEngine.js) still
// emits long verbose titles like:
//   "Start logging farm costs to track profitability"
//   "Log farm expenses to track profitability"
//   "Refresh crop stage"
// The Calm-UI spec demands short, time-based, action-first
// wording. Rather than rewriting the server engine (much larger
// change), we shorten at the render layer here. Each entry maps
// a verbose canonical English title to its short Calm-UI form;
// localizeServerTask consults this map BEFORE locale resolution
// so the override applies in every language.
const SHORT_TITLE_OVERRIDES = Object.freeze({
  'Start logging farm costs to track profitability': 'Log first cost (30 sec)',
  'Log farm expenses to track profitability':         'Log first cost (30 sec)',
  'Keep logging harvest and costs to unlock performance comparison':
                                                      'Log today\u2019s harvest (1 min)',
  'Refresh crop stage':                               'Update crop stage',
});

export function localizeServerTask(task, t, lang = null) {
  if (!task) return null;

  let title;
  if (task.titleKey) {
    title = t ? t(task.titleKey, task.titleVars) : (task.title || '');
  } else if (lang && lang !== 'en' && task.title) {
    title = getLocalizedTaskTitle(task.id, task.title, lang) || task.title;
  } else {
    title = task.title || '';
  }
  // Apply Calm-UI short-title override AFTER locale resolution so
  // both English and non-English paths get the short form when
  // the original key was a known verbose source string.
  // Using the ORIGINAL `task.title` (untranslated) as the lookup
  // key means a non-English session still gets the override, then
  // re-localises to the short form via the same `t` resolver if a
  // matching key exists; otherwise the English short form is used
  // (acceptable per the spec's "short, action-first" rule).
  if (task.title && SHORT_TITLE_OVERRIDES[task.title]) {
    title = SHORT_TITLE_OVERRIDES[task.title];
  }

  let detail;
  if (task.detailKey) {
    detail = t ? t(task.detailKey, task.detailVars) : (task.detail || null);
  } else if (lang && lang !== 'en' && task.detail) {
    detail = getLocalizedTaskDescription(task.id, task.detail, lang) || task.detail;
  } else {
    detail = task.detail || null;
  }

  return { ...task, title, detail };
}

export const _internal = { cropLabel, timingLabel };
