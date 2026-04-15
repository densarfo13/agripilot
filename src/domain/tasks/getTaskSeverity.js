/**
 * Task Severity — single source of truth for task visual weight.
 *
 * Derives severity from task priority + weather context.
 * UI components NEVER compute severity independently.
 *
 * Severity levels:
 *   normal  — green accent, standard weight
 *   caution — amber accent, elevated attention
 *   urgent  — red accent, only for true danger
 */

/**
 * @param {Object} params
 * @param {'critical'|'high'|'medium'|'low'|'info'} params.priority
 * @param {Object|null} params.weatherGuidance - From getWeatherGuidance()
 * @param {boolean} [params.isWeatherOverride] - Whether this task was weather-overridden
 * @returns {'normal'|'caution'|'urgent'}
 */
export function getTaskSeverity({ priority, weatherGuidance, isWeatherOverride }) {
  const wxStatus = weatherGuidance?.status || 'safe';
  const wxRisk = weatherGuidance?.riskLevel || 'none';

  // Weather override = always urgent (action was replaced due to danger)
  if (isWeatherOverride) return 'urgent';

  // Urgent: high/critical + danger weather, or high + warning with high risk
  if ((priority === 'high' || priority === 'critical') && wxStatus === 'danger') return 'urgent';
  if ((priority === 'high' || priority === 'critical') && wxStatus === 'warning' && wxRisk === 'high') return 'urgent';

  // Caution: high priority (any weather), or medium with bad weather
  if (priority === 'high' || priority === 'critical') return 'caution';
  if (priority === 'medium' && (wxStatus === 'warning' || wxStatus === 'danger')) return 'caution';

  return 'normal';
}
