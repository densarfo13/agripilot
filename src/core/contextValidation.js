/**
 * contextValidation.js — pre-save validation + auto-correction for
 * garden / farm context. Spec: "Fix Farroway Data Model Properly",
 * §3 + §5 + §8.
 *
 *   import { validateGrowingContext } from '../core/contextValidation.js';
 *
 *   const result = validateGrowingContext({
 *     activeExperience: 'farm',
 *     exactSize: 4_356_000, unit: 'sqft',
 *     farmType:  'backyard',
 *   });
 *   // → {
 *   //     ok: true,
 *   //     blocking: [],
 *   //     warnings: [
 *   //       { code: 'LARGE_SQFT_LIKELY_ACRES',
 *   //         message: 'This looks large for square feet. Did you mean acres?' },
 *   //       { code: 'LARGE_NEEDS_CONFIRMATION',
 *   //         message: 'This equals about 100 acres. We\u2019ll treat this as a large farm.' },
 *   //     ],
 *   //     autoCorrect: { farmType: 'large_farm' },
 *   //     normalized:  { value: 4356000, unit: 'sqft',
 *   //                    sizeInAcres: 100, sizeInSqFt: 4356000 },
 *   //     autoFarmClass: 'large_farm',
 *   //   }
 *
 *   const bad = validateGrowingContext({
 *     activeExperience: 'farm', exactSize: 0, unit: 'acres',
 *   });
 *   // → { ok: false, blocking: [{ code: 'NON_POSITIVE', … }], … }
 *
 * What this layer does (and does NOT do)
 * ──────────────────────────────────────
 *   ✓ Returns BLOCKING errors that must abort save
 *     (NaN, exactSize <= 0, missing unit when size present).
 *   ✓ Returns WARNINGS the UI surfaces but doesn't block on
 *     (large garden → "Did you mean farm?"; large sqft → "Did
 *     you mean acres?"; very large sizes need confirmation).
 *   ✓ Returns AUTO-CORRECT instructions the caller applies to its
 *     payload before saving (spec §3 last bullet — reclassify a
 *     mis-tagged backyard row when sizeInAcres >= 1).
 *   ✓ Always returns the normalised size shape on success so the
 *     caller doesn't have to call unitUtils.normalizeSizeInput
 *     twice.
 *   ✗ Does NOT touch storage. The caller wraps the save: read
 *     result, apply autoCorrect, persist.
 *   ✗ Does NOT decide UI. Returns codes; the UI maps to copy.
 *
 * Strict-rule audit
 *   • Pure function. No I/O, no side effects.
 *   • Never throws. All paths produce a result object.
 *   • Idempotent. Two calls with the same input return identical
 *     blocking / warning / autoCorrect arrays.
 */

import { normalizeSizeInput } from './unitUtils.js';
import {
  classifyGrowingContext,
} from './farmClassifier.js';

/**
 * Spec §3 — "extremely large" trigger. We warn (with a "treat as
 * large farm" message) on anything above this. The threshold is
 * deliberately generous; legitimate enterprise farms can exceed
 * 1000 acres and we don't want to false-positive-block them.
 *
 * Spec §3 also asks for a "warn but allow only after confirmation"
 * gate at this size. The validator returns the warning + a
 * `requiresConfirmation: true` flag; the UI is responsible for the
 * actual confirmation modal.
 */
export const EXTREME_SIZE_ACRES = 1000;

/**
 * Spec §3 — square-feet sanity threshold. Above 100,000 sq ft
 * (~2.3 acres) the user almost certainly meant acres. We surface a
 * warning, NOT a block — a community garden could legitimately use
 * sq ft up to several thousand.
 */
export const LARGE_SQFT_THRESHOLD = 100_000;

/**
 * Spec §3 — garden-vs-farm sanity threshold. If the active
 * experience is "garden" but the unit is acres / hectares and
 * exactSize converts to > 1 acre, the user probably meant farm.
 * We warn but don't block — a half-acre community garden is a
 * legitimate edge case.
 */
export const LARGE_GARDEN_ACRES = 1;

/**
 * validateGrowingContext(context) → result object.
 *
 * Input shape (every field optional except activeExperience):
 *   {
 *     activeExperience: 'garden' | 'farm',
 *     exactSize:        number | string | null,
 *     unit:             string | null,
 *     farmType:         string | null,        // legacy 'backyard' / 'small_farm' / etc.
 *     growingSetup:     string | null,        // garden-only
 *     skipConfirmation: boolean,              // when the UI has already
 *                                             // confirmed an extreme size
 *   }
 *
 * Output shape:
 *   {
 *     ok:            boolean,                 // false ⇔ blocking.length > 0
 *     blocking:      Array<{code,message}>,
 *     warnings:      Array<{code,message,requiresConfirmation?}>,
 *     autoCorrect:   { farmType?, autoFarmClass? },  // patch the caller applies
 *     normalized:    null | {value,unit,sizeInAcres,sizeInSqFt},
 *     autoFarmClass: 'garden'|'small_farm'|'medium_farm'|'large_farm'|'unknown_farm',
 *   }
 *
 * Empty exactSize is allowed — the user might be saving with only
 * a category bucket. In that case `normalized` is null and the
 * autoFarmClass falls through to 'unknown_farm' (farm) or 'garden'
 * (garden).
 */
