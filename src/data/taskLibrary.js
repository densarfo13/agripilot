/**
 * taskLibrary.js — type-keyed translation lookup for task cards.
 *
 * Maps a task `type` (e.g. `scout_pests`, `weed_rows`) to the i18n
 * keys that resolve its title / description / why text. Card
 * components look up their entry via:
 *
 *     import { TASK_LIBRARY, taskKeysFor } from '../data/taskLibrary.js';
 *     const def = taskKeysFor(task.type);
 *     <h3>{tSafe(def.title, '')}</h3>
 *     <p>{tSafe(def.desc, '')}</p>
 *     <p>{tSafe('labels.why', '')}: {tSafe(def.why, '')}</p>
 *
 * If the task `type` is unknown the helper returns the generic
 * fallback bundle (`tasks.generic.*`) so cards never crash and
 * never blank out. Translations for every key live in
 * `src/i18n/translations.js` under the `tasks.*` namespace,
 * populated for en / fr / sw / ha / tw / hi.
 *
 * Coexistence note
 * ────────────────
 * The existing `src/lib/dailyTasks/taskTemplates.js` engine
 * generates per-stage tasks with English title / description / why
 * fields. That engine is the source of truth for which task fires
 * when; this library is the UI translation seam. Both can run
 * together: the engine still emits a task object, and the card
 * component routes its display text through this library when the
 * `type` matches.
 */

export const TASK_LIBRARY = Object.freeze({
  scout_pests: Object.freeze({
    title: 'tasks.scout.title',
    desc:  'tasks.scout.desc',
    why:   'tasks.scout.why',
  }),
  weed_rows: Object.freeze({
    title: 'tasks.weed.title',
    desc:  'tasks.weed.desc',
    why:   'tasks.weed.why',
  }),
  check_moisture: Object.freeze({
    title: 'tasks.moisture.title',
    desc:  'tasks.moisture.desc',
    why:   'tasks.moisture.why',
  }),
  sow_today: Object.freeze({
    title: 'tasks.sow.title',
    desc:  'tasks.sow.desc',
    why:   'tasks.sow.why',
  }),
});

const GENERIC = Object.freeze({
  title: 'tasks.generic.title',
  desc:  'tasks.generic.desc',
  why:   'tasks.generic.why',
});

/**
 * Look up the i18n-key bundle for a task type. Always returns an
 * object — falls back to `tasks.generic.*` for unknown types so
 * cards can render `tSafe(def.title, '')` without first checking
 * for null.
 *
 * @param {string|null|undefined} type
 * @returns {{title:string, desc:string, why:string}}
 */
export function taskKeysFor(type) {
  if (type && Object.prototype.hasOwnProperty.call(TASK_LIBRARY, type)) {
    return TASK_LIBRARY[type];
  }
  return GENERIC;
}

export default TASK_LIBRARY;
