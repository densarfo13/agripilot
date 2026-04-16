/**
 * Urgency Resolver — centralized urgency assignment.
 *
 * Urgency levels (spec §3):
 *   critical   — protect uncovered harvest before rain
 *   today      — water crop during hot dry spell
 *   this_week  — log harvest data
 *   optional   — review costs
 *
 * Generated centrally, never hardcoded in UI.
 * Combines: task priority, weather context, crop stage, timing proximity.
 */

export const URGENCY = {
  CRITICAL: 'critical',
  TODAY: 'today',
  THIS_WEEK: 'this_week',
  OPTIONAL: 'optional',
};

/**
 * UI style mapping for each urgency level.
 * Components consume this — never compute urgency colors independently.
 */
export const URGENCY_STYLES = {
  critical: {
    bg: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    text: '#FCA5A5',
    accent: '#EF4444',
    labelKey: 'urgency.critical',
    dot: '#EF4444',
  },
  today: {
    bg: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.25)',
    text: '#86EFAC',
    accent: '#22C55E',
    labelKey: 'urgency.today',
    dot: '#22C55E',
  },
  this_week: {
    bg: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.2)',
    text: '#FCD34D',
    accent: '#F59E0B',
    labelKey: 'urgency.thisWeek',
    dot: '#F59E0B',
  },
  optional: {
    bg: 'rgba(148,163,184,0.08)',
    border: '1px solid rgba(148,163,184,0.15)',
    text: '#94A3B8',
    accent: '#64748B',
    labelKey: 'urgency.optional',
    dot: '#64748B',
  },
};

/**
 * Resolve urgency for a task given full context.
 *
 * @param {Object} params
 * @param {string} params.actionKey - Decision engine action key
 * @param {string} params.priority - Task priority (critical/high/medium/low/info)
 * @param {string} params.severity - Computed severity (urgent/caution/normal)
 * @param {Object|null} params.weatherGuidance - Weather context
 * @param {string|null} params.autopilotSeverity - From autopilot rule (urgent/caution/normal)
 * @param {string|null} params.cropStage - Current crop stage
 * @param {boolean} params.isWeatherOverride - Weather replaced the task
 * @returns {string} One of URGENCY values
 */
export function resolveUrgency({
  actionKey,
  priority,
  severity,
  weatherGuidance,
  autopilotSeverity,
  cropStage,
  isWeatherOverride,
}) {
  // Weather override = always critical (danger-driven replacement)
  if (isWeatherOverride) return URGENCY.CRITICAL;

  // Autopilot urgent = critical
  if (autopilotSeverity === 'urgent') return URGENCY.CRITICAL;

  // Severe pest = critical
  if (actionKey === 'severe_pest') return URGENCY.CRITICAL;

  // High priority + danger weather = critical
  const wxStatus = weatherGuidance?.status || 'safe';
  if ((priority === 'critical' || priority === 'high') && wxStatus === 'danger') {
    return URGENCY.CRITICAL;
  }

  // High priority or caution severity = today
  if (priority === 'critical' || priority === 'high') return URGENCY.TODAY;
  if (severity === 'caution') return URGENCY.TODAY;
  if (autopilotSeverity === 'caution') return URGENCY.TODAY;

  // Active crop stages with normal tasks = today
  if (['vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest'].includes(cropStage) &&
      priority === 'medium') {
    return URGENCY.TODAY;
  }

  // Medium priority = this_week
  if (priority === 'medium') return URGENCY.THIS_WEEK;

  // Setup/checkin/stale actions = this_week
  if (['stage_outdated', 'needs_checkin', 'stale_activity'].includes(actionKey)) {
    return URGENCY.THIS_WEEK;
  }

  // Everything else = optional
  if (priority === 'low' || priority === 'info') return URGENCY.OPTIONAL;
  if (actionKey === 'all_done') return URGENCY.OPTIONAL;

  return URGENCY.THIS_WEEK;
}

/**
 * Get urgency style tokens.
 * @param {string} urgency - URGENCY value
 * @returns {Object} Style tokens
 */
export function getUrgencyStyle(urgency) {
  return URGENCY_STYLES[urgency] || URGENCY_STYLES.this_week;
}
