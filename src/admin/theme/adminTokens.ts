/**
 * adminTokens.ts — the single source of truth for the enterprise ADMIN theme
 * (2026-07-05). Admin-only: farmer mobile flows use the base design system
 * (src/design). This is a distinct visual context — a dark, credible SaaS
 * console for NGO / government / enterprise / investor demos — so it has its
 * own token set rather than overloading the farmer palette.
 *
 * Rule: admin components consume THESE tokens (or the CSS variables in
 * adminTheme.css), never raw hex. This file is the ONE place hex literals live.
 */

export const adminColors = Object.freeze({
  // Base — dark navy console
  bg:            '#0B1220', // app background
  bgElevated:    '#111C2E', // panels / page body
  surface:       '#16233A', // cards
  surfaceGlass:  'rgba(22,35,58,0.72)', // glass cards over gradients
  border:        'rgba(148,163,184,0.14)',
  borderStrong:  'rgba(148,163,184,0.28)',

  // Text
  text:          '#E6EDF7',
  textMuted:     '#9AA9BF',
  textFaint:     '#64748B',
  textInverse:   '#08111A',

  // Accents — deep emerald primary, soft gold for the single key action
  emerald:       '#10B981',
  emeraldDeep:   '#047857',
  emeraldSoft:   'rgba(16,185,129,0.14)',
  gold:          '#D8B466', // action highlight — use sparingly (one primary CTA)
  goldSoft:      'rgba(216,180,102,0.16)',

  focus:         '#38BDF8', // visible focus ring (AA contrast on dark)
});

// Risk / status colors — deliberate, colorblind-distinguishable, each paired
// with a soft background so they never rely on hue alone (AA + non-color-only).
export const statusColors = Object.freeze({
  critical: { fg: '#FCA5A5', bg: 'rgba(239,68,68,0.14)',  dot: '#EF4444' },
  high:     { fg: '#FDBA74', bg: 'rgba(249,115,22,0.14)', dot: '#F97316' },
  medium:   { fg: '#FDE68A', bg: 'rgba(234,179,8,0.14)',  dot: '#EAB308' },
  low:      { fg: '#86EFAC', bg: 'rgba(34,197,94,0.14)',  dot: '#22C55E' },
  neutral:  { fg: '#CBD5E1', bg: 'rgba(148,163,184,0.12)', dot: '#94A3B8' },
  info:     { fg: '#93C5FD', bg: 'rgba(59,130,246,0.14)', dot: '#3B82F6' },
});

export const adminSpacing = Object.freeze({
  xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px', xxxl: '48px',
});

export const adminRadius = Object.freeze({
  sm: '8px', md: '12px', lg: '16px', xl: '20px', pill: '999px',
});

export const adminShadow = Object.freeze({
  card:  '0 1px 2px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.24)',
  pop:   '0 12px 40px rgba(0,0,0,0.42)',
  focus: '0 0 0 3px rgba(56,189,248,0.45)', // matches adminColors.focus
});

export const adminTypography = Object.freeze({
  fontSans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  // type scale
  display: { size: '28px', weight: 800, lh: '1.2' },
  h1:      { size: '22px', weight: 700, lh: '1.25' },
  h2:      { size: '18px', weight: 700, lh: '1.3' },
  body:    { size: '14px', weight: 400, lh: '1.5' },
  small:   { size: '13px', weight: 400, lh: '1.45' },
  label:   { size: '12px', weight: 600, lh: '1.4' },
});

export const adminZIndex = Object.freeze({
  base: 0, sticky: 100, sidebar: 200, topbar: 210, dropdown: 900, modal: 1000, toast: 1100,
});

export const adminMotion = Object.freeze({
  fast: '120ms', base: '200ms', slow: '320ms',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
});

// Minimum interactive target (AA / touch) — enforce on admin buttons/rows.
export const adminA11y = Object.freeze({ minTarget: '44px' });

export const adminTokens = Object.freeze({
  colors: adminColors,
  statusColors,
  spacing: adminSpacing,
  radius: adminRadius,
  shadow: adminShadow,
  typography: adminTypography,
  zIndex: adminZIndex,
  motion: adminMotion,
  a11y: adminA11y,
});

export default adminTokens;
