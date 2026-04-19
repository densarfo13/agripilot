/**
 * validateFastStep.js — one predicate per screen. Returns
 * `{ ok, reasons }` so the UI can surface which field blocks
 * advance. Rules are deliberately loose — the fast track
 * optimizes for speed, not completeness.
 */

import { FAST_STEPS } from './stepIds.js';

export function validateFastStep(step, state = {}) {
  const s = state || {};
  switch (step) {
    case FAST_STEPS.INTRO:
      // Advance requires that the intro was seen.
      return s.hasSeenIntro
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['intro_not_seen'] };

    case FAST_STEPS.SETUP: {
      const reasons = [];
      const setup = s.setup || {};
      if (!setup.language) reasons.push('missing_language');
      if (!setup.country)  reasons.push('missing_country');
      // Location is deliberately OPTIONAL — users can Continue
      // without detecting it. No check here.
      return reasons.length
        ? { ok: false, reasons }
        : { ok: true, reasons: [] };
    }

    case FAST_STEPS.FARMER_TYPE: {
      const ok = s.farmerType === 'new' || s.farmerType === 'existing';
      return ok
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_farmer_type'] };
    }

    case FAST_STEPS.FIRST_TIME_ENTRY:
      // No-field screen — always advances.
      return { ok: true, reasons: [] };

    case FAST_STEPS.RECOMMENDATION: {
      const ok = typeof s.selectedCrop === 'string' && s.selectedCrop.length > 0;
      return ok
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['missing_crop_selection'] };
    }

    case FAST_STEPS.TRANSITION:
      // Transition is a pass-through; the farm must be created.
      return s.farm?.created
        ? { ok: true, reasons: [] }
        : { ok: false, reasons: ['farm_not_created'] };

    default:
      return { ok: false, reasons: ['unknown_step'] };
  }
}

export function firstIncompleteFastStep(state = {}, stepOrder = []) {
  for (const step of stepOrder) {
    const r = validateFastStep(step, state);
    if (!r.ok) return step;
  }
  return null;
}
