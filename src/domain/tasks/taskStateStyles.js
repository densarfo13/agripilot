/**
 * Task State Styles — maps severity to visual tokens.
 *
 * Single mapping: severity → style object. No color logic in UI components.
 *
 * Rules:
 *   normal  → green accent
 *   caution → amber accent (never red)
 *   urgent  → red accent (only here)
 */

const SEVERITY_STYLES = {
  normal: {
    accentColor: '#22C55E',
    accentBorder: '3px solid #22C55E',
    cardBorder: '1px solid rgba(34,197,94,0.15)',
    cardBorderAlert: '2px solid rgba(34,197,94,0.3)',
    accentBg: 'rgba(34,197,94,0.08)',
    labelColor: '#86EFAC',
    priorityColor: '#6B7280',
    ctaBg: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    ctaShadow: '0 4px 16px rgba(22,163,74,0.25)',
    ctaDisabled: false,
  },
  caution: {
    accentColor: '#F59E0B',
    accentBorder: '3px solid #F59E0B',
    cardBorder: '1px solid rgba(250,204,21,0.2)',
    cardBorderAlert: '2px solid rgba(250,204,21,0.35)',
    accentBg: 'rgba(250,204,21,0.06)',
    labelColor: '#FCD34D',
    priorityColor: '#F59E0B',
    ctaBg: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    ctaShadow: '0 4px 16px rgba(22,163,74,0.25)',
    ctaDisabled: false,
  },
  urgent: {
    accentColor: '#EF4444',
    accentBorder: '3px solid #EF4444',
    cardBorder: '1px solid rgba(239,68,68,0.2)',
    cardBorderAlert: '2px solid rgba(239,68,68,0.4)',
    accentBg: 'rgba(239,68,68,0.06)',
    labelColor: '#FCA5A5',
    priorityColor: '#EF4444',
    // Urgent = blocked CTA
    ctaBg: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
    ctaShadow: '0 2px 8px rgba(0,0,0,0.15)',
    ctaDisabled: true,
  },
};

/**
 * Get style tokens for a severity level.
 * @param {'normal'|'caution'|'urgent'} severity
 * @returns {Object} Style tokens
 */
export function getTaskStateStyle(severity) {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.normal;
}
