/**
 * StatusCard — small status / state display primitive.
 *
 *   <StatusCard tone="good"    title="On track" body="2 of 3 done today" />
 *   <StatusCard tone="caution" title="Heads up" body="Rain expected soon" />
 *   <StatusCard tone="urgent"  title="Action needed" body="High pest risk" />
 *
 * Tone semantics map directly to the §8 color tokens:
 *   good    → green (reinforcement; no action needed)
 *   caution → amber (heads up; action recommended this week)
 *   urgent  → red   (act now; condition is time-sensitive)
 *   neutral → grey  (informational; no urgency)
 *
 * Spec coverage (Component System §1 + §2)
 *   • single purpose (status display, not a CTA)
 *   • reusable across surfaces — Home progress, NGO dashboard
 *     status pills, scan result confidence chips
 *   • no mixed functionality (no onClick by default; for
 *     interactive status, wrap in a <button>)
 *
 * Strict-rule audit
 *   • Pure presentational — never throws.
 *   • title required; body optional.
 *   • icon is decorative — caller passes a string emoji or
 *     omits to render text-only.
 */

import { COLORS, SPACING, TYPOGRAPHY } from '../../ui/styleGuide.js';

const TONE_STYLES = Object.freeze({
  good: {
    bg:    COLORS.goodBg,
    border: COLORS.goodBd,
    fg:     COLORS.goodFg,
  },
  caution: {
    bg:    COLORS.cautionBg,
    border: COLORS.cautionBd,
    fg:     COLORS.cautionFg,
  },
  urgent: {
    bg:    COLORS.urgentBg,
    border: COLORS.urgentBd,
    fg:     COLORS.urgentFg,
  },
  neutral: {
    bg:    'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
    fg:     COLORS.inkSoft,
  },
});

export default function StatusCard({
  tone  = 'neutral',
  icon,
  title,
  body,
  testId,
}) {
  if (!title && !body) return null;
  const palette = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <section
      style={{
        ...BASE_STYLE,
        background: palette.bg,
        border:     `1px solid ${palette.border}`,
      }}
      data-testid={testId}
      data-tone={tone}
    >
      {icon ? (
        <span style={STYLES.icon} aria-hidden="true">{icon}</span>
      ) : null}
      <div style={STYLES.text}>
        {title ? (
          <span style={{ ...STYLES.title, color: palette.fg }}>{title}</span>
        ) : null}
        {body ? (
          <span style={STYLES.body}>{body}</span>
        ) : null}
      </div>
    </section>
  );
}

const BASE_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.md,
  padding: `${SPACING.md - 2}px ${SPACING.lg - 2}px`,
  borderRadius: 12,
  color: COLORS.ink,
};

const STYLES = {
  icon: {
    fontSize: 20,
    flexShrink: 0,
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize:   TYPOGRAPHY.eyebrow.size + 1,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  body: {
    fontSize:   TYPOGRAPHY.caption.size,
    color:      COLORS.inkSoft,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
  },
};
