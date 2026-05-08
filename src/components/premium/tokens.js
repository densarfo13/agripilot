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

export const PREMIUM_TOKENS = Object.freeze({
  bgTop:        '#0B1D34',
  bgBottom:     '#081423',
  bgGardenTop:  '#0B2421',
  bgGardenBot:  '#08231C',
  panel:        'rgba(255,255,255,0.04)',
  panelHi:      'rgba(255,255,255,0.06)',
  border:       'rgba(255,255,255,0.08)',
  borderHi:     'rgba(255,255,255,0.14)',
  ink:          '#FFFFFF',
  inkDim:       'rgba(255,255,255,0.72)',
  inkFaint:     'rgba(255,255,255,0.50)',
  green:        '#22C55E',
  greenSoft:    'rgba(34,197,94,0.10)',
  greenBorder:  'rgba(34,197,94,0.32)',
  greenInk:     '#86EFAC',
  amber:        '#F59E0B',
  amberSoft:    'rgba(245,158,11,0.12)',
  amberBorder:  'rgba(245,158,11,0.32)',
  amberInk:     '#FCD34D',
  radiusCard:   18,
  radiusChip:   999,
  shadowCard:  [
    '0 1px 0 0 rgba(255,255,255,0.04) inset',
    '0 12px 28px -8px rgba(0,0,0,0.30)',
    '0 4px 8px -2px rgba(0,0,0,0.18)',
  ].join(', '),
});

export default PREMIUM_TOKENS;
