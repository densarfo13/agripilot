/**
 * editFarmMapper.js — pure data helpers for the standalone
 * Edit Farm flow. This file contains NO React and NO
 * onboarding imports. Importing anything from
 * src/utils/fastOnboarding/* or src/pages/onboarding/* here
 * would be a regression.
 *
 * Two public helpers:
 *
 *   farmToEditForm(farm)
 *     → form object used by the controlled inputs
 *     → NEVER returns null — always a valid (possibly empty) form
 *
 *   editFormToPatch(form, originalFarm)
 *     → payload for PATCH /api/v2/farm-profile/:id
 *     → includes ONLY fields the user actually changed
 *     → strips empty values so we don't overwrite good data with blanks
 *
 * Design rules enforced here (Section 7):
 *   • patch never contains `farmerType` — editing ≠ onboarding
 *   • patch never contains `onboardingCompleted` / `hasSeenIntro`
 *   • stage is only sent when the user changed it
 *   • empty strings become `undefined` (not null) so server doesn't
 *     clobber good data
 */

/** Fields the user can edit on this screen. Anything else is rejected. */
const EDITABLE_FIELDS = Object.freeze([
  'farmName', 'cropType', 'country', 'stateCode', 'location',
  'size', 'sizeUnit', 'cropStage', 'plantedAt', 'farmType',
]);

/** Fields the caller must NEVER send through the edit-farm patch. */
const FORBIDDEN_IN_PATCH = Object.freeze([
  'farmerType', 'onboardingCompleted', 'hasSeenIntro',
  'created', 'createdVia', 'onboardingPath',
]);

/**
 * farmToEditForm — project a farm record into the shape the
 * EditFarmScreen inputs bind to. Safe for null / partial data.
 */
export function farmToEditForm(farm = {}) {
  const f = (farm && typeof farm === 'object') ? farm : {};
  return {
    farmName:  f.farmName || '',
    cropType:  (f.cropType || f.crop || '').toString(),
    // Country is stored as ISO-2 code ('GH'). Legacy records may have
    // a label ('Ghana') — we leave those untouched here so the edit
    // screen can detect the drift and prompt a re-pick rather than
    // silently mapping a label we're not 100% sure about.
    country:   f.country || '',
    // New: structured subdivision code (e.g. 'AS' for Ashanti). Falls
    // back to farm.state for legacy records.
    stateCode: f.stateCode || f.state || '',
    // Free-text "location" is preserved for legacy records that
    // pre-date stateCode. New rows should leave this blank — the
    // dropdown writes stateCode instead.
    location:  f.location || f.locationLabel || '',
    size:      f.size != null ? String(f.size) : '',
    sizeUnit:  f.sizeUnit || (f.size ? 'ACRE' : 'ACRE'),
    cropStage: f.cropStage || f.stage || 'planning',
    plantedAt: f.plantedAt ? String(f.plantedAt).slice(0, 10) : '',
    // Farm type tiers downstream behaviour (task engine, alerts,
    // recommendations). Fallback to 'small_farm' keeps existing
    // farms working without a data migration.
    farmType:  f.farmType || 'small_farm',
  };
}

/**
 * Internal: compare edited value to original via the SAME mapper
 * projection. This avoids false-positive changes when the form has
 * a default (e.g. cropStage='planning') and the original record
 * never had that field set at all.
 */
function isChanged(form, original, field) {
  const originalForm = farmToEditForm(original);
  return String(form[field]) !== String(originalForm[field]);
}

/**
 * editFormToPatch — produce a minimal PATCH payload. Only
 * fields the user actually modified are included. Empty-string
 * fields are mapped to `undefined` so the server preserves
 * existing values.
 *
 * Section 7 guarantees: the returned object never carries
 * onboarding state. We assert this by construction — only
 * EDITABLE_FIELDS are ever added, and FORBIDDEN_IN_PATCH keys
 * are explicitly removed if something upstream tries to sneak
 * them in via form spread.
 */
