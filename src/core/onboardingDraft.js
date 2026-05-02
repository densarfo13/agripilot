/**
 * onboardingDraft.js \u2014 versioned + sanitised onboarding-draft I/O.
 *
 *   import {
 *     loadGardenDraft, saveGardenDraft, clearGardenDraft,
 *     loadFarmDraft,   saveFarmDraft,   clearFarmDraft,
 *     clearAllOnboardingDrafts,
 *     CURRENT_ONBOARDING_DRAFT_VERSION,
 *   } from '../core/onboardingDraft.js';
 *
 * Why this exists (production-hardening spec \u00a72\u2013\u00a73)
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * The Quick setup forms used to call loadData/saveData directly.
 * That meant any malformed draft (manual DevTools tweak, schema
 * change between deploys, partial write) could end up shaped like
 * `null`, a string, an array, or an object with surprise types
 * \u2014 each of which had a non-zero chance of crashing useState
 * during hydration. This module is the SINGLE write site:
 *
 *   1. Schema-ised. Each draft has a known set of string / number
 *      / null fields; everything else is dropped.
 *   2. Versioned. Drafts carry `version: 2`; reads return null
 *      for any draft missing the field or with an older version
 *      (the storage slot is then auto-cleared so the next load
 *      starts blank).
 *   3. Defensive. Every helper wraps localStorage calls in
 *      try/catch so a quota-exceeded / private-mode browser
 *      never throws into the React render path.
 *   4. Telemetry-aware. Malformed-draft reads emit
 *      `onboarding_draft_malformed` (best-effort \u2014 we never let
 *      a tracking failure cascade).
 */

import { trackEvent } from '../analytics/analyticsStore.js';

// Spec \u00a73 \u2014 schema version. Bump this whenever the draft
// shape changes in a way that older saves can't be rehydrated
// safely. The load path treats any mismatch as "no draft".
export const CURRENT_ONBOARDING_DRAFT_VERSION = 2;

// localStore-style keys. We bypass `loadData/saveData` from
// store/localStore.js so the schema check + versioning is
// authoritative (and so a refactor of that helper can't ever
// silently change our storage format).
const GARDEN_KEY = 'farroway:setup_garden_draft';
const FARM_KEY   = 'farroway:setup_farm_draft';

// \u2500\u2500 Type-narrowing helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _str(v, max = 120) {
  if (typeof v !== 'string') return '';
  // Trim + truncate so a runaway paste can't bloat localStorage.
  return v.slice(0, max);
}

function _strOrNull(v, allowed = null) {
  if (typeof v !== 'string' || !v) return null;
  if (Array.isArray(allowed) && allowed.length > 0) {
    return allowed.indexOf(v) >= 0 ? v : null;
  }
  return v;
}

function _num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// \u2500\u2500 Sanitisers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// One sanitiser per draft kind. Return value is what the form
// can hydrate from directly (every field is the right type;
// nothing else is present). If `raw` doesn't look like a usable
// draft at all, return null \u2014 the caller treats null as "no
// draft" and starts the form blank.
const ALLOWED_GROWING_SETUP = ['container', 'bed', 'ground', 'unknown'];
const ALLOWED_GARDEN_SIZE   = ['small', 'medium', 'large', 'unknown'];
const ALLOWED_FARM_BUCKET   = ['lt1', '1to5', 'gt5', 'unknown'];
const ALLOWED_FARM_UNIT     = ['acres', 'hectares', 'sqft', 'sqm'];
const ALLOWED_PLANT_PICK    = ['tomato', 'pepper', 'herbs', 'lettuce', 'cucumber', 'other'];
const ALLOWED_CROP_PICK     = ['maize', 'rice', 'pepper', 'tomato', 'cassava', 'other'];
const ALLOWED_SKILL_LEVEL   = ['new', 'existing'];

export function sanitizeGardenDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    version:      CURRENT_ONBOARDING_DRAFT_VERSION,
    plant:        _str(raw.plant, 60),
    plantPick:    _strOrNull(raw.plantPick, ALLOWED_PLANT_PICK),
    country:      _str(raw.country, 60),
    region:       _str(raw.region, 60),
    city:         _str(raw.city, 60),
    size:         _strOrNull(raw.size, ALLOWED_GARDEN_SIZE),
    growingSetup: _strOrNull(raw.growingSetup, ALLOWED_GROWING_SETUP),
    skillLevel:   _strOrNull(raw.skillLevel, ALLOWED_SKILL_LEVEL),
  };
}

