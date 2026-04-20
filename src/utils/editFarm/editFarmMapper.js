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
  'farmName', 'cropType', 'country', 'location',
  'size', 'sizeUnit', 'cropStage', 'plantedAt',
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
    country:   f.country || '',
    location:  f.location || f.locationLabel || '',
    size:      f.size != null ? String(f.size) : '',
    sizeUnit:  f.sizeUnit || (f.size ? 'ACRE' : 'ACRE'),
    cropStage: f.cropStage || f.stage || 'planning',
    plantedAt: f.plantedAt ? String(f.plantedAt).slice(0, 10) : '',
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

/** Simple field-level validator. Returns a map of fieldName → errorKey. */
export function validateEditForm(form = {}) {
  const errors = {};
  if (!form || typeof form !== 'object') {
    errors.farmName = 'farm.editFarm.farmNameRequired';
    return errors;
  }
  if (!form.farmName || !String(form.farmName).trim()) {
    errors.farmName = 'farm.editFarm.farmNameRequired';
  }
  if (form.size !== '' && form.size != null && Number(form.size) < 0) {
    errors.size = 'farm.editFarm.sizeNegative';
  }
  return errors;
}

export const _internal = { EDITABLE_FIELDS, FORBIDDEN_IN_PATCH };
