/**
 * CTAButton — the ONE canonical button for Farroway. Token-driven, accessible,
 * with a gentle press state. Every screen's primary/secondary action should use
 * this instead of a hand-rolled <button> + inline styles.
 *
 *   import { CTAButton } from 'src/design/components';
 *   <CTAButton onClick={...}>Start inspection</CTAButton>
 *   <CTAButton variant="secondary" onClick={...}>Retake</CTAButton>
 *
 * Accessibility (Design System §ACCESSIBILITY):
 *   • 48px minimum height + tap target (outdoor / low-dexterity safe).
 *   • Real <button> element (keyboard + VoiceOver native).
 *   • `primary` prop sets data-primary-action so the design-system gate
 *     recognises the page's one primary action.
 */
import React from 'react';
import { COLORS } from '../tokens/colors.js';
import { RADIUS } from '../tokens/radius.js';
import { TYPE } from '../tokens/typography.js';
import { MOTION } from '../tokens/motion.js';

const MIN_TARGET = 48; // px — accessibility floor

// The ONE button system — exactly five variants (Design Bible §BUTTON SYSTEM). Nothing else.
// Fully token-driven (no hardcoded hex). primary uses DARK ink on the gold surface
// for AA contrast (light-gold-on-gold was a contrast defect); danger routes to the
// canonical `error` token (there is no `COLORS.danger` — the old fallback always fired).
const VARIANTS = {
  primary:   { bg: COLORS.ochre,     color: COLORS.structureDark, border: 'transparent' },
  secondary: { bg: COLORS.greenSoft, color: COLORS.greenInk,      border: COLORS.greenBorder },
  ghost:     { bg: 'transparent',    color: COLORS.ink,           border: COLORS.border },
  text:      { bg: 'transparent',    color: COLORS.ochreInk,      border: 'transparent' },
  danger:    { bg: COLORS.error,     color: COLORS.textPrimary,   border: 'transparent' },
};

export default function CTAButton({
  children,
  onClick,
  variant = 'primary',
  fullWidth = true,
  disabled = false,
  type = 'button',
  testId,
  ariaLabel,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const base = {
    minHeight:     MIN_TARGET,
    width:         fullWidth ? '100%' : 'auto',
    display:       'inline-flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           8,
    padding:       '0 18px',
    borderRadius:  RADIUS.pill || 999,
    background:    v.bg,
    color:         v.color,
    border:        `1px solid ${v.border}`,
    fontSize:      (TYPE.button && TYPE.button.fontSize) || '0.95rem',
    fontWeight:    700,
    lineHeight:    1.2,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    opacity:       disabled ? 0.55 : 1,
    transition:    (MOTION.tap && MOTION.tap.transition) || 'transform 120ms ease, opacity 120ms ease',
    WebkitTapHighlightColor: 'transparent',
    touchAction:   'manipulation',
  };
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      data-primary-action={variant === 'primary' ? 'true' : undefined}
      className="ff-tap"
      style={{ ...base, ...(style || null) }}
      {...rest}
    >
      {children}
    </button>
  );
}
