/**
 * design/tokens/radius — locked corner radius scale.
 *
 * Spec §11. Components MUST pick one of these values; no
 * bespoke `borderRadius: 13`.
 */

export const RADIUS = Object.freeze({
  none:  0,
  sm:    8,
  md:    12,
  card:  18,    // matches legacy PREMIUM_TOKENS.radiusCard
  lg:    24,
  xl:    32,
  pill:  999,
  chip:  999,   // alias kept for legacy callers
});

export default RADIUS;
