/**
 * Button — single-purpose primary/secondary/ghost button
 * primitive bound to the Farroway design tokens.
 *
 *   <Button variant="primary" onClick={...}>Done</Button>
 *   <Button variant="secondary" disabled>...</Button>
 *   <Button variant="ghost" size="sm">Manage →</Button>
 *
 * Variants
 * ────────
 *   primary    — solid green CTA (matches existing FirstActionGate
 *                Done button + Paywall trial CTA)
 *   secondary  — green-tinted ghost border (matches existing
 *                "Add Garden" / "Add Farm" buttons)
 *   ghost      — quiet text-only link with optional underline
 *                (matches existing "Manage →" link on MyFarmPage)
 *   danger     — red urgent CTA (rare; reserved for destructive
 *                actions like "Delete farm")
 *
 * Sizes
 * ─────
 *   md (default) — minHeight 48px (Apple-min tap target × 1.1)
 *   sm           — minHeight 32px (secondary actions, inline)
 *
 * Spec coverage (Component System §1 + §2)
 *   • single purpose (button + variant + size)
 *   • reusable (no business logic; pure presentational)
 *   • no mixed functionality (no analytics fired by default —
 *     caller wires onClick)
 *
 * Strict-rule audit
 *   • Renders nothing if children is empty.
 *   • Never throws — onClick is wrapped in try/catch.
 *   • All visible text comes from caller via children.
 */

import { COLORS, SPACING, TYPOGRAPHY } from '../../ui/styleGuide.js';

export default function Button({
  variant   = 'primary',
  size      = 'md',
  type      = 'button',
  disabled  = false,
  onClick,
  testId,
  ariaLabel,
  children,
  style,        // caller can extend (rarely needed)
}) {
  if (children == null || children === '') return null;

  const handleClick = (e) => {
    if (disabled) return;
    if (typeof onClick !== 'function') return;
    try { onClick(e); }
    catch { /* never propagate from a click handler */ }
  };

  const merged = {
    ...BASE_STYLE,
    ...(SIZE_STYLES[size] || SIZE_STYLES.md),
    ...(VARIANT_STYLES[variant] || VARIANT_STYLES.primary),
    ...(disabled ? DISABLED_STYLE : null),
    ...(style || null),
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      style={merged}
      data-testid={testId}
      data-variant={variant}
      aria-label={ariaLabel || undefined}
    >
      {children}
    </button>
  );
}

const BASE_STYLE = {
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
  fontSize:   TYPOGRAPHY.cta.size,
  fontWeight: TYPOGRAPHY.cta.weight,
  cursor: 'pointer',
  borderRadius: 12,
  WebkitTapHighlightColor: 'transparent',
  transition: 'transform 140ms ease, background 140ms ease',
};

const SIZE_STYLES = Object.freeze({
  md: {
    padding: `${SPACING.md}px ${SPACING.xl}px`,
    minHeight: 48,
  },
  sm: {
    padding: `${SPACING.xs + 2}px ${SPACING.md}px`,
    minHeight: 32,
    fontSize: 13,
    fontWeight: 700,
  },
});

const VARIANT_STYLES = Object.freeze({
  primary: {
    background: COLORS.good,
    color: COLORS.navy,
    border: 'none',
    boxShadow: '0 6px 18px rgba(34,197,94,0.28)',
    width: '100%',
  },
  secondary: {
    background: 'transparent',
    color: COLORS.goodFg,
    border: `1px solid ${COLORS.goodBd}`,
    width: '100%',
  },
  ghost: {
    background: 'transparent',
    color: COLORS.inkDim,
    border: 'none',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(234,242,255,0.32)',
    textUnderlineOffset: 3,
    fontSize: 13,
    fontWeight: 600,
    minHeight: 32,
  },
  danger: {
    background: COLORS.urgent,
    color: '#FFFFFF',
    border: 'none',
    width: '100%',
  },
});

const DISABLED_STYLE = {
  opacity: 0.55,
  cursor: 'default',
  boxShadow: 'none',
};
