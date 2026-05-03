/**
 * ActionCard — single-action card primitive: green-tinted
 * surface with optional eyebrow, title, body, and a slot for
 * the caller's action affordance (typically a <Button>).
 *
 *   <ActionCard
 *     eyebrow="TODAY'S TIP"
 *     title="Check moisture today"
 *     body="Soil has been wet — root rot risk rises."
 *   >
 *     <Button onClick={onDone}>Done ✓</Button>
 *   </ActionCard>
 *
 * Spec coverage (Component System §1 + §2 + §3)
 *   • single purpose (one action card with title + optional
 *     body + slot)
 *   • reusable across surfaces (FirstActionGate uses inline
 *     styles today; future migrations + new screens use this
 *     primitive)
 *   • mode-aware via the design tokens (green-tinted surface
 *     reads as "primary action" in BOTH backyard and farmer
 *     UIs without per-mode styling)
 *
 * Strict-rule audit
 *   • Pure presentational — never throws, no analytics.
 *   • Renders eyebrow only when supplied (no empty pill).
 *   • Body is optional; renders only when supplied.
 *   • children is the action slot — caller controls the CTA.
 */

import { COLORS, SPACING, TYPOGRAPHY } from '../../ui/styleGuide.js';

export default function ActionCard({
  eyebrow,
  title,
  body,
  testId,
  children,
}) {
  return (
    <section style={STYLES.card} data-testid={testId}>
      {eyebrow ? (
        <span style={STYLES.eyebrow}>{eyebrow}</span>
      ) : null}
      {title ? (
        <h2 style={STYLES.title}>{title}</h2>
      ) : null}
      {body ? (
        <p style={STYLES.body}>{body}</p>
      ) : null}
      {children ? (
        <div style={STYLES.slot}>{children}</div>
      ) : null}
    </section>
  );
}

const STYLES = {
  card: {
    background: COLORS.goodBg,
    border: `1.5px solid ${COLORS.goodBd}`,
    borderRadius: 18,
    padding: `${SPACING.xxl - 2}px ${SPACING.xl}px ${SPACING.xxl}px`,
    boxShadow: '0 10px 32px rgba(0,0,0,0.28)',
    color: COLORS.ink,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.sm,
  },
  eyebrow: {
    fontSize:       TYPOGRAPHY.eyebrow.size,
    fontWeight:     TYPOGRAPHY.eyebrow.weight,
    letterSpacing:  TYPOGRAPHY.eyebrow.letterSpacing,
    textTransform:  'uppercase',
    color:          COLORS.goodFg,
  },
  title: {
    margin: 0,
    fontSize:       TYPOGRAPHY.headline.size,
    fontWeight:     TYPOGRAPHY.headline.weight,
    lineHeight:     TYPOGRAPHY.headline.lineHeight,
    letterSpacing:  TYPOGRAPHY.headline.letterSpacing,
    color: '#FFFFFF',
  },
  body: {
    margin: 0,
    fontSize:   TYPOGRAPHY.body.size,
    fontWeight: TYPOGRAPHY.body.weight,
    lineHeight: TYPOGRAPHY.body.lineHeight,
    color:      COLORS.inkSoft,
  },
  slot: {
    marginTop: SPACING.xs,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.sm,
  },
};
