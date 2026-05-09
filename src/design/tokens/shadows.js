/**
 * design/tokens/shadows — calm, earth-toned elevation.
 *
 * Spec §1 + §7: replace strong radial glows / bloom with subtle
 * earthy depth. The shadows below all use a warm brown tint so
 * cards feel like they sit on aged paper, not a blue tech panel.
 *
 *   sm    — barely-there hairline (form fields, input rows)
 *   card  — default card elevation (matches PREMIUM_TOKENS.shadowCard)
 *   modal — sheets + drawers
 *   focus — ochre ring for keyboard focus
 *
 * NEVER USE
 *   neon green glow, bright cyan ring, drop-shadow with pure black.
 */

export const SHADOWS = Object.freeze({
  sm:    '0 1px 2px rgba(80,60,30,0.10)',
  card:  [
    '0 1px 0 0 rgba(255,255,255,0.55) inset',
    '0 18px 32px -16px rgba(80,60,30,0.22)',
    '0 6px 14px -6px rgba(80,60,30,0.14)',
  ].join(', '),
  modal: '0 24px 48px -16px rgba(80,60,30,0.32)',
  focus: '0 0 0 3px rgba(200,148,77,0.32)',
});

export default SHADOWS;
