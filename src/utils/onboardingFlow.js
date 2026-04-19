/**
 * onboardingFlow.js — validation-aware onboarding navigation.
 *
 * The onboarding page uses this as the single source of truth for:
 *   - the canonical step order (location → experience → farmType →
 *     farmSize → crops)
 *   - which step is *actually* complete (vs. merely visited)
 *   - where to go after a successful save
 *
 * Keeping this logic out of the page component makes it straight-
 * forward to test and to reuse from a "resume onboarding" banner.
 */

import { validateFarmProfile } from './validateFarmProfile.js';

export const ONBOARDING_STEPS = Object.freeze([
  'location',
  'experience',
  'farmType',
  'farmSize',
  'crops',
]);

/**
 * getStructuredLocation(raw) — return a {country, state, city?} blob
 * or null when the minimum required fields are missing. Accepts a
 * few shapes so both the onboarding form (which stores stateCode)
 * and the settings resolver (which stores state name) work.
 */
export function getStructuredLocation(raw = {}) {
  const loc = raw || {};
  const country = String(loc.country || '').trim().toUpperCase();
  const state = String(loc.stateCode || loc.state || '').trim();
  const city = typeof loc.city === 'string' && loc.city.trim() ? loc.city.trim() : null;
  if (!country || !state) return null;
  return { country, state, city };
}

/**
 * isStepValid(step, form) — true when the data captured for that
 * step passes the minimum-required checks. This is what the progress
 * bar counts, not raw step index.
 */
export function isStepValid(step, form = {}) {
  switch (step) {
    case 'location':
      return !!getStructuredLocation(form.location);
    case 'experience':
      return form.experience === 'new' || form.experience === 'experienced';
    case 'farmType':
      return ['backyard', 'small_farm', 'commercial'].includes(form.farmType);
    case 'farmSize':
      return !!(form.farmSize?.size) && ['small', 'medium', 'large'].includes(form.farmSize.size);
    case 'crops':
      return !!(form.pickedCrop?.crop);
    default:
      return false;
  }
}

/**
 * getOnboardingProgress(form) → { completed, total, percent, nextStep }
 * where `completed` is the count of *valid* steps and `nextStep` is
 * the first step that still fails validation.
 */
export function getOnboardingProgress(form = {}) {
  const total = ONBOARDING_STEPS.length;
  let completed = 0;
  let nextStep = ONBOARDING_STEPS[0];
  let foundNext = false;
  for (const step of ONBOARDING_STEPS) {
    if (isStepValid(step, form)) {
      completed += 1;
    } else if (!foundNext) {
      nextStep = step;
      foundNext = true;
    }
  }
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    nextStep: foundNext ? nextStep : null,
  };
}

/**
 * getNextOnboardingStep(currentStep, form) — the step the Next button
 * should advance to. Skips past steps that are already valid when the
 * user reopened onboarding mid-flow.
 */
export function getNextOnboardingStep(currentStep, form = {}) {
  const idx = ONBOARDING_STEPS.indexOf(currentStep);
  if (idx < 0 || idx === ONBOARDING_STEPS.length - 1) return null;
  for (let i = idx + 1; i < ONBOARDING_STEPS.length; i += 1) {
    const step = ONBOARDING_STEPS[i];
    if (!isStepValid(step, form)) return step;
    // Already valid — still return it so the user sees their answer,
    // but only if they didn't come here via resume.
    return step;
  }
  return null;
}

/**
 * buildPostSaveRoute(form, opts) — where to send the user after a
 * valid save. Defaults:
 *   - crop chosen + valid profile → '/crop-plan'
 *   - profile valid but no crop → '/today'
 *   - invalid (shouldn't save) → null
 *
 * Always returns a {path, state} object so `navigate(path, { state })`
 * carries the recommendation context into the next screen.
 */
export function buildPostSaveRoute(form = {}, opts = {}) {
  const profile = buildProfileForValidation(form);
  const validation = validateFarmProfile(profile);
  if (!validation.isValid) return null;

  const state = {
    onboardingContext: {
      location: getStructuredLocation(form.location),
      farmType: form.farmType,
      farmSize: form.farmSize,
      experience: form.experience,
      pickedCrop: form.pickedCrop || null,
      completedAt: new Date().toISOString(),
    },
    source: opts.source || 'onboarding',
  };

  if (form.pickedCrop?.crop) {
    return { path: opts.cropPlanPath || '/crop-plan', state };
  }
  return { path: opts.todayPath || '/today', state };
}

/**
 * buildProfileForValidation(form) — maps the onboarding form (which
 * splits farmSize into {size, unit, exactValue}) into the flat shape
 * validateFarmProfile expects. Exported for tests.
 */
export function buildProfileForValidation(form = {}) {
  const loc = getStructuredLocation(form.location) || {};
  const cropKey = form.pickedCrop?.crop || form.pickedCrop?.key || null;
  const farmType = form.farmType || null;
  // Backyard users are required to have a growingStyle by the server
  // validator; derive a sensible default from farmSize when the form
  // didn't capture one explicitly.
  const sizeBand = form.farmSize?.size;
  const defaultGrowingStyle = farmType === 'backyard'
    ? (sizeBand === 'small' ? 'raised_bed' : 'in_ground')
    : null;
  return {
    farmerName: form.farmerName || 'Farmer',
    farmName: form.farmName || 'My Farm',
    country: loc.country || null,
    stateCode: loc.state || null,
    city: loc.city || null,
    size: Number(form.farmSize?.exactValue) || defaultSize(sizeBand),
    sizeUnit: form.farmSize?.unit || 'acre',
    cropType: cropKey,
    farmType,
    experienceLevel: form.experience === 'new' ? 'beginner'
      : form.experience === 'experienced' ? 'experienced'
      : null,
    growingStyle: form.growingStyle || defaultGrowingStyle,
  };
}

function defaultSize(band) {
  if (band === 'small') return 0.25;
  if (band === 'medium') return 5;
  if (band === 'large') return 50;
  return 1;
}

export const _internal = { buildProfileForValidation, defaultSize };
