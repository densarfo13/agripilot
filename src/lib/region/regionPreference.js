/**
 * regionPreference.js — user-set country override.
 *
 * Stores the explicit country choice when the user picks one in
 * Settings (overrides browser locale + IP-based detection). When
 * unset, callers fall back to whatever upstream detection chain
 * is already in place (profile.country, browser, fallback to UNKNOWN).
 *
 * Storage key: farroway_region_override
 *
 * Strict-rule audit
 *   • Pure module — no React, no I/O beyond localStorage.
 *   • Never throws — every read/write guarded.
 *   • SSR-safe — localStorage access checked.
 *   • Same-tab event for live React updates without storage round-trip.
 *   • Cross-tab sync via the native `storage` event.
 */

import { isKnownCountry } from '../../intelligence/region/regionProfiles.js';

export const REGION_OVERRIDE_KEY     = 'farroway_region_override';
export const REGION_OVERRIDE_EVENT   = 'farroway:region_override_changed';

// ─── Read / write ─────────────────────────────────────────────────

/**
 * readRegionOverride() → string|null
 * Returns the persisted ISO-2 country code, or null when unset
 * (the caller should fall through to the detection chain).
 */
export function readRegionOverride() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(REGION_OVERRIDE_KEY);
    if (!raw) return null;
    const code = String(raw).trim().toUpperCase();
    return code && isKnownCountry(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * writeRegionOverride(countryCode) → string|null
 * Persists the user-picked country. Empty / null clears the
 * override (caller falls through to detection). Returns the
 * effective stored value (or null when cleared).
 *
 * Dispatches farroway:region_override_changed so same-tab
 * subscribers re-render immediately.
 */
export function writeRegionOverride(countryCode) {
  try {
    if (typeof localStorage === 'undefined') return null;

    if (!countryCode || !isKnownCountry(countryCode)) {
      localStorage.removeItem(REGION_OVERRIDE_KEY);
      _emit(null);
      return null;
    }

    const code = String(countryCode).trim().toUpperCase();
    localStorage.setItem(REGION_OVERRIDE_KEY, code);
    _emit(code);
    return code;
  } catch {
    return null;
  }
}

/**
 * clearRegionOverride() — sugar for `writeRegionOverride(null)`.
 */
export function clearRegionOverride() {
  return writeRegionOverride(null);
}

// ─── Internal ──────────────────────────────────────────────────────

function _emit(code) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(REGION_OVERRIDE_EVENT, {
        detail: { countryCode: code || null },
      }));
    }
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({
  _emit,
});
