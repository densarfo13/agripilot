/**
 * UI State System — centralized safe/caution/block mapping for farmer home.
 *
 * Resolves a single dominant visual state from weather + action context.
 * Components use getStateStyles() to apply consistent colors.
 *
 * States:
 *   safe    — good conditions, proceed normally
 *   caution — proceed with care (rain later, wind advisory)
 *   block   — do not proceed, action is unsafe or overridden
 *
 * Color hierarchy rule:
 *   Only ONE dominant color state should be felt on screen at a time.
 *   Red appears ONLY in block state.
 */

// ─── Color tokens ────────────────────────────────────────────
const COLORS = {
  green:      '#22C55E',
  greenDark:  '#16A34A',
  greenMuted: 'rgba(34,197,94,0.15)',
  greenFaint: 'rgba(34,197,94,0.08)',
  greenText:  '#86EFAC',

  amber:      '#F59E0B',
  amberMuted: 'rgba(250,204,21,0.12)',
  amberFaint: 'rgba(250,204,21,0.06)',
  amberText:  '#FCD34D',

  red:        '#EF4444',
  redMuted:   'rgba(239,68,68,0.12)',
  redFaint:   'rgba(239,68,68,0.08)',
  redText:    '#FCA5A5',

  neutral:    'rgba(255,255,255,0.08)',
  neutralBorder: 'rgba(255,255,255,0.10)',
};

/**
 * Derive the dominant UI state from action + weather.
 *
 * @param {Object|null} action - primaryAction from decision engine
 * @param {Object|null} weatherGuidance - from getWeatherGuidance()
 * @returns {'safe'|'caution'|'block'}
 */
export function getTaskState(action, weatherGuidance) {
  // Block: weather override replaced the action, or weather is warning/danger
  if (action?.weatherOverride) return 'block';
  if (weatherGuidance?.status === 'danger') return 'block';
  if (weatherGuidance?.status === 'warning' && weatherGuidance?.riskLevel === 'high') return 'block';

  // Caution: weather says caution, or mild warning (not high risk)
  if (weatherGuidance?.status === 'caution') return 'caution';
  if (weatherGuidance?.status === 'warning') return 'caution';

  return 'safe';
}

/**
 * Get consistent style tokens for a given UI state.
 *
 * @param {'safe'|'caution'|'block'} state
 * @returns {Object} Style tokens for card, weather bar, CTA
 */
export function getStateStyles(state) {
  switch (state) {
    case 'block':
      return {
        // Task card
        cardBorder: `1px solid ${COLORS.redMuted}`,
        cardBg: '#1B2330',
        // Weather bar
        weatherBg: COLORS.redFaint,
        weatherBorder: COLORS.redMuted,
        weatherText: COLORS.redText,
        // CTA
        ctaBg: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
        ctaShadow: '0 4px 12px rgba(0,0,0,0.2)',
        ctaDisabled: true,
        // Task list item accent
        taskAccentBorder: `3px solid ${COLORS.red}`,
      };

    case 'caution':
      return {
        // Task card — subtle amber, NOT red
        cardBorder: `1px solid ${COLORS.amberMuted}`,
        cardBg: '#1B2330',
        // Weather bar — amber but lighter than task card
        weatherBg: COLORS.amberFaint,
        weatherBorder: `rgba(250,204,21,0.15)`,
        weatherText: COLORS.amberText,
        // CTA — still green (action is allowed)
        ctaBg: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
        ctaShadow: '0 4px 16px rgba(22,163,74,0.3)',
        ctaDisabled: false,
        // Task list item accent — amber not red
        taskAccentBorder: `3px solid ${COLORS.amber}`,
      };

    case 'safe':
    default:
      return {
        // Task card — subtle green or neutral
        cardBorder: `1px solid ${COLORS.greenFaint}`,
        cardBg: '#1B2330',
        // Weather bar — green/neutral
        weatherBg: COLORS.greenFaint,
        weatherBorder: `rgba(34,197,94,0.12)`,
        weatherText: COLORS.greenText,
        // CTA — green, dominant element
        ctaBg: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
        ctaShadow: '0 4px 16px rgba(22,163,74,0.3)',
        ctaDisabled: false,
        // Task list item accent
        taskAccentBorder: `3px solid ${COLORS.green}`,
      };
  }
}

/**
 * Map a weather guidance status to a UI state for task list items.
 * Used by FarmTasksCard where we don't have the full action context.
 *
 * @param {string} taskPriority - 'high'|'medium'|'low'
 * @param {Object|null} weatherGuidance
 * @returns {'safe'|'caution'|'block'}
 */
export function getTaskItemState(taskPriority, weatherGuidance) {
  // Only use block for high priority + danger weather
  if (taskPriority === 'high' && weatherGuidance?.status === 'danger') return 'block';
  if (taskPriority === 'high' && weatherGuidance?.status === 'warning' && weatherGuidance?.riskLevel === 'high') return 'block';

  // High priority with caution weather = caution, not red
  if (taskPriority === 'high' && (weatherGuidance?.status === 'caution' || weatherGuidance?.status === 'warning')) return 'caution';

  // High priority with safe weather = safe (urgent but not dangerous)
  if (taskPriority === 'high') return 'safe';

  return 'safe';
}

export { COLORS as UI_COLORS };
