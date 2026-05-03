/**
 * terminology.js — central per-userType label registry.
 *
 *   import { getTerminology, getLabel } from '../core/terminology.js';
 *
 *   const t = getTerminology();         // current user
 *   t.farmLabel                          // "Farm" | "Garden"
 *   getLabel('cropLabel')                // shortcut
 *
 *   const tForUser = getTerminology('backyard');  // explicit override
 *
 * Why a sibling registry rather than extending contextWords.js
 * ────────────────────────────────────────────────────────────
 *   `contextWords.js` is a vocabulary map (plant ↔ crop, pot ↔
 *   row, etc.) — used by `sanitizeContextCopy()` to rewrite
 *   inline text. THIS module is a top-level UI label registry
 *   (the spec's exact farmLabel / cropLabel / taskLabel /
 *   scanLabel pairs). Both can coexist; they answer different
 *   questions:
 *     contextWords:  "what's the farm-side word for `plant`?"
 *     terminology:   "what label does the UI show for the farm
 *                     entity?"
 *
 * Spec coverage (Build Full Frontend Architecture §4)
 *   backyard / farmer / ngo each get a labels object. The
 *   `getLabel(key)` helper falls back to the farmer label
 *   (the conservative default) when the userType-specific
 *   value is missing.
 *
 * Strict-rule audit
 *   • Pure read — never writes.
 *   • Never throws — unknown userType collapses to 'farmer'.
 *   • SSR-safe (no browser globals at module load).
 *   • Idempotent.
 */

import { getUserType as _getUserType } from './userType.js';

/**
 * The label registry. Each top-level key is a userType; each
 * inner key is a stable label slot the UI can read.
 *
 * Adding a new label is a one-line change here — call sites
 * read it via `getLabel('newLabel')`. New userTypes added
 * later just need their own column.
 */
export const TERMINOLOGY = Object.freeze({
  backyard: Object.freeze({
    farmLabel:  'Garden',
    cropLabel:  'Plant',
    taskLabel:  'Step',
    scanLabel:  'Scan your plant',
    // Modes use these in quick chips / page headers.
    contextLabel: 'Your garden',
    addLabel:     'Add a plant',
  }),
  farmer: Object.freeze({
    farmLabel:  'Farm',
    cropLabel:  'Crop',
    taskLabel:  'Task',
    scanLabel:  'Scan crop',
    contextLabel: 'Your farm',
    addLabel:     'Add a farm',
  }),
  ngo: Object.freeze({
    farmLabel:  'Farm',
    cropLabel:  'Crop',
    taskLabel:  'Activity',
    scanLabel:  'Review scan',
    contextLabel: 'Program',
    addLabel:     'Add a farmer',
  }),
});

const SUPPORTED_TYPES = Object.freeze(['backyard', 'farmer', 'ngo']);

/**
 * getTerminology(userType?) → labels object for the supplied
 * (or current) user type. When `userType` is omitted, reads
 * the current user via `getUserType()`. Falls through to
 * 'farmer' when the userType is unknown.
 */
export function getTerminology(userType) {
  let ut = userType;
  if (!ut) {
    try { ut = _getUserType(); }
    catch { ut = 'farmer'; }
  }
  if (!SUPPORTED_TYPES.includes(ut)) ut = 'farmer';
  return TERMINOLOGY[ut];
}

/**
 * getLabel(key, userType?) → string label for the supplied key.
 * Convenience shortcut that combines `getTerminology` + key
 * lookup. Falls back to the farmer-tier label when the
 * userType-specific value is missing — so a future label that
 * exists only in the farmer column still renders something
 * sensible for backyard/ngo users instead of `undefined`.
 */
export function getLabel(key, userType) {
  if (!key) return '';
  const labels = getTerminology(userType);
  if (labels && labels[key] != null) return labels[key];
  // Conservative fallback: farmer column.
  const farmerLabels = TERMINOLOGY.farmer;
  if (farmerLabels && farmerLabels[key] != null) return farmerLabels[key];
  return '';
}

export const _internal = Object.freeze({ SUPPORTED_TYPES });

export default { TERMINOLOGY, getTerminology, getLabel };
