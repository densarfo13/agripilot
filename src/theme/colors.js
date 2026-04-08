/**
 * Farroway Design Tokens
 *
 * Canonical color + spacing values for the Farroway UI.
 * CSS custom properties in index.css mirror these values.
 * Import this file when you need tokens in JS (inline styles, charts, etc.).
 */

export const colors = {
  primary:      '#22C55E',
  primaryDark:  '#16A34A',
  primaryGlow:  'rgba(34,197,94,0.15)',

  bg:           '#0F172A',
  card:         '#162033',
  cardHover:    '#1C2A40',
  surface:      '#1E293B',

  text:         '#FFFFFF',
  subtext:      '#A1A1AA',
  muted:        '#71717A',

  border:       '#243041',
  borderLight:  '#2D3F56',

  success:      '#22C55E',
  successMuted: 'rgba(34,197,94,0.15)',
  warning:      '#F59E0B',
  warningMuted: 'rgba(245,158,11,0.15)',
  danger:       '#EF4444',
  dangerMuted:  'rgba(239,68,68,0.15)',
  info:         '#0EA5E9',
  infoMuted:    'rgba(14,165,233,0.15)',
};

export const spacing = {
  sidebarWidth: '240px',
  radius:       '8px',
  radiusLg:     '12px',
};

export default colors;
