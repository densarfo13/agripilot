/**
 * ndviPlaceholder.js — placeholder NDVI helper.
 *
 *   import { ndviPlaceholder, NDVI_LABEL }
 *     from 'src/core/satellite/ndviPlaceholder.js';
 *
 * What it is
 * ──────────
 *   A typed placeholder that says, honestly, "we don't have NDVI
 *   data for this field yet". When a real satellite provider is
 *   wired (see `satelliteProviderRegistry.js`), this module is
 *   the contract its adapter will satisfy.
 *
 *   It does NOT compute, fetch, or fake an NDVI value. Calling it
 *   always returns `{ ok: false, reason: 'no_provider' }` until
 *   a provider is enabled.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Honest defaults.
 */

import { isSatelliteEnabled } from './satelliteProviderRegistry.js';

export const NDVI_LABEL = Object.freeze({
  BARE:        'bare',         // <0.1
  SPARSE:      'sparse',       // 0.1–0.2
  LIGHT:       'light',        // 0.2–0.4
  MODERATE:    'moderate',     // 0.4–0.6
  DENSE:       'dense',        // 0.6–0.8
  VERY_DENSE:  'very_dense',   // >0.8
});

const RANGES = Object.freeze([
  { max: 0.1, label: NDVI_LABEL.BARE },
  { max: 0.2, label: NDVI_LABEL.SPARSE },
  { max: 0.4, label: NDVI_LABEL.LIGHT },
  { max: 0.6, label: NDVI_LABEL.MODERATE },
  { max: 0.8, label: NDVI_LABEL.DENSE },
  { max: Infinity, label: NDVI_LABEL.VERY_DENSE },
]);

/** Map a raw NDVI value (-1..1) to a label. Public for future adapters. */
export function labelForNdvi(value) {
  // Treat null / undefined / non-numeric explicitly — `Number(null)`
  // is 0 which would otherwise fall into the BARE bucket and lie
  // about a missing value being "bare ground".
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  for (const { max, label } of RANGES) {
    if (n < max) return label;
  }
  return null;
}

/**
 * Placeholder NDVI lookup. Always returns
 * `{ ok: false, reason: 'no_provider' }` until a provider is
 * enabled in `satelliteProviderRegistry`.
 *
 * @param {object} [_args]  { fieldId, dateIso }
 * @returns {object}
 */
export function ndviPlaceholder(_args) {
  try {
    if (!isSatelliteEnabled()) {
      return Object.freeze({
        ok: false,
        reason: 'no_provider',
        message: 'Satellite NDVI data is not configured yet.',
      });
    }
    // Provider enabled but no adapter implemented — still honest.
    return Object.freeze({
      ok: false,
      reason: 'adapter_not_implemented',
      message: 'A satellite provider is enabled but no adapter is implemented yet.',
    });
  } catch {
    return Object.freeze({ ok: false, reason: 'exception', message: '' });
  }
}

const _module = { NDVI_LABEL, labelForNdvi, ndviPlaceholder };
export default _module;
