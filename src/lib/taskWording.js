/**
 * taskWording.js — translation-aware helpers that turn a raw task
 * row (server-generated or client-normalized) into the strings we
 * actually render on the Action-First home screen.
 *
 * The rule: farmer-visible copy must go through `t()` so the
 * selected language (en/fr/sw/ha/tw/hi) flows end-to-end. Raw
 * task.title coming from the server is always English. This module
 * looks for an i18n key first, falls back to the server title
 * only if no translation was shipped.
 *
 * Exports:
 *   localizeTaskTitle(task, t)     — string
 *   localizeTaskDetail(task, t)    — string | null
 *   estimateTaskMinutes(task)      — number (coarse heuristic, 5..45 min)
 *   localizeTaskEta(task, t)       — localized "{n} min"
 *   localizeRiskAlert(riskSignal, t) — short farmer-facing risk line
 */

/** Short keys for crop-template titles that have fixed wording. */
const TITLE_KEY_MAP = {
  'Prep the bed or container': 'actionHome.task.prepBed',
  'Plant seeds or seedlings':  'actionHome.task.plantSeeds',
  'Check moisture daily':      'actionHome.task.checkMoisture',
  'Thin seedlings if crowded': 'actionHome.task.thinSeedlings',
  'First pest scouting pass':  'actionHome.task.pestScout',
  'Feed and mulch':            'actionHome.task.feedMulch',
  'Weekly weed pass':          'actionHome.task.weekWeeds',
  'Harvest prep':              'actionHome.task.harvestPrep',
};

export function localizeTaskTitle(task, t) {
  if (!task) return '';
  if (task.titleKey) return t(task.titleKey);
  const mapped = TITLE_KEY_MAP[task.title];
  if (mapped) {
    const localized = t(mapped);
    // If the i18n layer humanized/fell back to the raw key, prefer
    // the original title so we never show a half-translated label.
    if (localized && !/^[A-Z][a-z]+ [a-z]+ [a-z]+$/.test(localized) || localized !== task.title) {
      return localized;
    }
  }
  return task.title || '';
}

export function localizeTaskDetail(task, t) {
  if (!task) return null;
  if (task.detailKey) return t(task.detailKey);
  return task.detail || null;
}

/**
 * Coarse estimate of how long the next task takes, based on priority
 * + title keywords. Only used for "estimated time ~15 min" copy; no
 * farming-critical decision depends on it.
 */
export function estimateTaskMinutes(task) {
  if (!task) return 15;
  const title = String(task.title || '').toLowerCase();
  if (/scout|check|moisture/.test(title)) return 10;
  if (/plant|sow|transplant/.test(title)) return 30;
  if (/mulch|feed|side-dress/.test(title)) return 25;
  if (/weed/.test(title)) return 35;
  if (/stake|cage|train/.test(title)) return 20;
  if (/harvest/.test(title)) return 45;
  if (/thin/.test(title)) return 10;
  if (task.priority === 'high') return 30;
  if (task.priority === 'low')  return 10;
  return 15;
}

export function localizeTaskEta(task, t) {
  const n = estimateTaskMinutes(task);
  return t('actionHome.primary.minutes', { n });
}

/**
 * Convert a raw risk signal into a short farmer-facing label.
 * Accepts either the string codes from cycleRiskEngine reasons[] or
 * interventionEngine signals.
 */
export function localizeRiskAlert(signal, t) {
  if (!signal) return '';
  const s = String(signal).toLowerCase();
  if (s.includes('overdue') || s === 'overdue_tasks_3_plus') return t('actionHome.risks.overdue');
  if (s.includes('inactive') || s === 'inactive_14d_plus')   return t('actionHome.risks.inactive');
  if (s.includes('high-severity') || s === 'open_high_severity_issue') return t('actionHome.risks.highSeverityIssue');
  if (s.includes('window')) return t('actionHome.risks.missedWindow');
  // Already a full sentence — pass through.
  return signal;
}
