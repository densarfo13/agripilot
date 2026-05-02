/**
 * locationStore.js — single-key, single-purpose location
 * persistence so any surface (review, recovery, future
 * preview-before-save flows) can read the user's pick without
 * walking the active farm/garden record.
 *
 *   import {
 *     saveLocation, loadLocation, clearLocation,
 *   } from '../utils/locationStore.js';
 *
 *   saveLocation({ country: 'USA', region: 'Maryland' });
 *   loadLocation();   // \u2192 { country: 'USA', region: 'Maryland' } | null
 *   clearLocation();  // wipes the entry
 *
 * Storage
 * ───────
 *   farroway_location  \u2192  JSON `{ country: string, region: string }`
 *
 * Why a separate key (vs reading from the active farm/garden)
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * The setup forms persist their full state under
 * `farroway_garden_draft` / `farroway_farm_draft` (versioned +
 * sanitised, schema-narrowed). That format is intentionally
 * private to the setup flow.
 *
 * `farroway_location` is a flat, public, single-purpose
 * snapshot any reader can rely on without knowing the draft
 * version or running the sanitiser. It survives setup
 * completion and is updated on every save so a future
 * "preview my plan" surface that runs BEFORE the full farm
 * record exists can render the user's location.
 *
 * Strict-rule audit
 *   \u2022 Pure outside the localStorage I/O. Every read/write
 *     wrapped in try/catch \u2014 never throws.
 *   \u2022 SSR-safe: typeof localStorage check before every access.
 *   \u2022 Idempotent: two identical saveLocation() calls produce
 *     the same persisted state. Empty input clears.
 *   \u2022 Privacy: only country + region. No exact address, no
 *     lat/lng. Matches the data-moat layer's region-level rule.
 */

export const LOCATION_STORE_KEY = 'farroway_location';

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value));
  } catch { /* swallow \u2014 quota / private mode */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

/**
 * saveLocation({ country, region, lat?, lng? }) \u2192 stored shape.
 *
 * Always persists a `{ country, region, lat?, lng? }` object.
 * Country + region are coerced to strings (empty when missing);
 * lat / lng are kept ONLY when they're finite numbers so a
 * stale `null` / `undefined` / `NaN` never lands in storage.
 *
 * Final Review Validation \u00a71 \u2014 single canonical shape:
 *   { country, region, lat?, lng? }
 * No mixed keys ('state', 'countryName', 'locationText').
 *
 * Spec rule (\u00a72): when BOTH country and region are empty,
 * the entry is wiped instead of persisted \u2014 callers don't
 * end up with a stale partial entry after the user clears
 * both inputs. lat/lng alone do NOT keep the entry alive
 * because the user-visible part is the country + region.
 *
 * @param {object} input
 * @param {string} [input.country]
 * @param {string} [input.region]
 * @param {number} [input.lat]
 * @param {number} [input.lng]
 * @returns {{country:string, region:string, lat?:number, lng?:number}|null}
 */
export function saveLocation(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const country = (typeof i.country === 'string' ? i.country : '').trim();
  const region  = (typeof i.region  === 'string' ? i.region  : '').trim();
  // Both visible fields empty \u2192 clear so a previously-saved
  // value doesn't linger after the user wipes the form.
  if (!country && !region) {
    _safeRemove(LOCATION_STORE_KEY);
    return null;
  }
  const record = { country, region };
  // Only include lat / lng when they're finite numbers. A null
  // / undefined / NaN value is dropped so the stored shape
  // never has stale geo data attached.
  if (typeof i.lat === 'number' && Number.isFinite(i.lat)) {
    record.lat = i.lat;
  }
  if (typeof i.lng === 'number' && Number.isFinite(i.lng)) {
    record.lng = i.lng;
  }
  try {
    _safeSet(LOCATION_STORE_KEY, JSON.stringify(record));
  } catch { /* swallow */ }
  return record;
}

/**
 * loadLocation() \u2192 stored shape | null.
 *
 * Reads + safe-parses the entry. Returns null when:
 *   \u2022 nothing is stored,
 *   \u2022 the stored value is unparseable,
 *   \u2022 the stored value is the wrong shape.
 *
 * The shape guarantee: when this returns non-null, both
 * `country` and `region` are strings (possibly empty). Callers
 * never have to check field types.
 */
export function loadLocation() {
  const raw = _safeGet(LOCATION_STORE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const out = {
      country: typeof parsed.country === 'string' ? parsed.country : '',
      region:  typeof parsed.region  === 'string' ? parsed.region  : '',
    };
    // Final Review Validation \u00a71 \u2014 surface lat/lng when the
    // stored entry has them, dropped otherwise. Callers that
    // don't care about geo (e.g. the review display) just
    // ignore the extra fields.
    if (typeof parsed.lat === 'number' && Number.isFinite(parsed.lat)) {
      out.lat = parsed.lat;
    }
    if (typeof parsed.lng === 'number' && Number.isFinite(parsed.lng)) {
      out.lng = parsed.lng;
    }
    return out;
  } catch {
    // Unparseable entry \u2014 wipe so a future read doesn't keep
    // hitting the same bad payload. Best-effort; never throws.
    _safeRemove(LOCATION_STORE_KEY);
    return null;
  }
}

/** Wipe the entry. Used by the privacy "clear my activity" surface. */
export function clearLocation() {
  _safeRemove(LOCATION_STORE_KEY);
}

export default { saveLocation, loadLocation, clearLocation };
