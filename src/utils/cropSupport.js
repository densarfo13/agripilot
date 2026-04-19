/**
 * cropSupport.js — per-crop support depth map.
 *
 * FULLY_GUIDED:    recommendation rules + task templates + stage
 *                  logic + crop plan support all wired up
 * PARTIAL_GUIDANCE:recommendation support exists but tasks/stages
 *                  are generic
 * BROWSE_ONLY:     can be displayed/selected, no deep guidance yet
 */

export const CROP_SUPPORT_DEPTH = Object.freeze({
  FULLY_GUIDED:     'FULLY_GUIDED',
  PARTIAL_GUIDANCE: 'PARTIAL_GUIDANCE',
  BROWSE_ONLY:      'BROWSE_ONLY',
});

/**
 * The "core 8" crops — these have hand-tuned task templates in
 * `taskPlanEngine`, stage overlays in `cropTaskTemplates`, and full
 * scoring coverage. Farroway treats these as production-quality.
 */
const FULLY_GUIDED_SET = new Set([
  'tomato', 'pepper', 'lettuce', 'beans',
  'peanut', 'sorghum', 'corn', 'sweet_potato',
]);

/** Additional crops with scoring + default task templates. */
const PARTIAL_SET = new Set([
  'herbs', 'bush_beans', 'pole_beans', 'okra', 'cucumber',
  'squash', 'zucchini', 'kale', 'carrot', 'onion', 'cabbage',
  'potato', 'strawberry', 'eggplant', 'spinach', 'radish',
  'beets', 'broccoli', 'peas', 'green_onion', 'collards',
  'swiss_chard', 'pumpkin', 'melon', 'chili_pepper', 'sweet_corn',
  'soybean', 'wheat', 'oats', 'barley', 'rice', 'sunflower',
  'cotton', 'alfalfa',
]);

/**
 * Anything we ship in the catalog but haven't deeply wired.
 * Cassava, coffee, sugarcane, and the tree/perennial fruits all land
 * here by default so the UI is honest about what guidance exists.
 */
export const CROP_SUPPORT = Object.freeze({
  // Override explicitly so future refactors can't accidentally promote.
  cassava: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  citrus: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  sugarcane: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  taro: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  banana: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  papaya: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  pineapple: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  apple: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  grapes: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  almonds: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  pecan: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  blueberry: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
  raspberry: { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY },
});

export function getCropSupport(cropKey) {
  if (!cropKey) return { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY };
  const key = String(cropKey).toLowerCase();
  if (FULLY_GUIDED_SET.has(key)) return { depth: CROP_SUPPORT_DEPTH.FULLY_GUIDED };
  if (CROP_SUPPORT[key]) return CROP_SUPPORT[key];
  if (PARTIAL_SET.has(key)) return { depth: CROP_SUPPORT_DEPTH.PARTIAL_GUIDANCE };
  return { depth: CROP_SUPPORT_DEPTH.BROWSE_ONLY };
}

export function getCropSupportDepth(cropKey) {
  return getCropSupport(cropKey).depth;
}

export function isFullyGuidedCrop(cropKey) {
  return getCropSupportDepth(cropKey) === CROP_SUPPORT_DEPTH.FULLY_GUIDED;
}

// Points to the shared-namespace keys ('support.full/partial/browse')
// so every screen renders the same depth label in every language.
export const DEPTH_I18N_KEY = Object.freeze({
  FULLY_GUIDED:     'support.full',
  PARTIAL_GUIDANCE: 'support.partial',
  BROWSE_ONLY:      'support.browse',
});

export const CORE_SUPPORTED_CROPS = Object.freeze([...FULLY_GUIDED_SET]);
