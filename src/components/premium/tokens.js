/**
 * tokens.js — central premium-design token table.
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
 *   * No imports — pure constants.
 *   * Object.freeze() on the table so mutation can't bleed
 *     across components.
 */

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
// New ochre-specific keys (`ochre*`) are exposed for components
// that need the explicit accent (CTA gradient, active-state
// indicators, etc.).
export const PREMIUM_TOKENS = Object.freeze({
  // Page backgrounds — warm beige rather than dark navy.
  bgTop:        '#F6F1E7',  // softOchre body wash (top of page)
  bgBottom:     '#EFE7D5',  // slightly deeper at the bottom
  bgGardenTop:  '#F8F2E5',  // garden mode = warmer cream
  bgGardenBot:  '#F1E6D0',
  // Card / panel surfaces — white-on-beige with subtle warmth.
  panel:        '#FFF9F0',  // soft surface
  panelHi:      '#FFFFFF',  // elevated surface
  // Borders pick up the muted-earth palette so cards never feel
  // grey or institutional.
  border:       'rgba(31,41,51,0.08)',
  borderHi:     'rgba(31,41,51,0.14)',
  // Text on light surfaces.
  ink:          '#1F2933',
  inkDim:       '#667085',
  inkFaint:     '#98A2B3',
  // ─── Ochre primary (NEW) ───────────────────────────────────
  ochre:        '#D4A35F',
  ochreActive:  '#B9853F',
  ochreSoft:    '#F2E3C3',
  ochreInk:     '#7A5A28',  // legible ochre text on beige
  ochreBorder:  'rgba(212,163,95,0.42)',
  ochreSurface: 'rgba(212,163,95,0.10)',
  mutedEarth:   '#BFA98A',
  // ─── Growth / success — reserved for health signals only ───
  green:        '#5E8E5E',
  greenSoft:    'rgba(94,142,94,0.12)',
  greenBorder:  'rgba(94,142,94,0.32)',
  greenInk:     '#3F6A3F',
  // ─── Warning + error ───────────────────────────────────────
  amber:        '#E0A238',
  amberSoft:    'rgba(224,162,56,0.14)',
  amberBorder:  'rgba(224,162,56,0.40)',
  amberInk:     '#8A5C12',
  error:        '#D14D4D',
  errorSoft:    'rgba(209,77,77,0.10)',
  errorBorder:  'rgba(209,77,77,0.30)',
  // ─── Structural navy (nav / topbar) ────────────────────────
  navy:         '#24313A',
  navySoft:     'rgba(36,49,58,0.92)',
  // ─── Geometry ──────────────────────────────────────────────
  radiusCard:   18,
  radiusChip:   999,
  shadowCard:  [
    '0 1px 0 0 rgba(255,255,255,0.55) inset',
    '0 18px 32px -16px rgba(80,60,30,0.22)',
    '0 6px 14px -6px rgba(80,60,30,0.14)',
  ].join(', '),
});

export default PREMIUM_TOKENS;
