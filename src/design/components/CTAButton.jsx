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
const VARIANTS = {
  primary:   { bg: COLORS.ochre || '#C8944D', color: COLORS.ochreInk || '#1F2A14', border: 'transparent' },
  secondary: { bg: COLORS.greenSoft || 'rgba(143,171,115,0.16)', color: COLORS.greenInk || '#A8C283', border: COLORS.greenBorder || 'rgba(143,171,115,0.4)' },
  ghost:     { bg: 'transparent', color: COLORS.ink || '#EAF2FF', border: COLORS.border || 'rgba(255,255,255,0.18)' },
  text:      { bg: 'transparent', color: COLORS.ochreInk || '#E6BC85', border: 'transparent' },
  danger:    { bg: COLORS.danger || '#B3402F', color: '#FFF7F4', border: 'transparent' },
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