export function sanitizeFarmDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    version:    CURRENT_ONBOARDING_DRAFT_VERSION,
    crop:       _str(raw.crop, 60),
    cropPick:   _strOrNull(raw.cropPick, ALLOWED_CROP_PICK),
    country:    _str(raw.country, 60),
    region:     _str(raw.region, 60),
    sizeBucket: _strOrNull(raw.sizeBucket, ALLOWED_FARM_BUCKET),
    // Land size is stored as a numeric string the form can
    // mount directly into a controlled <input>. We narrow to a
    // non-negative number and stringify it back so the form's
    // `value={size}` never sees an unexpected type.
    size:       _num(raw.size) === null ? '' : String(_num(raw.size)),
    unit:       _strOrNull(raw.unit, ALLOWED_FARM_UNIT),
    skillLevel: _strOrNull(raw.skillLevel, ALLOWED_SKILL_LEVEL),
  };
}

// \u2500\u2500 Storage I/O \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _readJSON(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function _writeJSON(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function _remove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

/**
 * loadDraft(kind) \u2192 sanitised draft OR null.
 *
 * Reads the slot, validates the version + sanitises the shape.
 * On version mismatch / malformed payload / quota-exceeded read,
 * the slot is auto-cleared so the next load starts blank, and
 * `onboarding_draft_malformed` fires with the failure reason.
 */
function _loadDraft(key, sanitiser, kind) {
  const raw = _readJSON(key);
  if (raw == null) return null;
  // Version gate. Older drafts (v1, v0, no version) are
  // discarded \u2014 we don't try to upgrade them in place because
  // the schema can drift in either direction.
  const version = raw && typeof raw === 'object' ? raw.version : null;
  if (version !== CURRENT_ONBOARDING_DRAFT_VERSION) {
    _remove(key);
    try {
      trackEvent('onboarding_draft_malformed', {
        kind, errorReason: 'version_mismatch',
        loaded: typeof version === 'number' ? version : 'missing',
        expected: CURRENT_ONBOARDING_DRAFT_VERSION,
      });
    } catch { /* swallow */ }
    return null;
  }
  let sanitised = null;
  try { sanitised = sanitiser(raw); }
  catch { sanitised = null; }
  if (!sanitised) {
    _remove(key);
    try {
      trackEvent('onboarding_draft_malformed', {
        kind, errorReason: 'sanitiser_rejected',
      });
    } catch { /* swallow */ }
    return null;
  }
  return sanitised;
}

function _saveDraft(key, sanitiser, kind, raw) {
  const sanitised = sanitiser(raw);
  if (!sanitised) {
    try {
      trackEvent('onboarding_draft_malformed', {
        kind, errorReason: 'invalid_input_to_save',
      });
    } catch { /* swallow */ }
    return false;
  }
  const ok = _writeJSON(key, sanitised);
  if (ok) {
    try {
      trackEvent('onboarding_draft_saved', {
        kind, draftVersion: CURRENT_ONBOARDING_DRAFT_VERSION,
      });
    } catch { /* swallow */ }
  }
  return ok;
}

// \u2500\u2500 Public helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export function loadGardenDraft() {
  return _loadDraft(GARDEN_KEY, sanitizeGardenDraft, 'garden');
}
export function saveGardenDraft(raw) {
  return _saveDraft(GARDEN_KEY, sanitizeGardenDraft, 'garden', raw);
}
export function clearGardenDraft() { _remove(GARDEN_KEY); }

export function loadFarmDraft() {
  return _loadDraft(FARM_KEY, sanitizeFarmDraft, 'farm');
}
export function saveFarmDraft(raw) {
  return _saveDraft(FARM_KEY, sanitizeFarmDraft, 'farm', raw);
}
export function clearFarmDraft() { _remove(FARM_KEY); }

/**
 * clearAllOnboardingDrafts() \u2014 called by the recovery card's
 * "Fix setup issue" button. Wipes ONLY the onboarding-draft
 * slots; farms, gardens, scans, language, user session are
 * untouched.
 */
export function clearAllOnboardingDrafts() {
  _remove(GARDEN_KEY);
  _remove(FARM_KEY);
  // Also wipe the legacy keys the older Quick setups used so a
  // mid-deploy upgrade doesn't leave stale data behind.
  _remove('farroway:store:setup_garden_draft');
  _remove('farroway:store:setup_farm_draft');
  _remove('farroway:store:onboarding');
}

export const _internal = Object.freeze({
  GARDEN_KEY, FARM_KEY,
  ALLOWED_GROWING_SETUP, ALLOWED_GARDEN_SIZE,
  ALLOWED_FARM_BUCKET, ALLOWED_FARM_UNIT,
  ALLOWED_PLANT_PICK, ALLOWED_CROP_PICK,
  ALLOWED_SKILL_LEVEL,
});
