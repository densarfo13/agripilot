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

// Soft Ochre / Beige unified system. Normal = olive earth (success
// tone), caution = warm mustard, urgent = calm terracotta. No
// neon greens, no #EF4444 reds — every value is from the locked
// design token table.
const SEVERITY_STYLES = {
  normal: {
    accentColor: '#6E8B61',
    accentBorder: '3px solid #6E8B61',
    accentBg: 'rgba(110,139,97,0.10)',
    labelColor: '#3F6A3F',
    priorityColor: '#667085',
  },
  caution: {
    accentColor: '#D6A13D',
    accentBorder: '3px solid #D6A13D',
    accentBg: 'rgba(214,161,61,0.08)',
    labelColor: '#8A5C12',
    priorityColor: '#D6A13D',
  },
  urgent: {
    accentColor: '#C65A4B',
    accentBorder: '3px solid #C65A4B',
    accentBg: 'rgba(198,90,75,0.08)',
    labelColor: '#8A2E22',
    priorityColor: '#C65A4B',
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
