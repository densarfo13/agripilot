/**
 * tokens.js — central premium-design token table.
 *
 * MAY 2026 VISUAL RESTRAINT PASS
 * ──────────────────────────────
 * The locked source of truth now lives in `src/design/tokens/`.
 * This file forwards every value from there so the ~50+
 * existing premium-primitive consumers ( `import { PREMIUM_TOKENS }
 * from '../components/premium/tokens'` ) keep working without a
 * single call-site change.
 *
 * Concretely:
 *   • Colours → design/tokens/colors.js
 *   • Radius  → design/tokens/radius.js
 *   • Shadows → design/tokens/shadows.js
 *
 *   Component code that reads `T.ochre`, `T.panelHi`, etc., now
 *   resolves to the locked Soft Ochre palette — including the
 *   spec §2 ochre bump from `#D4A35F` → `#C8944D` (slightly
 *   deeper, more grounded, better contrast on the warm beige
 *   panel surface).
 *
 * Why this is a SEPARATE file (not just an export inside
 * index.js)
 * ─────────────────────────────────────────────────────
 *   The premium primitives (PremiumPage, PremiumPageHero,
 *   PremiumCard, …) all need the same color / spacing / shadow
 *   tokens. Importing them from `./index.js` creates a
 *   circular dependency: `index.js` re-exports the primitives,
 *   each primitive imports from `index.js`, so when a
 *   consumer page imports `index.js` first, the primitives
 *   evaluate while `index.js` is still mid-evaluation —
 *   `PREMIUM_TOKENS` is `undefined` at the moment the
 *   primitives' module bodies run. In a JIT bundler this
 *   surfaces as `Cannot read properties of undefined (reading
 *   'bgTop')` at first render, which is exactly what the
 *   ErrorBoundary was catching on My Farm / Progress / Funding
 *   / Sell.
 *
 *   Pulling the tokens into their own leaf module means every
 *   primitive can import them WITHOUT touching `./index.js`,
 *   and `index.js` itself just re-exports the tokens for
 *   external callers. No cycle, no race.
 *
 * Strict-rule audit
 *   * No imports from ./index.js — pure leaf-of-leaf module.
 *   * Object.freeze() on the table so mutation can't bleed
 *     across components.
 */

import { COLORS } from '../../design/tokens/colors.js';
import { RADIUS } from '../../design/tokens/radius.js';
import { SHADOWS } from '../../design/tokens/shadows.js';

// Soft Ochre / Beige design system (May 2026 platform refactor)
// ──────────────────────────────────────────────────────────────
// Replaces the previous dark-green / neon palette with a warm,
// natural language: beige page backgrounds, white surfaces,
// ochre primary actions, growth-green reserved for health
// signals only, and a charcoal navy for navigation structure.
//
// IMPORTANT contract:
//   • Ochre  = primary action / active state
//   • Green  = health / growth / success ONLY (never primary)
//   • Beige  = calm background and elevated surfaces
//   • Navy   = bottom-nav / topbar / structural chrome
//
// Token naming kept BACKWARDS COMPATIBLE with the prior dark-
// theme contract (bgTop / bgBottom / bgGardenTop / bgGardenBot
// / panel / border / ink / greenSoft / amberSoft / shadowCard
// etc.) so every existing premium-primitive consumer picks up
// the new palette WITHOUT a code change. Light-on-dark surfaces
// flip to dark-on-beige automatically.
//
// MAY 2026 VISUAL RESTRAINT — the ochre primary value moved
// from #D4A35F to #C8944D per the locked spec. Slightly deeper
// + more grounded. Hover stays at #B9853F. Contrast is still
// WCAG-compliant on the #FFF9F0 panel surface.
export const PREMIUM_TOKENS = Object.freeze({
  // Page backgrounds — warm beige rather than dark navy.
  bgTop:        COLORS.bgTop,
  bgBottom:     COLORS.bgBottom,
  bgGardenTop:  COLORS.bgGardenTop,
  bgGardenBot:  COLORS.bgGardenBot,
  // Card / panel surfaces — white-on-beige with subtle warmth.
  panel:        COLORS.panel,
  panelHi:      COLORS.panelHi,
  // Borders pick up the muted-earth palette so cards never feel
  // grey or institutional.
  border:       COLORS.border,
  borderHi:     COLORS.borderHi,
  // Text on light surfaces.
  ink:          COLORS.ink,
  inkDim:       COLORS.inkDim,
  inkFaint:     COLORS.inkFaint,
  // ─── Ochre primary (locked May 2026) ───────────────────────
  ochre:        COLORS.ochre,
  ochreActive:  COLORS.ochreActive,
  ochreSoft:    COLORS.ochreSoft,
  ochreInk:     COLORS.ochreInk,
  ochreBorder:  COLORS.ochreBorder,
  ochreSurface: COLORS.ochreSurface,
  mutedEarth:   COLORS.mutedEarth,
  // ─── Growth / success — reserved for health signals only ───
  green:        COLORS.green,
  greenSoft:    COLORS.greenSoft,
  greenBorder:  COLORS.greenBorder,
  greenInk:     COLORS.greenInk,
  // ─── Warning + error ───────────────────────────────────────
  amber:        COLORS.amber,
  amberSoft:    COLORS.amberSoft,
  amberBorder:  COLORS.amberBorder,
  amberInk:     COLORS.amberInk,
  error:        COLORS.error,
  errorSoft:    COLORS.errorSoft,
  errorBorder:  COLORS.errorBorder,
  // ─── Structural navy (nav / topbar) ────────────────────────
  navy:         COLORS.navy,
  navySoft:     COLORS.navySoft,
  // ─── Geometry ──────────────────────────────────────────────
  radiusCard:   RADIUS.card,
  radiusChip:   RADIUS.chip,
  shadowCard:   SHADOWS.card,
});

export default PREMIUM_TOKENS;
