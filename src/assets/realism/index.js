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
// Standalone calm fallback — usable anywhere a calling surface
// needs the image-missing placeholder shape directly (avatars,
// empty listing thumbnails, draft cards) without depending on
// RealisticPhoto's <img> loading state.
export { default as RealisticPhotoFallback }
  from './photography/RealisticPhotoFallback.jsx';
export {
  PHOTO_SLOTS,
  PHOTO_SLOT_LIST,
  slotPath,
} from './photography/manifest.js';