export function editFormToPatch(form = {}, originalFarm = {}) {
  const safeForm     = form && typeof form === 'object' ? form : {};
  const safeOriginal = originalFarm && typeof originalFarm === 'object' ? originalFarm : {};
  const patch = {};

  for (const field of EDITABLE_FIELDS) {
    if (!isChanged(safeForm, safeOriginal, field)) continue;
    const raw = safeForm[field];
    if (field === 'size') {
      patch.size = raw === '' || raw == null ? undefined : Number(raw);
    } else if (field === 'plantedAt') {
      patch.plantedAt = raw ? new Date(raw).toISOString() : null;
    } else if (field === 'country') {
      // Country is an ISO-2 code from the dropdown. Upper-case it
      // on the wire so storage matches COUNTRIES in countriesStates.js.
      const v = typeof raw === 'string' ? raw.trim().toUpperCase() : raw;
      patch.country = v === '' || v == null ? undefined : v;
    } else if (field === 'stateCode') {
      // State codes come from getStatesForCountry() — preserve case
      // but strip whitespace. Empty → drop key so server keeps value.
      const v = typeof raw === 'string' ? raw.trim() : raw;
      patch.stateCode = v === '' || v == null ? undefined : v;
    } else if (field === 'cropType') {
      // Crop is always stored lower-cased ('maize', 'sweet_potato',
      // 'other'). The EditFarm input writes the normalized code so
      // this is mostly a safety net against legacy records.
      const v = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
      patch.cropType = v === '' || v == null ? undefined : v;
    } else {
      const v = typeof raw === 'string' ? raw.trim() : raw;
      // Empty strings → drop the key (server keeps existing value).
      patch[field] = v === '' || v == null ? undefined : v;
    }
  }

  // Belt-and-braces: never carry onboarding state through an edit.
  for (const key of FORBIDDEN_IN_PATCH) {
    if (key in patch) delete patch[key];
  }

  // Drop undefined keys so the caller sees a minimal payload.
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete patch[key];
  }

  return patch;
}

/** Did the user change anything? Used to enable/disable Save. */
export function hasAnyChange(form, originalFarm) {
  return Object.keys(editFormToPatch(form, originalFarm)).length > 0;
}

/**
 * classifyFarmChanges — describe WHAT changed so downstream
 * code can decide what to recompute. Each flag maps to the
 * rules in §8 of the edit-farm spec.
 *
 * Returns a frozen object:
 *   {
 *     cropChanged:     boolean  — re-run task engine for new crop
 *     locationChanged: boolean  — recompute region + weather
 *     sizeChanged:     boolean  — analytics only, no task restart
 *     stageChanged:    boolean  — re-resolve active task
 *     nameChanged:     boolean  — cosmetic; no recompute
 *     plantedAtChanged:boolean  — stage-derived task restart
 *     types:           string[] — enum of changed buckets
 *     hasChanges:      boolean  — at least one flag is true
 *   }
 */
export function classifyFarmChanges(form = {}, originalFarm = {}) {
  const patch = editFormToPatch(form, originalFarm);
  const keys = new Set(Object.keys(patch));

  const cropChanged     = keys.has('cropType');
  const locationChanged = keys.has('country') || keys.has('location');
  const sizeChanged     = keys.has('size') || keys.has('sizeUnit');
  const stageChanged    = keys.has('cropStage');
  const nameChanged     = keys.has('farmName');
  const plantedAtChanged = keys.has('plantedAt');

  const types = [];
  if (cropChanged)      types.push('crop');
  if (locationChanged)  types.push('location');
  if (sizeChanged)      types.push('size');
  if (stageChanged)     types.push('stage');
  if (nameChanged)      types.push('name');
  if (plantedAtChanged) types.push('plantedAt');

  return Object.freeze({
    cropChanged, locationChanged, sizeChanged, stageChanged,
    nameChanged, plantedAtChanged,
    types,
    hasChanges: types.length > 0,
  });
}

/**
 * Simple field-level validator. Returns a map of fieldName → errorKey.
 *
 * Required (by spec §3):
 *   • farmName — blocks save (existing rule)
 *   • country  — blocks save (new: dropdown value must be picked)
 *   • cropType — blocks save (new: chip or Other name must be set)
 *
 * Size is only flagged when negative; empty size is allowed (the
 * farmer may not know the size yet — we don't want to block edits
 * behind a number they'd have to guess).
 */
export function validateEditForm(form = {}) {
  const errors = {};
  if (!form || typeof form !== 'object') {
    errors.farmName = 'farm.editFarm.farmNameRequired';
    return errors;
  }
  if (!form.farmName || !String(form.farmName).trim()) {
    errors.farmName = 'farm.editFarm.farmNameRequired';
  }
  if (!form.country || !String(form.country).trim()) {
    errors.country = 'farm.editFarm.countryRequired';
  }
  if (!form.cropType || !String(form.cropType).trim()) {
    errors.cropType = 'farm.editFarm.cropRequired';
  }
  if (form.size !== '' && form.size != null && Number(form.size) < 0) {
    errors.size = 'farm.editFarm.sizeNegative';
  }
  return errors;
}

export const _internal = { EDITABLE_FIELDS, FORBIDDEN_IN_PATCH };
