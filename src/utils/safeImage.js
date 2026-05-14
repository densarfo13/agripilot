/**
 * safeImage — small helper that decides whether a candidate image
 * path is safe to set as a CSS background OR an <img> src, with a
 * guaranteed fallback to the canonical realism farm photo.
 *
 *   import { safeImage } from '../utils/safeImage.js';
 *
 *   const url = safeImage(maybePath);          // returns a usable URL
 *   const url = safeImage(maybePath, custom);  // overrides fallback
 *
 * Rules
 *   * Returns the canonical farm-atmosphere photo when the input is
 *     null / undefined / empty / a non-string / contains '..'.
 *   * Accepts http(s), data, blob, and root-relative (/...) paths
 *     - same set the rest of the app treats as render-safe.
 *   * Never throws. SSR-safe (no DOM access).
 *
 * Why this exists
 *   The Visual Header Consistency Fix needs every page hero to
 *   surface a real farm photo even when a caller passes a stale
 *   asset path. `<img>` 404s render the browser's broken-image
 *   icon, which is visually jarring; CSS `background-image` 404s
 *   render an empty rectangle. This helper guarantees neither
 *   ever happens — every hero gets a real path.
 */

export const DEFAULT_FARM_IMAGE = '/assets/realism/heroes/africa-farm-atmosphere.jpeg';

function _looksRenderable(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed.startsWith('http://'))  return true;
  if (trimmed.startsWith('https://')) return true;
  if (trimmed.startsWith('data:'))    return true;
  if (trimmed.startsWith('blob:'))    return true;
  if (trimmed.startsWith('/'))        return true;
  return false;
}

/**
 * Resolve a render-safe image URL, falling back to the canonical
 * farm photo when the input isn't usable.
 *
 * @param {any} candidate     potentially unsafe image reference
 * @param {string} [fallback] override the canonical fallback
 * @returns {string}          always a non-empty, render-safe URL
 */
export function safeImage(candidate, fallback) {
  if (_looksRenderable(candidate)) return candidate.trim();
  return _looksRenderable(fallback) ? fallback.trim() : DEFAULT_FARM_IMAGE;
}

/**
 * Whether a value would be served as-is by `safeImage` (i.e.
 * passes the render-safety check without going through the
 * fallback). Useful when callers want to log a missing-asset
 * warning rather than silently swap in the fallback.
 *
 * @param {any} candidate
 * @returns {boolean}
 */
export function isRenderableImage(candidate) {
  return _looksRenderable(candidate);
}

const _module = {
  DEFAULT_FARM_IMAGE,
  safeImage,
  isRenderableImage,
};
export default _module;
