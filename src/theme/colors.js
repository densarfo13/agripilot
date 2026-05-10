/**
 * Farroway Design Tokens — Premium Theme (Soft Ochre / Beige).
 *
 * UNIFIED COLOR SYSTEM (Intelligence Expansion §1)
 * ────────────────────────────────────────────────
 * The locked source of truth lives in `src/design/tokens/colors.js`.
 * Every key here forwards to that table so legacy consumers reading
 * `colors.primary`, `colors.bgTop`, etc., automatically pick up the
 * beige palette without a per-file rewrite.
 *
 * RULES
 *   • Ochre (#C8944D) = primary action / active state.
 *   • Olive earth (#6E8B61) = success / health ONLY.
 *   • Beige (#F6F1E7 / #FFF9F0) = page wash + surfaces.
 *   • Navy (#24313A) = navigation structure only.
 *   • No neon. No radioactive green. No dark-navy page backgrounds.
 *
 * Pre-existing call sites read keys like `colors.primary` and expect
 * a green CTA tint — that historical contract is now satisfied with
 * the warmer ochre primary; the success / done states keep the muted
 * olive earth-green.
 */

import { COLORS } from '../design/tokens/colors.js';

export const colors = Object.freeze({
  // ── Page wash ─────────────────────────────────────────────
  bgTop:           COLORS.bgTop,        // #F6F1E7
  bgBottom:        COLORS.bgBottom,     // #EFE7D5
  bg:              COLORS.bgTop,

  // ── Surfaces ──────────────────────────────────────────────
  card:            COLORS.panelHi,      // #FFFFFF
  cardElevated:    COLORS.panelHi,
  cardSolid:       COLORS.panelHi,
  surface:         COLORS.panel,        // #FFF9F0
  inputBg:         COLORS.panelHi,

  // ── Text ──────────────────────────────────────────────────
  text:            COLORS.ink,          // #1F2933
  subtext:         COLORS.inkDim,       // #667085
  muted:           COLORS.inkFaint,     // #98A2B3

  // ── Primary action — now warm ochre, not neon green ───────
  primary:         COLORS.ochre,        // #C8944D
  primaryDark:     COLORS.ochreActive,  // #B9853F
  primaryGlow:     COLORS.ochreSurface,
  primarySoft:     COLORS.ochreSoft,

  // ── Semantic ──────────────────────────────────────────────
  success:         COLORS.success,      // #6E8B61 (olive earth)
  successSoft:     COLORS.greenSoft,
  successGlow:     COLORS.greenSoft,
  warning:         COLORS.warning,      // #D6A13D
  warningSoft:     COLORS.amberSoft,
  danger:          COLORS.error,        // #C65A4B
  dangerSoft:      COLORS.errorSoft,
  info:            COLORS.ochre,        // no separate info hue in unified system
  infoSoft:        COLORS.ochreSurface,

  // ── Borders ───────────────────────────────────────────────
  border:          COLORS.borderSoft,   // rgba(36,49,58,0.08)
  borderSoft:      COLORS.borderSoft,
  borderMuted:     COLORS.borderSoft,

  // ── Legacy aliases ────────────────────────────────────────
  cardHover:       COLORS.panelHi,
  borderLight:     COLORS.borderHi,
  successMuted:    COLORS.greenSoft,
  warningMuted:    COLORS.amberSoft,
  dangerMuted:     COLORS.errorSoft,
  infoMuted:       COLORS.ochreSurface,
});

export const shadows = Object.freeze({
  card:    '0 10px 30px rgba(15,23,42,0.06)',
  cardSm:  '0 4px 16px rgba(15,23,42,0.06)',
  cta:     '0 10px 24px rgba(200,148,77,0.32)',
  modal:   '0 16px 48px rgba(15,23,42,0.16)',
});

export const spacing = Object.freeze({
  sidebarWidth:  '240px',
  radius:        '8px',
  radiusLg:      '12px',
  radiusCard:    '20px',
  radiusBtn:     '14px',
});

export default colors;
