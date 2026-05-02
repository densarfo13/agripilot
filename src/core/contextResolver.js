/**
 * contextResolver.js \u2014 single source of truth for "who is this
 * user, what are they working on right now, and where".
 *
 *   import { resolveUserContext } from '../core/contextResolver.js';
 *   const ctx = resolveUserContext(user);
 *   // \u2192 { experience, gardenId, farmId, growingSetup,
 *   //      location, cropOrPlant }
 *
 * Spec rule (final-gap stability \u00a71): every consumer that
 * needs to know "is this a backyard or a farm?" or "which
 * garden/farm is active right now?" calls THIS module instead
 * of reading localStorage directly. The function NEVER returns
 * undefined / null shape \u2014 every key in the returned object is
 * a usable value (string or null), and missing pieces fall
 * through to safe defaults.
 *
 * Why this exists
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Different surfaces have been pulling slightly-different views
 * of "current context" \u2014 ScanPage reads activeFarm + experience
 * separately, daily plan reads `farm` from ProfileContext, the
 * scan policy reads `contextType` from a result, and the
 * treatment engine reads `activeExperience` from a prop. A
 * single resolver collapses all those reads into one stable
 * shape so we can audit + test "what does the app think this
 * user is doing right now?" in one place.
 *
 * Strict-rule audit
 *   \u2022 Pure function. No I/O beyond reading localStorage (gated
 *     behind typeof checks so it works in SSR / node tests).
 *   \u2022 Never throws. Every read is wrapped + falls through to
 *     safe defaults.
 *   \u2022 Idempotent. Two consecutive calls with the same `user`
 *     return identical structural data.
 *   \u2022 Coexists with the existing ProfileContext + multiExperience
 *     store \u2014 this module READS them, never writes.
 */

import {
  getActiveExperience,
  getActiveGardenId,
  getActiveEntity,
} from '../store/multiExperience.js';
import { getActiveFarmId } from '../store/farrowayLocal.js';

/**
 * Read JSON from localStorage with a try/catch. Returns the
 * fallback when the key is missing / unparseable / storage is
 * disabled (private mode, SSR, etc.).
 */
function _readJSON(key, fallback = null) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

/**
 * Normalise the experience hint to canonical values:
 *   'garden' \u2014 backyard / kitchen plot users
 *   'farm'   \u2014 commercial / smallholder farm users
 *   'generic'\u2014 unknown / unset (the conservative default)
 *
 * Accepts the historical 'backyard' alias (some callers wrote
 * that into farroway_experience before the canonical 'garden'
 * label was introduced).
 */
function _normaliseExperience(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'garden' || v === 'backyard') return 'garden';
  if (v === 'farm') return 'farm';
  return 'generic';
}

/**
 * Pull a country/region/city tuple from the row (or nested
 * `meta`) so callers can render "City, Country" without
 * needing to know which key the row actually uses.
 */
function _readLocation(row) {
  const safe = (row && typeof row === 'object') ? row : {};
  const country = safe.country || safe.countryCode || safe.countryLabel || null;
  const region  = safe.region  || safe.state       || safe.stateLabel   || null;
  const city    = safe.city    || safe.cityLabel   || null;
  if (!country && !region && !city) return null;
  return { country: country || null, region: region || null, city: city || null };
}

/**
 * Pull the canonical crop / plant name. Garden rows persist
 * `crop` (lowercased) + `cropLabel` (display); farm rows do
 * the same. The treatment + scan engines all read `crop` so
 * we surface that as the canonical key.
 */
function _readCropOrPlant(row) {
  const safe = (row && typeof row === 'object') ? row : {};
  return safe.crop || safe.cropId || safe.plantName || safe.cropLabel || null;
}

/**
 * resolveUserContext(user) \u2192 stable context object.
 *
 * @param {object|null} [user]  optional user record (auth user, profile,
 *                              or the active garden/farm row). When
 *                              omitted, the resolver pulls the active
 *                              entity from localStorage.
 * @returns {{
 *   experience:    'garden'|'farm'|'generic',
 *   gardenId:      string|null,
 *   farmId:        string|null,
 *   growingSetup:  'container'|'bed'|'ground'|'unknown',
 *   location:      { country, region, city }|null,
 *   cropOrPlant:   string|null,
 * }}
 */
export function resolveUserContext(user = null) {
  // 1. Active experience from the explicit hint OR fall through
  //    to the multiExperience getter. The hint is the canonical
  //    write-site (FastFlow stamps it; setup forms re-stamp it).
  let experience = _normaliseExperience(_readJSON('farroway_experience', null));
  if (experience === 'generic') {
    try { experience = _normaliseExperience(getActiveExperience()); }
    catch { /* swallow */ }
  }

  // 2. Active garden + farm IDs. Both are queryable independently
  //    so a multi-experience user can flip between them without
  //    losing either pointer.
  let gardenId = null;
  let farmId   = null;
  try { gardenId = getActiveGardenId() || null; } catch { /* swallow */ }
  try { farmId   = getActiveFarmId()   || null; } catch { /* swallow */ }

  // 3. Active entity row \u2014 reads the user-provided argument
  //    first (lets ProfileContext callers thread their value
  //    through), falls back to multiExperience.getActiveEntity()
  //    which resolves the right row for the active experience.
  let row = null;
  if (user && typeof user === 'object') {
    row = user;
  } else {
    try { row = getActiveEntity() || null; } catch { /* swallow */ }
  }

  // 4. Growing setup \u2014 GARDEN ONLY. Final-gap spec \u00a76 mandates
  //    that garden experience always has a usable value here so
  //    downstream code doesn't have to handle null. We coerce
  //    missing values to 'unknown' (the safest fallback).
  const rawSetupBefore = String(row?.growingSetup || '').toLowerCase();
  const rawSetup = SETUP_ALIAS[rawSetupBefore] || rawSetupBefore;
  // Merge-spec canonical taxonomy. The legacy 'bed' / 'indoor'
  // values are normalised to the new keys so any garden saved
  // before the rename still resolves to a usable bucket.
  const SETUP_ALIAS = { bed: 'raised_bed', indoor: 'indoor_balcony' };
  const ALLOWED_SETUPS = new Set(['container', 'raised_bed', 'ground', 'indoor_balcony', 'unknown']);
  let growingSetup = ALLOWED_SETUPS.has(rawSetup) ? rawSetup : 'unknown';
  if (experience !== 'garden') {
    // Farms don't have a growingSetup concept; report 'unknown'
    // so callers reading the field never branch on a stale value.
    growingSetup = 'unknown';
  }

  // 5. Location + crop/plant pulled from the resolved row.
  const location    = _readLocation(row);
  const cropOrPlant = _readCropOrPlant(row);

  return {
    experience,
    gardenId,
    farmId,
    growingSetup,
    location,
    cropOrPlant,
  };
}

export default resolveUserContext;
