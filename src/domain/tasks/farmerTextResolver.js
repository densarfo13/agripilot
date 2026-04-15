/**
 * Farmer Text Resolver — single path for all farmer-facing task text.
 *
 * Both simple and standard mode call this. No component-level t() fallback.
 *
 * Resolution order:
 *   1. Client-side translation map (taskTranslations.js) — preferred
 *   2. i18n key via t() — for decision engine actions
 *   3. Dev diagnostic placeholder — if translation key missing (dev only)
 *
 * The returned object is the ONLY source of display text for a task.
 */
import { getLocalizedTaskTitle, getLocalizedTaskDescription } from '../../utils/taskTranslations.js';

/**
 * Resolve all farmer-facing text for a task.
 *
 * @param {Object} params
 * @param {Object|null} params.task - Raw server task (may be null for non-task actions)
 * @param {Object|null} params.action - Decision engine action (has title/reason/cta from t())
 * @param {string} params.lang - Current language code
 * @param {Function} params.t - i18n translation function
 * @returns {Object} Resolved text fields
 */
export function resolveFarmerText({ task, action, lang, t }) {
  // For decision-engine actions (setup, stage, etc.) — already localized via t()
  if (action && !task) {
    return {
      title: action.title || '',
      descriptionShort: action.reason || '',
      ctaLabel: action.cta || t('guided.taskCta'),
      voiceText: action.reason || action.title || '',
      supportingLine: null,
      isFromTranslationMap: false,
    };
  }

  // For server tasks — use the translation map as primary source
  if (task) {
    // Weather override actions carry their own title (already localized or a t() key)
    const title = (action?.weatherOverride && action.title)
      ? action.title
      : getLocalizedTaskTitle(task.id, task.title, lang);
    const desc = getLocalizedTaskDescription(task.id, task.description || task.reason || '', lang);

    // If we have a decision-engine action that wraps this task, prefer its localized CTA/reason
    const ctaLabel = action?.cta || t('guided.taskCta');
    const reason = action?.reason || desc;

    // Supporting line: only show server notes in English (they're untranslated)
    const supportingLine = lang === 'en' ? (task.reason || null) : null;

    return {
      title,
      descriptionShort: reason,
      ctaLabel,
      voiceText: reason || title,
      supportingLine,
      isFromTranslationMap: true,
    };
  }

  // Fallback: no task, no action
  return {
    title: '',
    descriptionShort: '',
    ctaLabel: '',
    voiceText: '',
    supportingLine: null,
    isFromTranslationMap: false,
  };
}
