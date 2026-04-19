/**
 * validateOnboardingStep.js — pure, per-step validation.
 * Returns `{ ok, reasons }` so the flow controller can decide
 * whether to advance AND the UI can surface exactly which field
 * to fix.
 *
 * Design rules:
 *   • each step is independent — no cross-step peeking except
 *     where the spec explicitly branches (size_details depends
 *     on growingType to know which sub-validation to run)
 *   • validators NEVER throw; invalid input → `{ ok: false, reasons: [...] }`
 *   • the welcome step is always valid once language is set
 *   • first_value is always valid (it's the end)
 */

import { ONBOARDING_STEPS } from './stepIds.js';

export function validateOnboardingStep(step, state = {}) {
  const s = state || {};
  switch (step) {
    case ONBOARDING_STEPS.WELCOME:
      return s.language
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_language'] };

    case ONBOARDING_STEPS.LOCATION: {
      const loc = s.location || {};
      const reasons = [];
      if (!loc.country)    reasons.push('missing_country');
      if (!loc.confirmed && loc.source !== 'manual')
        reasons.push('location_not_confirmed');
      return reasons.length
        ? { ok: false, reasons }
        : { ok: true, reasons: [] };
    }

    case ONBOARDING_STEPS.GROWING_TYPE: {
      const ok = ['backyard', 'small', 'medium', 'large']
        .includes(String(s.growingType || ''));
      return ok
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_growing_type'] };
    }

    case ONBOARDING_STEPS.EXPERIENCE: {
      const ok = ['new', 'experienced'].includes(String(s.experience || ''));
      return ok
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_experience'] };
    }

    case ONBOARDING_STEPS.SIZE_DETAILS: {
      const details = s.sizeDetails || {};
      if (s.mode === 'backyard') {
        const ok = ['pots', 'raised_bed', 'backyard_soil']
          .includes(String(details.spaceType || ''));
        return ok
          ? { ok: true, reasons: [] }
          : { ok: false, reasons: ['missing_space_type'] };
      }
      // farm
      const ok = ['small', 'medium', 'large']
        .includes(String(details.sizeBand || ''));
      return ok
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_size_band'] };
    }

    case ONBOARDING_STEPS.RECOMMENDATIONS:
      // Recommendations screen is a read step — as soon as it's
      // rendered, we can advance. Leave validation permissive.
      return { ok: true, reasons: [] };

    case ONBOARDING_STEPS.CROP_CONFIRM: {
      const ok = !!s.selectedCrop && typeof s.selectedCrop === 'string';
      return ok
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_crop_selection'] };
    }

    case ONBOARDING_STEPS.FIRST_VALUE:
      return { ok: true, reasons: [] };

    default:
      return { ok: false, reasons: ['unknown_step'] };
  }
}

/** Walks the full state and returns the first step that fails. */
export function firstIncompleteStep(state = {}, stepOrder = []) {
  for (const step of stepOrder) {
    const r = validateOnboardingStep(step, state);
    if (!r.ok) return step;
  }
  return null;
}
