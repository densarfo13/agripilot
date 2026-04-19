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
 * Localize a task row that came back from the server by looking
 * up an i18n-key override if one is attached, otherwise passing
 * the raw strings through. Callers should prefer task rows with
 * `titleKey` / `detailKey` properties so the Today page can render
 * the same card in any language.
 */
export function localizeServerTask(task, t) {
  if (!task) return null;
  const title = task.titleKey ? t(task.titleKey, task.titleVars) : task.title || '';
  const detail = task.detailKey ? t(task.detailKey, task.detailVars) : task.detail || null;
  return { ...task, title, detail };
}

export const _internal = { cropLabel, timingLabel };
