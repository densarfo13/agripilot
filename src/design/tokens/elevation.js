/**
 * elevation.js — canonical z-index scale. A single ordered ladder so overlapping
 * surfaces (sticky header, bottom nav, sheets, toasts) never fight with ad-hoc
 * `zIndex: 9999` literals scattered across components.
 *
 *   import { ELEVATION } from 'src/design/tokens';
 *   style={{ zIndex: ELEVATION.bottomNav }}
 *
 * Pairs with SHADOWS (visual depth); ELEVATION is stacking order only.
 */
export const ELEVATION = Object.freeze({
  base:        0,
  raised:      1,    // cards lifting off the page
  sticky:      10,   // sticky section headers
  bottomNav:   50,   // the persistent bottom navigation
  header:      60,   // top app chrome
  overlay:     100,  // scrims behind sheets/modals
  sheet:       110,  // bottom sheets / drawers
  modal:       120,  // centered modals
  toast:       200,  // transient toasts/snackbars (always on top)
});

export default ELEVATION;
