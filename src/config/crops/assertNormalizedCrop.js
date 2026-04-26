/**
 * assertNormalizedCrop — dev-only crop-leak detector.
 *
 * Imports the existing 42-crop canonical set from cropAliases.js
 * (the shipped source of truth — DO NOT duplicate the list here).
 * Calling this on a crop value validates that the value resolves
 * to a known canonical id; if not, a one-time `[CROP_LEAK]` warning
 * fires in dev / test so a non-canonical id is loud during QA.
 *
 *   assertNormalizedCrop('maize')              → 'maize'   (canonical)
 *   assertNormalizedCrop('corn')               → 'corn'    (resolves via alias to maize)
 *   assertNormalizedCrop('Cassava root')       → 'Cassava root' (resolves to cassava)
 *   assertNormalizedCrop('spaghetti')          → 'spaghetti' + dev warn "[CROP_LEAK]"
 *
 * Contract — read carefully
 *   • Returns the ORIGINAL value untouched (no mutation).
 *   • Never throws. Production: silent (no warn, no marker).
 *   • Empty / null / undefined input: returned as-is (treated as
 *     "no crop yet" — not a leak).
 *
 * Why a separate file
 *   The shipped `normalizeCrop` already does the actual canonical
 *   resolution. This module is a thin VALIDATOR — it asks "did
 *   the resolution land on a canonical id?" without changing what
 *   the resolver returns. Keeping the leak-detection concern out
 *   of normalizeCrop preserves that function's pure-data contract.
 */

import { CANONICAL_KEYS, normalizeCropKey } from './cropAliases.js';

const CANONICAL_SET = new Set(CANONICAL_KEYS);
const _warnedLeaks = new Set();

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR / non-Vite */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'development') return true;
      if (process.env.NODE_ENV === 'test')        return true;
      if (process.env.VITE_I18N_STRICT === '1')   return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * assertNormalizedCrop(value)
 *
 * @param {*} value — any user-supplied crop value (raw code, label,
 *                    legacy free-text, alias, etc.). Treated as
 *                    opaque; returned unchanged.
 * @returns the original `value`.
 */
export function assertNormalizedCrop(value) {
  if (value == null || value === '') return value;
  if (!_isDev()) return value;

  // Light normalisation FOR CHECKING ONLY. We try two passes so
  // legacy free-text shapes ("Groundnut (peanut)", "Cassava root")
  // that getCropLabel handles via its richer normaliser don't
  // false-fire the leak alarm. Pass 1 = canonical alias resolver;
  // pass 2 = paren-stripped retry. If either resolves into the
  // canonical set, the value is not a leak.
  const tryResolve = (raw) => {
    try { return normalizeCropKey(raw); } catch { return null; }
  };
  let resolved = tryResolve(value);
  if (!resolved || !CANONICAL_SET.has(resolved)) {
    const stripped = String(value)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    if (stripped && stripped !== value) {
      const retry = tryResolve(stripped);
      if (retry) resolved = retry;
    }
  }
  if (resolved && CANONICAL_SET.has(resolved)) return value;

  // Avoid spamming the console with the same id repeatedly.
  const memoKey = String(value).toLowerCase();
  if (_warnedLeaks.has(memoKey)) return value;
  _warnedLeaks.add(memoKey);
  try {
    console.warn(`[CROP_LEAK] non-canonical crop value rendered: "${value}" `
      + `(resolves to "${resolved || 'null'}", not in canonical set). `
      + 'Either add an alias in src/config/crops/cropAliases.js or '
      + 'pass a normalised id from getCrop().');
  } catch { /* never crash */ }

  return value;
}

export const _internal = Object.freeze({ CANONICAL_SET });
