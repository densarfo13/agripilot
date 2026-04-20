/**
 * taskOverride.js — §6. When farm risk is high/critical, swap
 * the normal task list for an emergency one. Pure — the UI
 * decides which list to render based on the boolean returned
 * by `shouldOverrideTasks`.
 *
 * Emits LocalizedPayload objects (no English strings at the
 * engine layer). Caller renders via renderLocalizedMessage.
 */

// Minimal factory to keep this module tree-shakeable and
// independent of src/core/i18n — same shape as makeLocalizedPayload.
function payload(key, params = {}, extra = {}) {
  return Object.freeze({ key, params: params || {}, ...extra });
}

export const EMERGENCY_TASK_CODES = Object.freeze([
  'inspect_farm_immediately',
  'check_water_levels',
  'follow_emergency_recommendations',
]);

const EMERGENCY_TEMPLATES = Object.freeze([
  {
    code: 'inspect_farm_immediately',
    titleKey:     'task.emergency.inspect_farm_immediately',
    titleFallback:'Inspect your farm immediately',
    whyKey:       'why.emergency.inspect_farm',
    whyFallback:  'High risk detected — on-field check takes priority',
    priority: 100, isPrimary: true,  actionType: 'inspect', blocking: true,
  },
  {
    code: 'check_water_levels',
    titleKey:     'task.emergency.check_water_levels',
    titleFallback:'Check water levels',
    whyKey:       'why.emergency.check_water',
    whyFallback:  'Water stress is the most common root cause',
    priority: 90, isPrimary: false, actionType: 'inspect', blocking: false,
  },
  {
    code: 'follow_emergency_recommendations',
    titleKey:     'task.emergency.follow_emergency_recs',
    titleFallback:'Follow emergency recommendations',
    whyKey:       'why.emergency.follow_recs',
    whyFallback:  'Structured steps from your advisor for this risk',
    priority: 80, isPrimary: false, actionType: 'prep',    blocking: false,
  },
]);

/** shouldOverrideTasks — true when risk is high or critical. */
export function shouldOverrideTasks(risk) {
  if (!risk) return false;
  const level = typeof risk === 'string' ? risk : risk.level;
  return level === 'high' || level === 'critical';
}

/**
 * buildEmergencyTaskList — returns a full structured task list
 * in the same shape the task engine produces so the UI can
 * render either stream interchangeably.
 *
 *   { primary, supporting, all }
 */
export function buildEmergencyTaskList({ farmId = null } = {}) {
  const all = EMERGENCY_TEMPLATES.map((t) => Object.freeze({
    id:           `${farmId || 'f'}:${t.code}`,
    code:         t.code,
    priority:     t.priority,
    score:        t.priority,
    stage:        'land_prep',
    actionType:   t.actionType,
    isPrimary:    !!t.isPrimary,
    blocking:     !!t.blocking,
    completed:    false,
    confidenceLevel: 'high',
    titleKey:     t.titleKey,
    titleParams:  {},
    titleFallback:t.titleFallback,
    whyKey:       t.whyKey,
    whyParams:    {},
    whyFallback:  t.whyFallback,
    emergency:    true,
  }));
  const primary = all.find((x) => x.isPrimary) || all[0] || null;
  const supporting = all.filter((x) => !x.isPrimary);
  return Object.freeze({ primary, supporting, all });
}

/**
 * maybeOverrideTasks — caller-friendly facade. Accepts the
 * current task result + risk. Returns the override list when
 * the rule fires; otherwise returns the input unchanged.
 */
export function maybeOverrideTasks(currentResult, risk, opts = {}) {
  if (!shouldOverrideTasks(risk)) return currentResult;
  return buildEmergencyTaskList(opts);
}

/** Structured LocalizedPayload banner paired with the override. */
export function emergencyHeaderBanner() {
  return payload(
    'farmer.banner.task_override.emergency',
    {},
    {
      severity: 'critical',
      fallback: 'Emergency: showing priority tasks only',
      variant:  'task_override',
    },
  );
}
