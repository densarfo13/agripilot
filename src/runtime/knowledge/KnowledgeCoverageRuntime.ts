/**
 * src/runtime/knowledge/KnowledgeCoverageRuntime.ts — wave-23
 * read-only probe over Farroway's seeded content libraries.
 *
 *   window.__knowledgeCoverageHealth()
 *
 * Wave-23 envelope (supersedes the wave-39 stronger envelope; the
 * runtime now reports BOTH targets so internal consoles can show
 * the launch warning AND the stronger recommended target).
 *
 *   {
 *     plants, flowers, crops, diseases, pests,
 *     targetPlants:   200,
 *     targetFlowers:  50,
 *     targetDiseases: 15,
 *     targetPests:    15,
 *     // Stronger recommended target — informational only.
 *     recommendedTargets: {
 *       plants: 250, flowers: 50, diseases: 30, pests: 30,
 *     },
 *     coveragePercent,
 *     launchWarning,
 *     atOrAboveLaunchTarget,
 *     atOrAboveRecommendedTarget,
 *     gaps: { plants, flowers, diseases, pests },
 *   }
 *
 * Rules
 *   • Never fake counts. Reads only the canonical library exports.
 *   • Warn-only — launchWarning fires when ANY count is below the
 *     minimum target. Never blocks consumer pilot per wave-23 §4.
 *   • Single window global: __knowledgeCoverageHealth. Idempotent.
 *
 * Strict-rule audit
 *   • Pure composition over library imports. SSR-safe.
 *   • Frozen envelope. Never throws.
 */

import { VEGETABLE_LIBRARY }  from '../plants/media/libraries/vegetableLibrary';
import { FRUIT_LIBRARY }      from '../plants/media/libraries/fruitLibrary';
import { HERB_LIBRARY }       from '../plants/media/libraries/herbLibrary';
import { CROP_LIBRARY }       from '../plants/media/libraries/cropLibrary';
import { HOUSEPLANT_LIBRARY } from '../plants/media/libraries/houseplantLibrary';
import { FLOWER_LIBRARY }     from '../plants/media/libraries/flowerLibrary';
import { DISEASE_LIBRARY }    from '../plants/media/libraries/diseaseLibrary';
import { PEST_LIBRARY }       from '../plants/media/libraries/pestLibrary';

export const KNOWLEDGE_COVERAGE_RUNTIME_VERSION = 'knowledge-coverage-v2';

/** Wave-23 minimum GREEN target. */
export const LAUNCH_TARGETS = Object.freeze({
  plants:   200,
  flowers:  50,
  diseases: 15,
  pests:    15,
} as const);

/** Wave-23 stronger recommended target — informational. */
export const RECOMMENDED_TARGETS = Object.freeze({
  plants:   250,
  flowers:  50,
  diseases: 30,
  pests:    30,
} as const);

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _len(lib: any): number {
  return _safe(() => Array.isArray(lib) ? lib.length : 0, 0);
}

function _pct(actual: number, target: number): number {
  return _safe(() => {
    if (!Number.isFinite(target) || target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((actual / target) * 100)));
  }, 0);
}

export interface KnowledgeCoverageHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  plants:                   number;
  flowers:                  number;
  crops:                    number;
  diseases:                 number;
  pests:                    number;
  targetPlants:             number;
  targetFlowers:            number;
  targetDiseases:           number;
  targetPests:              number;
  recommendedTargets: Readonly<{
    plants:   number;
    flowers:  number;
    diseases: number;
    pests:    number;
  }>;
  coveragePercent:          number;
  launchWarning:            boolean;
  atOrAboveLaunchTarget:    boolean;
  atOrAboveRecommendedTarget: boolean;
  gaps: Readonly<{
    plants:   number;
    flowers:  number;
    diseases: number;
    pests:    number;
  }>;
}

