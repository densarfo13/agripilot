/**
 * getLocalizedTaskText.js — resolve a task's display title /
 * detail in the active language.
 *
 * Composes the existing resolution chain that the dashboards
 * already use:
 *
 *   1. titleKey  → t(key, vars)                             (preferred)
 *   2. title     → getLocalizedTaskTitle(id, title, lang)   (phrase map)
 *   3. title     → raw literal (last resort)
 *
 * If the resolved value is empty / matches the raw input, we
 * fire logMissingTranslation so coverage gaps surface in the
 * admin dashboard.
 */

import { getLocalizedTaskTitle } from '../../utils/taskTranslations.js';
import { logMissingTranslation } from './logMissingTranslation.js';

/**
 * @param  {object} task        server task or template row
 *   { id, titleKey, title, detail, vars }
 * @param  {function} t         translator from useTranslation()
 * @param  {string} lang        active UI language
 * @returns {{ title: string, detail: string }}
 */
export function getLocalizedTaskText(task, t, lang = 'en') {
  const out = { title: '', detail: '' };
  if (!task || typeof task !== 'object') return out;

  // ── Title ──
  if (task.titleKey && typeof t === 'function') {
    const v = t(task.titleKey, task.vars);
    if (v && v !== task.titleKey) {
      out.title = v;
    } else if (lang !== 'en') {
      logMissingTranslation({
        key: task.titleKey,
        lang,
        surface: 'getLocalizedTaskText:title',
      });
    }
  }
  if (!out.title && task.title) {
    const phraseMapped = getLocalizedTaskTitle(task.id, task.title, lang);
    out.title = phraseMapped || task.title;
    if (lang !== 'en' && (!phraseMapped || phraseMapped === task.title)) {
      logMissingTranslation({
        key: `task.title.${task.id || '_unknown'}`,
        lang,
        surface: 'getLocalizedTaskText:title',
      });
    }
  }

  // ── Detail / body ──
  if (task.detailKey && typeof t === 'function') {
    const v = t(task.detailKey, task.vars);
    if (v && v !== task.detailKey) out.detail = v;
  }
  if (!out.detail && task.detail) out.detail = String(task.detail);

  return out;
}
