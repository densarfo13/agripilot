/**
 * src/runtime/adoption/KnowledgeCoverageHealthRuntime.ts — wave-39
 * read-only probe over the seeded content libraries.
 *
 *   import { knowledgeCoverageHealth, installKnowledgeCoverageHealthGlobal }
 *     from 'src/runtime/adoption/KnowledgeCoverageHealthRuntime';
 *
 *   window.__knowledgeCoverageHealth()
 *
 * What this probes
 * ────────────────
 *   • plants    — sum of vegetable + fruit + herb + crop + houseplant
 *   • flowers   — FLOWER_LIBRARY.length
 *   • diseases  — DISEASE_LIBRARY.length
 *   • pests     — PEST_LIBRARY.length
 *
 * Coverage is reported AS-IS against the wave-39 targets:
 *   • targetPlants:   250
 *   • targetFlowers:  50
 *   • targetDiseases: 30
 *   • targetPests:    30
 *
 * Below target ⇒ launchCoveragePercent < 100. Wave-39 rule: never
 * block consumer pilot on coverage; warn-only.
 *
 * Strict-rule audit
 *   • Pure composition over library exports. SSR-safe. Frozen
 *     envelope. Never throws.
 *   • Static-import only — no dynamic require / globalThis read.
 */

import { VEGETABLE_LIBRARY } from '../plants/media/libraries/vegetableLibrary';
import { FRUIT_LIBRARY }     from '../plants/media/libraries/fruitLibrary';
import { HERB_LIBRARY }      from '../plants/media/libraries/herbLibrary';
import { CROP_LIBRARY }      from '../plants/media/libraries/cropLibrary';
import { HOUSEPLANT_LIBRARY } from '../plants/media/libraries/houseplantLibrary';
import { FLOWER_LIBRARY }    from '../plants/media/libraries/flowerLibrary';
import { DISEASE_LIBRARY }   from '../plants/media/libraries/diseaseLibrary';
import { PEST_LIBRARY }      from '../plants/media/libraries/pestLibrary';

export const KNOWLEDGE_COVERAGE_HEALTH_RUNTIME_VERSION = 'knowledge-coverage-health-v1';

export const KNOWLEDGE_TARGETS = Object.freeze({
  plants:   250,
  flowers:  50,
  diseases: 30,
  pests:    30,
} as const);

export interface KnowledgeCoverageHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  plants:                   number;
  flowers:                  number;
  diseases:                 number;
  pests:                    number;
  targetPlants:             number;
  targetFlowers:            number;
  targetDiseases:           number;
  targetPests:              number;
  /** Composite percent rounded to integer. 100 ⇒ on-target. */
  launchCoveragePercent:    number;
  /** True iff at-or-above-target across all four dimensions. */
  atOrAboveTarget:          boolean;
  /** Per-dimension gap, never negative. */
  gaps: Readonly<{
    plants:   number;
    flowers:  number;
    diseases: number;
    pests:    number;
  }>;
}

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _len(lib: any): number {
  return _safe(() => Array.isArray(lib) ? lib.length : 0, 0);
}

function _percent(actual: number, target: number): number {
  return _safe(() => {
    if (!Number.isFinite(target) || target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((actual / target) * 100)));
  }, 0);
}

export function knowledgeCoverageHealth(): KnowledgeCoverageHealth {
  return _safe(() => {
    const plants =
        _len(VEGETABLE_LIBRARY)
      + _len(FRUIT_LIBRARY)
      + _len(HERB_LIBRARY)
      + _len(CROP_LIBRARY)
      + _len(HOUSEPLANT_LIBRARY);
    const flowers  = _len(FLOWER_LIBRARY);
    const diseases = _len(DISEASE_LIBRARY);
    const pests    = _len(PEST_LIBRARY);

    const pctP = _percent(plants,   KNOWLEDGE_TARGETS.plants);
    const pctF = _percent(flowers,  KNOWLEDGE_TARGETS.flowers);
    const pctD = _percent(diseases, KNOWLEDGE_TARGETS.diseases);
    const pctX = _percent(pests,    KNOWLEDGE_TARGETS.pests);

    const launchCoveragePercent = Math.round((pctP + pctF + pctD + pctX) / 4);
    const atOrAboveTarget =
         plants   >= KNOWLEDGE_TARGETS.plants
      && flowers  >= KNOWLEDGE_TARGETS.flowers
      && diseases >= KNOWLEDGE_TARGETS.diseases
      && pests    >= KNOWLEDGE_TARGETS.pests;

    return Object.freeze({
      runtimeVersion:        KNOWLEDGE_COVERAGE_HEALTH_RUNTIME_VERSION,
      initialized:           true,
      plants,
      flowers,
      diseases,
      pests,
      targetPlants:          KNOWLEDGE_TARGETS.plants,
      targetFlowers:         KNOWLEDGE_TARGETS.flowers,
      targetDiseases:        KNOWLEDGE_TARGETS.diseases,
      targetPests:           KNOWLEDGE_TARGETS.pests,
      launchCoveragePercent,
      atOrAboveTarget,
      gaps: Object.freeze({
        plants:   Math.max(0, KNOWLEDGE_TARGETS.plants   - plants),
        flowers:  Math.max(0, KNOWLEDGE_TARGETS.flowers  - flowers),
        diseases: Math.max(0, KNOWLEDGE_TARGETS.diseases - diseases),
        pests:    Math.max(0, KNOWLEDGE_TARGETS.pests    - pests),
      }),
    });
  }, Object.freeze({
    runtimeVersion:        KNOWLEDGE_COVERAGE_HEALTH_RUNTIME_VERSION,
    initialized:           false,
    plants:                0,
    flowers:               0,
    diseases:              0,
    pests:                 0,
    targetPlants:          KNOWLEDGE_TARGETS.plants,
    targetFlowers:         KNOWLEDGE_TARGETS.flowers,
    targetDiseases:        KNOWLEDGE_TARGETS.diseases,
    targetPests:           KNOWLEDGE_TARGETS.pests,
    launchCoveragePercent: 0,
    atOrAboveTarget:       false,
    gaps: Object.freeze({
      plants:   KNOWLEDGE_TARGETS.plants,
      flowers:  KNOWLEDGE_TARGETS.flowers,
      diseases: KNOWLEDGE_TARGETS.diseases,
      pests:    KNOWLEDGE_TARGETS.pests,
    }),
  }));
}

export function installKnowledgeCoverageHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__knowledgeCoverageHealth !== 'function') {
      w.__knowledgeCoverageHealth = function () {
        const out = knowledgeCoverageHealth();
        try { console.log('[Farroway · Knowledge Coverage]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
