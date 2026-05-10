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

// ─── Color tokens (Soft Ochre / Beige unified system) ───────
// Forwarded from `src/design/tokens/colors.js`. The legacy
// `green/amber/red` keys keep their semantic meaning (success,
// caution, block) but resolve to the locked olive-earth, warm
// mustard, and terracotta values respectively. No neon greens.
const COLORS = {
  green:      '#6E8B61',  // olive earth — success
  greenDark:  '#3F6A3F',
  greenMuted: 'rgba(110,139,97,0.18)',
  greenFaint: 'rgba(110,139,97,0.10)',
  greenText:  '#3F6A3F',

  amber:      '#D6A13D',  // warm mustard — warning
  amberMuted: 'rgba(214,161,61,0.14)',
  amberFaint: 'rgba(214,161,61,0.08)',
  amberText:  '#8A5C12',

  red:        '#C65A4B',  // calm terracotta — block
  redMuted:   'rgba(198,90,75,0.12)',
  redFaint:   'rgba(198,90,75,0.08)',
  redText:    '#8A2E22',

  ochre:      '#C8944D',  // primary action
  ochreDark:  '#B9853F',

  neutral:        'rgba(36,49,58,0.06)',
  neutralBorder:  'rgba(36,49,58,0.10)',
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
        cardBg: '#FFFFFF',
        // Weather bar
        weatherBg: COLORS.redFaint,
        weatherBorder: COLORS.redMuted,
        weatherText: COLORS.redText,
        // CTA
        ctaBg: 'linear-gradient(180deg, #98A2B3 0%, #667085 100%)',
        ctaShadow: '0 4px 12px rgba(15,23,42,0.06)',
        ctaDisabled: true,
        // Task list item accent
        taskAccentBorder: `3px solid ${COLORS.red}`,
      };

    case 'caution':
      return {
        // Task card — subtle amber, NOT red
        cardBorder: `1px solid ${COLORS.amberMuted}`,
        cardBg: '#FFFFFF',
        // Weather bar — amber but lighter than task card
        weatherBg: COLORS.amberFaint,
        weatherBorder: `rgba(250,204,21,0.15)`,
        weatherText: COLORS.amberText,
        // CTA — still green (action is allowed)
        ctaBg: 'linear-gradient(180deg, #C8944D 0%, #B9853F 100%)',
        ctaShadow: '0 10px 24px rgba(200,148,77,0.32)',
        ctaDisabled: false,
        // Task list item accent — amber not red
        taskAccentBorder: `3px solid ${COLORS.amber}`,
      };

    case 'safe':
    default:
      return {
        // Task card — subtle green or neutral
        cardBorder: `1px solid ${COLORS.greenFaint}`,
        cardBg: '#FFFFFF',
        // Weather bar — green/neutral
        weatherBg: COLORS.greenFaint,
        weatherBorder: `rgba(200,148,77,0.12)`,
        weatherText: COLORS.greenText,
        // CTA — green, dominant element
        ctaBg: 'linear-gradient(180deg, #C8944D 0%, #B9853F 100%)',
        ctaShadow: '0 10px 24px rgba(200,148,77,0.32)',
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