export function validateGrowingContext(context = {}) {
  const ctx     = (context && typeof context === 'object') ? context : {};
  const exp     = String(ctx.activeExperience || '').toLowerCase();
  const isGarden = exp === 'garden';

  const blocking    = [];
  const warnings    = [];
  const autoCorrect = {};

  // ── 1. Size validation ───────────────────────────────────────
  // Empty size: skip the numeric checks; size is optional when the
  // caller is saving a category bucket only.
  let normalized = null;
  const hasSize  = ctx.exactSize !== '' && ctx.exactSize != null;
  if (hasSize) {
    const norm = normalizeSizeInput(ctx.exactSize, ctx.unit);
    if (!norm.ok) {
      // Map the unitUtils error codes onto user-visible copy.
      // Spec §3: NaN + non-positive must BLOCK save.
      switch (norm.error) {
        case 'NAN':
          blocking.push({
            code:    'NAN',
            message: 'Size must be a number.',
          });
          break;
        case 'NON_POSITIVE':
          blocking.push({
            code:    'NON_POSITIVE',
            message: 'Size must be greater than zero.',
          });
          break;
        case 'UNKNOWN_UNIT':
          blocking.push({
            code:    'UNKNOWN_UNIT',
            message: 'Pick a size unit before saving.',
          });
          break;
        case 'EMPTY':
          // Defensive — hasSize gated this branch out, but if a
          // caller passes exactSize=0 explicitly the normalizer
          // can also return EMPTY. Coerce to NON_POSITIVE so the
          // user sees a meaningful blocking message.
          blocking.push({
            code:    'NON_POSITIVE',
            message: 'Size must be greater than zero.',
          });
          break;
        default:
          blocking.push({
            code:    'INVALID_SIZE',
            message: 'Size value is not valid.',
          });
      }
    } else {
      normalized = {
        value:       norm.value,
        unit:        norm.unit,
        sizeInAcres: norm.sizeInAcres,
        sizeInSqFt:  norm.sizeInSqFt,
      };
    }
  }

  // ── 2. Cross-field warnings ──────────────────────────────────
  // Only run when we have a normalised size to compare against —
  // a missing size already tripped the optional bucket-only path.
  if (normalized) {
    const { unit, sizeInAcres, sizeInSqFt } = normalized;

    // §3 — "This looks large for a garden. Did you mean farm?"
    // Triggers when garden + land-area unit + > 1 acre.
    if (isGarden
        && (unit === 'acres' || unit === 'hectares')
        && sizeInAcres > LARGE_GARDEN_ACRES) {
      warnings.push({
        code:    'LARGE_FOR_GARDEN',
        message: 'This looks large for a garden. Did you mean farm?',
      });
    }

    // §3 — "This looks large for square feet. Did you mean acres?"
    // Farm-only (gardens commonly use sqft for raised beds).
    if (!isGarden
        && unit === 'sqft'
        && sizeInSqFt > LARGE_SQFT_THRESHOLD) {
      warnings.push({
        code:    'LARGE_SQFT_LIKELY_ACRES',
        message: 'This looks large for square feet. Did you mean acres?',
      });
    }

    // §3 — "extremely large" → warn + require confirmation. We
    // emit the spec's exact copy ("This equals about N acres. We'll
    // treat this as a large farm.") so the UI can render verbatim.
    if (!isGarden && sizeInAcres > EXTREME_SIZE_ACRES) {
      const acresWhole = Math.round(sizeInAcres);
      warnings.push({
        code:                 'LARGE_NEEDS_CONFIRMATION',
        message:              `This equals about ${acresWhole} acres. We\u2019ll treat this as a large farm.`,
        requiresConfirmation: !ctx.skipConfirmation,
      });
    }
  }

  // ── 3. Auto-correct stale farmType ───────────────────────────
  // Spec §3: "if farmType selected = backyard/home but
  // sizeInAcres >= 1: auto-correct to farm classification".
  // We don't mutate the caller's input — we return a patch they
  // apply to the payload before persisting.
  const autoFarmClass = classifyGrowingContext({
    activeExperience: isGarden ? 'garden' : 'farm',
    sizeInAcres:      normalized ? normalized.sizeInAcres : null,
    growingSetup:     ctx.growingSetup,
  });

  const ftLower = String(ctx.farmType || '').toLowerCase();
  const isBackyardLike = (ftLower === 'backyard'
                       || ftLower === 'home'
                       || ftLower === 'home_garden');
  if (!isGarden && isBackyardLike
      && normalized && normalized.sizeInAcres >= 1) {
    // The row is mis-tagged. Reclassify it onto the size-derived
    // class. The caller writes the new farmType + the matching
    // autoFarmClass field.
    autoCorrect.farmType      = autoFarmClass;
    autoCorrect.autoFarmClass = autoFarmClass;
  } else {
    // No mis-tag — but we still hand back the autoFarmClass so the
    // caller can write it onto the row in one place.
    autoCorrect.autoFarmClass = autoFarmClass;
  }

  // §5 — explicit guard: even with no size, never let a 'farm'
  // experience save with a backyard farmType. Promote to the
  // unknown_farm tier so the row stays in the farms partition and
  // the engine doesn't read a backyard task list.
  if (!isGarden && isBackyardLike && !normalized) {
    autoCorrect.farmType      = 'unknown_farm';
    autoCorrect.autoFarmClass = 'unknown_farm';
  }

  return {
    ok:           blocking.length === 0,
    blocking,
    warnings,
    autoCorrect,
    normalized,
    autoFarmClass,
  };
}

export default {
  validateGrowingContext,
  EXTREME_SIZE_ACRES,
  LARGE_SQFT_THRESHOLD,
  LARGE_GARDEN_ACRES,
};
