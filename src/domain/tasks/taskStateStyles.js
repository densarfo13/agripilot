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

// Soft Ochre / Beige unified system (Intelligence Expansion §1).
// normal  → olive earth #6E8B61 (success)
// caution → warm mustard #D6A13D (warning)
// urgent  → calm terracotta #C65A4B (block)
// CTA gradient on normal/caution = ochre primary; urgent = muted
// gray since the action is blocked.
const SEVERITY_STYLES = {
  normal: {
    accentColor: '#6E8B61',
    accentBorder: '3px solid #6E8B61',
    cardBorder: '1px solid rgba(110,139,97,0.18)',
    cardBorderAlert: '2px solid rgba(110,139,97,0.32)',
    accentBg: 'rgba(110,139,97,0.10)',
    labelColor: '#3F6A3F',
    priorityColor: '#667085',
    ctaBg: 'linear-gradient(180deg, #C8944D 0%, #B9853F 100%)',
    ctaShadow: '0 10px 24px rgba(200,148,77,0.32)',
    ctaDisabled: false,
  },
  caution: {
    accentColor: '#D6A13D',
    accentBorder: '3px solid #D6A13D',
    cardBorder: '1px solid rgba(214,161,61,0.20)',
    cardBorderAlert: '2px solid rgba(214,161,61,0.40)',
    accentBg: 'rgba(214,161,61,0.08)',
    labelColor: '#8A5C12',
    priorityColor: '#D6A13D',
    ctaBg: 'linear-gradient(180deg, #C8944D 0%, #B9853F 100%)',
    ctaShadow: '0 10px 24px rgba(200,148,77,0.32)',
    ctaDisabled: false,
  },
  urgent: {
    accentColor: '#C65A4B',
    accentBorder: '3px solid #C65A4B',
    cardBorder: '1px solid rgba(198,90,75,0.22)',
    cardBorderAlert: '2px solid rgba(198,90,75,0.40)',
    accentBg: 'rgba(198,90,75,0.08)',
    labelColor: '#8A2E22',
    priorityColor: '#C65A4B',
    // Urgent = blocked CTA — muted gray, not green/red.
    ctaBg: 'linear-gradient(180deg, #98A2B3 0%, #667085 100%)',
    ctaShadow: '0 4px 12px rgba(15,23,42,0.06)',
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
