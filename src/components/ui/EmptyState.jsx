/**
 * EmptyState — single-purpose empty / zero-data primitive.
 *
 *   <EmptyState
 *     icon="\uD83C\uDF31"
 *     title="No farms yet"
 *     body="Add your first farm to start tracking."
 *   >
 *     <Button variant="primary" onClick={onAdd}>Add a farm</Button>
 *   </EmptyState>
 *
 * Spec coverage (Component System §1 + §2)
 *   • single purpose (empty-state display, not a CTA itself —
 *     caller passes the action via children)
 *   • reusable across surfaces — every "no rows" / "no
 *     activity" / "no programs" surface
 *   • mode-aware via the icon prop (caller passes 🌱 for
 *     backyard, 🌾 for farmer, 📷 for scan-empty, etc.)
 *
 * Strict-rule audit
 *   • Pure presentational — never throws.
 *   • Title required; body + icon + children optional.
 *   • Centered layout (matches existing AdminEmptyState +
 *     AddFarmEmpty patterns).
 */

import { COLORS, SPACING, TYPOGRAPHY } from '../../ui/styleGuide.js';

export default function EmptyState({
  icon,
  title,
  body,
  testId,
  children,
}) {
  if (!title) return null;
  return (
    <section style={STYLES.section} data-testid={testId}>
      {icon ? (
        <span style={STYLES.icon} aria-hidden="true">{icon}</span>
      ) : null}
      <h3 style={STYLES.title}>{title}</h3>
      {body ? (
        <p style={STYLES.body}>{body}</p>
      ) : null}
      {children ? (
        <div style={STYLES.actionSlot}>{children}</div>
      ) : null}
    </section>
  );
}

const STYLES = {
  section: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px dashed rgba(255,255,255,0.14)',
    borderRadius: 14,
    padding: `${SPACING.xxl}px ${SPACING.xl}px`,
    color: COLORS.ink,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 32,
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize:   TYPOGRAPHY.title.size,
    fontWeight: TYPOGRAPHY.title.weight,
    lineHeight: TYPOGRAPHY.title.lineHeight,
    color: '#FFFFFF',
  },
  body: {
    margin: 0,
    fontSize:   TYPOGRAPHY.body.size,
    color:      COLORS.inkSoft,
    lineHeight: TYPOGRAPHY.body.lineHeight,
    maxWidth: '24rem',
  },
  actionSlot: {
    marginTop: SPACING.sm,
    width: '100%',
    maxWidth: '20rem',
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.sm,
  },
};
