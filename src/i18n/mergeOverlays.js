/**
 * mergeOverlays.js — merge i18n overlays (shaped `{locale:
 * {key: value}}`) into the main dictionary (shaped `{key:
 * {locale: value}}`).
 *
 * Rule:
 *   • Existing translator-authored values in the main dict
 *     always win — overlays only fill empty slots.
 *
 * Pure. No imports of the overlay data; callers pass them in
 * so this stays trivially testable.
 */

/**
 * mergeLocaleOverlay — apply one overlay object to the main T.
 * Returns the same T reference (for chaining) after mutation.
 */
export function mergeLocaleOverlay(T, overlay) {
  if (!T || typeof T !== 'object') return T;
  if (!overlay || typeof overlay !== 'object') return T;
  for (const [locale, keys] of Object.entries(overlay)) {
    if (!keys || typeof keys !== 'object') continue;
    for (const [key, text] of Object.entries(keys)) {
      if (typeof text !== 'string' || !text) continue;
      if (!T[key]) T[key] = {};
      if (!T[key][locale]) T[key][locale] = text;
    }
  }
  return T;
}

/**
 * mergeManyOverlays — iterate a list and apply each. Later
 * overlays win over earlier ones only when filling empty
 * slots — they still never override main-dict values.
 */
export function mergeManyOverlays(T, overlays = []) {
  if (!Array.isArray(overlays)) return T;
  for (const ov of overlays) {
    mergeLocaleOverlay(T, ov);
  }
  return T;
}
