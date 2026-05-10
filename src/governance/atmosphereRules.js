/**
 * atmosphereRules — governance for environmental adaptation
 * (day/night, season, weather).
 *
 * Spec §6: "subtle, cinematic, realistic, region-aware,
 * seasonal, lightweight". No dramatic visual shifts.
 *
 * Strict-rule audit
 *   • Pure data. Frozen.
 *   • The actual environmental rendering lives in
 *     `WeatherHeroActionCard` + the `farroway-*` keyframes in
 *     `src/index.css`. This module documents the contract and
 *     exposes rate / amplitude limits the audit can check.
 */

// Maximum simultaneous environmental layers a single surface can
// render. Spec §6 calls for "subtle"; > 2 active layers (rain +
// wind + cloud + sun) is visual noise.
export const MAX_ATMOSPHERE_LAYERS = 2;

// Frame-budget hint — environmental animations should fit inside
// one paint at 60fps. The CSS keyframes already respect this; the
// rule exists so a future addition can self-check.
export const ANIMATION_FRAME_BUDGET_MS = 16;

// Allowed transition durations for atmosphere-driven tint changes
// (e.g. seasonal hero accent shift). Anything outside this range
// reads as either jarring (< 120ms) or sluggish (> 600ms).
export const TINT_TRANSITION_MS = Object.freeze({
  min:        120,
  preferred:  220,
  max:        600,
});

/**
 * Validate a candidate atmosphere change. Returns
 * { ok, reasons } so callers can self-check before applying.
 *
 * @param {{ layers?: number, transitionMs?: number, dramaticShift?: boolean }} input
 */
export function validateAtmosphereChange(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const reasons = [];

  if (Number.isFinite(safe.layers) && safe.layers > MAX_ATMOSPHERE_LAYERS) {
    reasons.push('too_many_layers');
  }
  if (Number.isFinite(safe.transitionMs)) {
    if (safe.transitionMs < TINT_TRANSITION_MS.min) reasons.push('transition_too_fast');
    if (safe.transitionMs > TINT_TRANSITION_MS.max) reasons.push('transition_too_slow');
  }
  if (safe.dramaticShift === true) {
    reasons.push('dramatic_shift_disallowed');
  }

  return Object.freeze({
    ok:      reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export default Object.freeze({
  MAX_ATMOSPHERE_LAYERS,
  ANIMATION_FRAME_BUDGET_MS,
  TINT_TRANSITION_MS,
  validateAtmosphereChange,
});
