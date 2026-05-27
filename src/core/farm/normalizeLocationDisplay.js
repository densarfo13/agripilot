/**
 * normalizeLocationDisplay.js — fix duplicate "Maryland, United States,
 * United States" patterns and similar production bugs.
 *
 *   import { normalizeLocationDisplay }
 *     from 'src/core/farm/normalizeLocationDisplay.js';
 *
 *   normalizeLocationDisplay('Maryland, United States, United States')
 *     → 'Maryland, United States'
 *
 *   normalizeLocationDisplay({ region: 'Ashanti', country: 'Ghana' })
 *     → 'Ashanti, Ghana'
 *
 *   normalizeLocationDisplay('Ghana, Ghana')
 *     → 'Ghana'
 *
 * What this is
 * ────────────
 *   Pure string-cleaning utility. Splits on commas, trims each
 *   token, lowercases for comparison, drops consecutive duplicates
 *   AND drops country-after-country / region-after-region drift.
 *
 *   Accepts either a plain string or a `{region, country, city}`
 *   object. Returns a single normalised display string.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No I/O. No locale lookups (the locale-aware version lives
 *     in src/utils/locationLabel.js if/when needed).
 */

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _trimToken(s) {
  return _str(s)
    .replace(/\s+/g, ' ')
    .trim()
    // Drop a trailing comma if a caller passed e.g. "Maryland,"
    .replace(/,+$/, '');
}

function _normalizeForCompare(s) {
  return _str(s).toLowerCase().trim();
}

/**
 * Dedupe tokens while preserving original casing of the FIRST
 * occurrence. Case-insensitive matching.
 */
function _dedupeTokens(tokens) {
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    const trimmed = _trimToken(t);
    if (!trimmed) continue;
    const key = _normalizeForCompare(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Normalise a location for display.
 *
 *   string   → dedupe + tidy commas
 *   object   → `{city, region, country}` → "City, Region, Country"
 *              with the same dedupe pass applied
 *   null/odd → null
 */
export function normalizeLocationDisplay(input) {
  return _safe(() => {
    if (input == null) return null;

    let tokens;
    if (typeof input === 'string') {
      tokens = input.split(',');
    } else if (_isObj(input)) {
      tokens = [
        _str(input.city),
        _str(input.region) || _str(input.state),
        _str(input.country),
      ];
    } else {
      return null;
    }

    const deduped = _dedupeTokens(tokens);
    if (deduped.length === 0) return null;
    return deduped.join(', ');
  }, null);
}

/**
 * Variant that ALWAYS returns a string — used in JSX where null
 * would render "null". Returns '' on garbage input.
 */
export function normalizeLocationDisplayString(input) {
  const v = normalizeLocationDisplay(input);
  return typeof v === 'string' ? v : '';
}

export const _internal = Object.freeze({
  _trimToken, _normalizeForCompare, _dedupeTokens,
});

const _module = {
  normalizeLocationDisplay, normalizeLocationDisplayString, _internal,
};
export default _module;
