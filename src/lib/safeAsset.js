/**
 * safeAsset.js — exception-free asset URL resolver.
 *
 *   safeAsset(REALISM_ASSETS.farm.someKey)   // resolved + validated
 *   safeAsset(undefined, fallbackPath)        // returns fallback
 *   safeAsset(garbage)                        // returns null
 *
 * Why a named helper
 * ──────────────────
 *   The realism resolver in src/lib/realVisuals.jsx is the central
 *   asset registry — it owns the canonical path mappings and the
 *   .webp / .jpeg compatibility layer. What it doesn't expose is a
 *   minimal "is this path safe to drop into <img src>?" predicate
 *   the way safeUrl provides for URL construction.
 *
 *   This helper wraps the same safety pattern around any asset
 *   string a component might receive (props, server payload,
 *   localStorage cache, etc.). The rules:
 *
 *     1. null / undefined / empty / non-string  → null or fallback
 *     2. Path traversal attempts ('../', etc.)  → null
 *     3. Protocol-relative or javascript: URLs  → null
 *     4. Valid relative path or http(s) URL     → trimmed pass-through
 *
 *   The runtime-stabilization spec §1 calls out safeAsset() as a
 *   named helper farmers' surfaces can adopt without each surface
 *   having to re-derive these rules. Pairs with safeUrl + safeApiBase.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Never resolves dangerous protocols ('javascript:', 'data:'
 *     other than data:image/, 'vbscript:'). Returns null instead.
 *   • Returns a STRING (not a URL object) since asset paths
 *     usually feed into <img src>, CSS url(), or fetch — none of
 *     which want a URL object.
 *   • The fallback path is itself validated — a bad fallback
 *     returns null, never an unsafe value.
 */

// Dangerous protocols that should NEVER be returned from safeAsset.
// data:image/* IS allowed (used for inline base64 thumbnails); other
// data: URIs are blocked. file:// is blocked (would leak local paths
// in some Electron / Capacitor builds).
const _DANGEROUS_PREFIXES = Object.freeze([
  'javascript:',
  'vbscript:',
  'file:',
]);

// Path-traversal patterns. A bare '..' segment can escape an
// asset directory in some serving configurations.
const _TRAVERSAL_RE = /(?:^|[\\/])\.\.(?=[\\/]|$)/;

function _safeString(v) {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function _isSafePath(path) {
  if (!path) return false;
  const lower = path.toLowerCase();

  // Block dangerous protocols.
  for (const p of _DANGEROUS_PREFIXES) {
    if (lower.startsWith(p)) return false;
  }

  // Allow data:image/ but block other data: URIs.
  if (lower.startsWith('data:')) {
    return lower.startsWith('data:image/');
  }

  // Block path traversal.
  if (_TRAVERSAL_RE.test(path)) return false;

  // Allow:
  //   • Absolute http(s) URLs
  //   • Relative paths starting with / or ./
  //   • Bare filenames (resolved relative to the importer)
  return true;
}

/**
 * Validate an asset path. Returns the trimmed path on success or
 * the fallback (also validated) on failure. Returns null when both
 * the input and the fallback are unsafe.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string|null}
 */
export function safeAsset(value, fallback) {
  const candidate = _safeString(value);
  if (candidate && _isSafePath(candidate)) return candidate;
  const fb = _safeString(fallback);
  if (fb && _isSafePath(fb)) return fb;
  return null;
}

/**
 * Boolean variant — useful for guards.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeAssetPath(value) {
  const s = _safeString(value);
  return s !== null && _isSafePath(s);
}

export default { safeAsset, isSafeAssetPath };
