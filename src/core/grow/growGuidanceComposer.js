/**
 * growGuidanceComposer.js — one structured view for "show me
 * everything for this crop" surfaces (MyFarm / MyGrow).
 *
 *   import { composeGrowGuidance }
 *     from 'src/core/grow/growGuidanceComposer.js';
 *
 *   const view = composeGrowGuidance({
 *     crop:         'tomato',
 *     country:      'Ghana',
 *     plantingDate: '2026-04-01',
 *     setting:      'raised_bed',
 *     mode:         'gardener',
 *   });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composition layer that calls three already-shipped
 *   engines — `growSetupGuidance` (sunlight / setting),
 *   `cropLifecycleEngine` (stage / harvest window / stage tasks /
 *   weather + scan adjustments), and `plantingWindowEngine`
 *   (region-aware planting window) — and folds them into ONE
 *   structured envelope MyFarm renders without re-orchestrating
 *   each engine itself.
 *
 *   It does NOT generate any new content, does NOT duplicate the
 *   engines' state, and does NOT make any forecast. Every visible
 *   string remains a `{ key, fallback, params }` envelope.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { getGrowSetupGuidance } from './growSetupGuidance.js';
import { computeLifecycleSnapshot } from '../lifecycle/cropLifecycleEngine.js';
import { getPlantingWindow } from '../lifecycle/plantingWindowEngine.js';

/**
 * Compose a MyFarm-friendly guidance view.
 *
 * @param {object} args
 * @param {string} args.crop
 * @param {string} [args.country]
 * @param {string|number|Date} [args.plantingDate]
 * @param {string} [args.setting]   'field' | 'container' | 'pot' | …
 * @param {string} [args.climate]   'hot_dry' | 'cool_wet' | …
 * @param {string} [args.mode]      'farmer' | 'gardener'
 * @param {object} [args.weather]
 * @param {Array}  [args.scanHistory]
 * @param {number} [args.nowMs]
 * @returns {object}
 */
export function composeGrowGuidance(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const crop = a.crop || null;
    if (!crop) {
      return Object.freeze({
        ok: false, reason: 'no_crop',
        disclaimer: 'Pick a crop or plant to see your guidance.',
      });
    }

    // 1. Setup guidance — sunlight + suitable settings.
    const setup = getGrowSetupGuidance(crop);

    // 2. Planting window — region-aware (or null when no country).
    let plantingWindow = null;
    if (a.country) {
      const w = getPlantingWindow({ country: a.country, crop, nowMs: a.nowMs });
      if (w && w.ok) plantingWindow = w;
    }

    // 3. Lifecycle snapshot — stage / harvest window / next-stage
    //    hint + stage tasks + weather + scan adjustments.
    const lifecycle = computeLifecycleSnapshot({
      crop,
      mode:         a.mode,
      plantingDate: a.plantingDate,
      weather:      a.weather,
      scanHistory:  a.scanHistory,
      climate:      a.climate,
      setting:      a.setting,
      nowMs:        a.nowMs,
    });

    return Object.freeze({
      ok:              true,
      crop,
      mode:            (lifecycle && lifecycle.mode) || 'gardener',
      setup,            // null OR { sunlight, settings, note, disclaimer, … }
      plantingWindow,   // null OR { earliest/latest months, why, … }
      lifecycle,        // { currentStage, harvestWindow, stageTasks,
                        //   weatherAdjustment, scanAdjustment, … }
      // The single primary call-to-action the surface should render
      // first — uses the lifecycle engine's nextStageHint when present.
      primaryHint: (lifecycle && lifecycle.nextStageHint) || null,
      disclaimer:  'Guidance is based on typical patterns — your local conditions may shift it.',
    });
  } catch {
    return Object.freeze({
      ok: false, reason: 'exception',
      disclaimer: 'We could not build guidance for this crop. Try again.',
    });
  }
}

const _module = { composeGrowGuidance };
export default _module;
