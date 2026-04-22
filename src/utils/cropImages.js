/**
 * cropImages.js — thin wrapper around src/config/cropImages.js that
 * matches the spec's preferred shape:
 *
 *   import { cropImageMap, getCropImage } from '../utils/cropImages';
 *
 * Why a wrapper? The canonical catalog lives in src/config/ so it
 * sits alongside the other per-domain config (crops, cropLifecycles,
 * cropPrices, cropYieldRanges). Screens that want a utility-style
 * import get this file; engines that want the structured export
 * keep reading from src/config/cropImages.js. One source of truth,
 * two ergonomic shapes.
 */

import {
  CROP_IMAGE_PATHS,
  CROP_IMAGE_PLACEHOLDER,
  getCropImage,
  getCropImagePath,
  hasCropImage,
} from '../config/cropImages.js';

// Alias: the spec asked for `cropImageMap`.
export const cropImageMap = CROP_IMAGE_PATHS;
export const fallbackCropImage = CROP_IMAGE_PLACEHOLDER;

// Re-exports so callers can grab everything from one path.
export { getCropImage, getCropImagePath, hasCropImage };

export default getCropImage;
