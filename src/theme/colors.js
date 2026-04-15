/**
 * Farroway Design Tokens — Premium Theme
 *
 * Canonical color + spacing values for the Farroway UI.
 * CSS custom properties in index.css mirror these values.
 * Import this file when you need tokens in JS (inline styles, charts, etc.).
 */

export const colors = {
  // ── Backgrounds (deep navy gradient) ──────────────────────
  bgTop:           '#0B1D34',
  bgBottom:        '#081423',
  bg:              '#0B1D34',       // legacy compat — use bgTop for gradient start

  // ── Surfaces ──────────────────────────────────────────────
  card:            'rgba(255,255,255,0.04)',
  cardElevated:    'rgba(255,255,255,0.06)',
  cardSolid:       '#111D2E',       // when translucency causes readability issues
  surface:         'rgba(255,255,255,0.03)',
  inputBg:         'rgba(255,255,255,0.04)',

  // ── Text ──────────────────────────────────────────────────
  text:            '#EAF2FF',
  subtext:         '#9FB3C8',
  muted:           '#6F8299',

  // ── Primary (green — intentional usage only) ──────────────
  primary:         '#22C55E',
  primaryDark:     '#16A34A',
  primaryGlow:     'rgba(34,197,94,0.22)',
  primarySoft:     'rgba(34,197,94,0.15)',

  // ── Semantic ──────────────────────────────────────────────
  success:         '#22C55E',
  successSoft:     'rgba(34,197,94,0.15)',
  successGlow:     'rgba(34,197,94,0.22)',
  warning:         '#F59E0B',
  warningSoft:     'rgba(245,158,11,0.14)',
  danger:          '#EF4444',
  dangerSoft:      'rgba(239,68,68,0.14)',
  info:            '#0EA5E9',
  infoSoft:        'rgba(14,165,233,0.14)',

  // ── Borders ───────────────────────────────────────────────
  border:          'rgba(255,255,255,0.06)',
  borderSoft:      'rgba(255,255,255,0.06)',
  borderMuted:     'rgba(255,255,255,0.04)',

  // ── Legacy aliases (avoid in new code) ────────────────────
  cardHover:       'rgba(255,255,255,0.07)',
  borderLight:     'rgba(255,255,255,0.08)',
  successMuted:    'rgba(34,197,94,0.15)',
  warningMuted:    'rgba(245,158,11,0.14)',
  dangerMuted:     'rgba(239,68,68,0.14)',
  infoMuted:       'rgba(14,165,233,0.14)',
};

export const shadows = {
  card:    '0 10px 30px rgba(0,0,0,0.28)',
  cardSm:  '0 4px 16px rgba(0,0,0,0.22)',
  cta:     '0 10px 24px rgba(34,197,94,0.22)',
  modal:   '0 16px 48px rgba(0,0,0,0.4)',
};

export const spacing = {
  sidebarWidth:  '240px',
  radius:        '8px',
  radiusLg:      '12px',
  radiusCard:    '20px',
  radiusBtn:     '14px',
};

export default colors;
