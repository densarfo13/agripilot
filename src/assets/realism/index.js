/**
 * realism — Farroway premium agricultural visual system
 * (May 2026 realism migration).
 *
 *   import { RealisticIcon } from 'src/assets/realism';
 *   import { RealisticPhoto, PHOTO_SLOTS } from 'src/assets/realism';
 *
 * MODULES
 *   icons/RealisticIcon.jsx   — premium line-style SVG catalogue
 *   photography/manifest.js   — slot catalogue + path helper
 *   photography/RealisticPhoto.jsx — slot-aware <picture> with fallback
 */

export { default as RealisticIcon, REALISTIC_ICON_NAMES }
  from './icons/RealisticIcon.jsx';
export { default as RealisticPhoto }
  from './photography/RealisticPhoto.jsx';
export {
  PHOTO_SLOTS,
  PHOTO_SLOT_LIST,
  slotPath,
} from './photography/manifest.js';