export function knowledgeCoverageHealth(): KnowledgeCoverageHealth {
  return _safe(() => {
    // `crops` is the CROP_LIBRARY count — kept distinct from the
    // composite `plants` total per wave-23 envelope shape.
    const crops      = _len(CROP_LIBRARY);
    // Composite plants total: vegetables + fruits + herbs + crops
    // + houseplants. Flowers are tracked separately by wave-23.
    const plants     = _len(VEGETABLE_LIBRARY)
                     + _len(FRUIT_LIBRARY)
                     + _len(HERB_LIBRARY)
                     + crops
                     + _len(HOUSEPLANT_LIBRARY);
    const flowers    = _len(FLOWER_LIBRARY);
    const diseases   = _len(DISEASE_LIBRARY);
    const pests      = _len(PEST_LIBRARY);

    const pP = _pct(plants,   LAUNCH_TARGETS.plants);
    const pF = _pct(flowers,  LAUNCH_TARGETS.flowers);
    const pD = _pct(diseases, LAUNCH_TARGETS.diseases);
    const pX = _pct(pests,    LAUNCH_TARGETS.pests);
    const coveragePercent = Math.round((pP + pF + pD + pX) / 4);

    const atOrAboveLaunchTarget =
         plants   >= LAUNCH_TARGETS.plants
      && flowers  >= LAUNCH_TARGETS.flowers
      && diseases >= LAUNCH_TARGETS.diseases
      && pests    >= LAUNCH_TARGETS.pests;
    const atOrAboveRecommendedTarget =
         plants   >= RECOMMENDED_TARGETS.plants
      && flowers  >= RECOMMENDED_TARGETS.flowers
      && diseases >= RECOMMENDED_TARGETS.diseases
      && pests    >= RECOMMENDED_TARGETS.pests;
    const launchWarning = !atOrAboveLaunchTarget;

    return Object.freeze({
      runtimeVersion:           KNOWLEDGE_COVERAGE_RUNTIME_VERSION,
      initialized:              true,
      plants, flowers, crops, diseases, pests,
      targetPlants:             LAUNCH_TARGETS.plants,
      targetFlowers:            LAUNCH_TARGETS.flowers,
      targetDiseases:           LAUNCH_TARGETS.diseases,
      targetPests:              LAUNCH_TARGETS.pests,
      recommendedTargets:       RECOMMENDED_TARGETS,
      coveragePercent,
      launchWarning,
      atOrAboveLaunchTarget,
      atOrAboveRecommendedTarget,
      gaps: Object.freeze({
        plants:   Math.max(0, LAUNCH_TARGETS.plants   - plants),
        flowers:  Math.max(0, LAUNCH_TARGETS.flowers  - flowers),
        diseases: Math.max(0, LAUNCH_TARGETS.diseases - diseases),
        pests:    Math.max(0, LAUNCH_TARGETS.pests    - pests),
      }),
    });
  }, Object.freeze({
    runtimeVersion:           KNOWLEDGE_COVERAGE_RUNTIME_VERSION,
    initialized:              false,
    plants: 0, flowers: 0, crops: 0, diseases: 0, pests: 0,
    targetPlants:             LAUNCH_TARGETS.plants,
    targetFlowers:            LAUNCH_TARGETS.flowers,
    targetDiseases:           LAUNCH_TARGETS.diseases,
    targetPests:              LAUNCH_TARGETS.pests,
    recommendedTargets:       RECOMMENDED_TARGETS,
    coveragePercent:          0,
    launchWarning:            true,
    atOrAboveLaunchTarget:    false,
    atOrAboveRecommendedTarget: false,
    gaps: Object.freeze({
      plants:   LAUNCH_TARGETS.plants,
      flowers:  LAUNCH_TARGETS.flowers,
      diseases: LAUNCH_TARGETS.diseases,
      pests:    LAUNCH_TARGETS.pests,
    }),
  }));
}

/**
 * installKnowledgeCoverageGlobal — installs / OVERRIDES the
 * __knowledgeCoverageHealth global. Wave-39's adoption-tier
 * runtime previously installed a stronger-target envelope; the
 * wave-23 envelope is the official launch contract and replaces
 * it. Idempotent across multiple boots.
 */
export function installKnowledgeCoverageGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    // Wave-23 overrides any previous installer to land the
    // launch-target envelope shape at the canonical global.
    w.__knowledgeCoverageHealth = function () {
      const out = knowledgeCoverageHealth();
      try { console.log('[Farroway · Knowledge Coverage]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}
