/**
 * design/tokens/shadows — atmospheric depth for the immersive
 * companion v3 theme (dark navy + glass surfaces).
 *
 * Spec §5: layered shadows + edge lighting + adaptive
 * transparency so cards feel anchored on the atmospheric page
 * rather than floating flat. Each shadow stack has THREE
 * components:
 *
 *   1. Inner highlight (top edge)   — 1px white at low alpha;
 *      catches the cool sky glow above the card so the top edge
 *      feels lit, like glass on a darker surface.
 *   2. Deep drop shadow              — long, soft, dark; pushes
 *      the card off the navy page so the layering reads.
 *   3. Close-contact shadow          — short, tight, dark; gives
 *      the card a grounded base instead of floating in vacuum.
 *
 *   sm    — barely-there hairline (form fields, input rows)
 *   card  — default card elevation
 *   modal — sheets + drawers (drawer slides in over content)
 *   focus — ochre ring for keyboard focus
 *
 * NEVER USE
 *   neon green glow, bright cyan ring, pure black at full alpha.
 *   The atmosphere should feel cool-dark with warm ochre highlights,
 *   not stage-light artificial.
 */

export const SHADOWS = Object.freeze({
  sm:    '0 1px 2px rgba(0,0,0,0.30)',
  card:  [
    // Top edge highlight — catches the sky-glow from above
    '0 1px 0 0 rgba(255,255,255,0.06) inset',
    // Deep drop shadow — pushes the card off the atmospheric page
    '0 20px 40px -16px rgba(0,0,0,0.50)',
    // Close-contact shadow — grounds the base
    '0 6px 14px -6px rgba(0,0,0,0.30)',
  ].join(', '),
  modal: '0 28px 56px -16px rgba(0,0,0,0.55)',
  focus: '0 0 0 3px rgba(200,148,77,0.45)',
});

export default SHADOWS;
