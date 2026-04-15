/**
 * Task Severity System — single source of truth for task visual weight.
 *
 * Maps task priority + weather context → severity → style tokens.
 * Components call getTaskSeverity() then getTaskStyle() — no color logic in UI.
 *
 * Severity levels:
 *   normal  — green accent, standard weight
 *   caution — amber accent, elevated attention
 *   urgent  — red accent, only for true danger (block weather + high priority)
 */

// ─── Severity derivation ────────────────────────────────────

/**
 * Derive task severity from priority + weather context.
 *
 * @param {'high'|'medium'|'low'} priority - Task priority from server
 * @param {Object|null} weatherGuidance - From getWeatherGuidance()
 * @returns {'normal'|'caution'|'urgent'}
 */
export function getTaskSeverity(priority, weatherGuidance) {
  const wxStatus = weatherGuidance?.status || 'safe';
  const wxRisk = weatherGuidance?.riskLevel || 'none';

  // Urgent: high priority + danger weather, or high + warning with high risk
  if (priority === 'high' && wxStatus === 'danger') return 'urgent';
  if (priority === 'high' && wxStatus === 'warning' && wxRisk === 'high') return 'urgent';

  // Caution: high priority (any weather), or medium priority with bad weather
  if (priority === 'high') return 'caution';
  if (priority === 'medium' && (wxStatus === 'warning' || wxStatus === 'danger')) return 'caution';

  return 'normal';
}

// ─── Style tokens per severity ──────────────────────────────

const SEVERITY_STYLES = {
  normal: {
    accentColor: '#22C55E',
    accentBorder: '3px solid #22C55E',
    accentBg: 'rgba(34,197,94,0.08)',
    labelColor: '#86EFAC',
    priorityColor: '#6B7280',
  },
  caution: {
    accentColor: '#F59E0B',
    accentBorder: '3px solid #F59E0B',
    accentBg: 'rgba(250,204,21,0.06)',
    labelColor: '#FCD34D',
    priorityColor: '#F59E0B',
  },
  urgent: {
    accentColor: '#EF4444',
    accentBorder: '3px solid #EF4444',
    accentBg: 'rgba(239,68,68,0.06)',
    labelColor: '#FCA5A5',
    priorityColor: '#EF4444',
  },
};

/**
 * Get style tokens for a given severity level.
 *
 * @param {'normal'|'caution'|'urgent'} severity
 * @returns {Object} Style tokens for task list items
 */
export function getTaskStyle(severity) {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.normal;
}
