/**
 * resolveCropName.js — single calm renderer for the crop label
 * shown in every farm-aware screen (spec §5).
 *
 *   import { resolveCropName } from 'src/utils/resolveCropName.js';
 *
 *   const cropName = resolveCropName(activeFarm);
 *   <h2>Take a closer look at {cropName} today</h2>
 *
 * What this is
 * ────────────
 *   Resolution order:
 *     1. activeFarm.cropDisplayName  — locale-aware label
 *     2. activeFarm.crop             — canonical cropId fallback
 *     3. 'your crop'                 — calm last-line default
 *
 *   Never returns an empty string — surfaces always have
 *   something readable to render.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • No localStorage / no I/O / no React.
 *   • No "%" / "AI" wording.
 */

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');

export function resolveCropName(farm) {
  if (!_isObj(farm)) return 'your crop';
  const display = _str(farm.cropDisplayName).trim();
  if (display) return display;
  const crop = _str(farm.crop).trim();
  if (crop) return crop;
  return 'your crop';
}

export default resolveCropName;
