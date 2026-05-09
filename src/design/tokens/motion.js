/**
 * design/tokens/motion — restrained motion (spec §10).
 *
 *   tap     — 140ms scale + opacity (matches the `.ff-tap` global class)
 *   fade    — 180ms opacity fade for cross-fade transitions
 *   slide   — 220ms ease-out for entrance/exit (modals, sheets)
 *   shimmer — 1400ms infinite for "preparing camera" placeholder
 *
 * RULES
 *   • No bouncy springs.
 *   • No glow pulses or radial flashes.
 *   • Aggressive transitions are forbidden — keep it under 250ms.
 */

export const MOTION = Object.freeze({
  durations: Object.freeze({
    tap:     140,
    fade:    180,
    slide:   220,
    shimmer: 1400,
  }),
  easings: Object.freeze({
    standard:    'cubic-bezier(0.4, 0.0, 0.2, 1)',     // material-style standard
    decelerate:  'cubic-bezier(0.0, 0.0, 0.2, 1)',     // entrances
    accelerate:  'cubic-bezier(0.4, 0.0, 1, 1)',       // exits
    linear:      'linear',
  }),
  // Pre-baked CSS strings for the most common transitions.
  transitions: Object.freeze({
    tap:    'transform 140ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 140ms cubic-bezier(0.4, 0.0, 0.2, 1)',
    fade:   'opacity 180ms cubic-bezier(0.4, 0.0, 0.2, 1)',
    slide:  'transform 220ms cubic-bezier(0.0, 0.0, 0.2, 1), opacity 220ms cubic-bezier(0.0, 0.0, 0.2, 1)',
  }),
});

export default MOTION;
