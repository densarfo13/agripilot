/**
 * src/modules/plants/PlantProfileEngine.ts — enriched profile
 * surface.
 *
 *   import {
 *     plantProfileEngine, PLANT_PROFILE_ENGINE_VERSION,
 *   } from 'src/modules/plants/PlantProfileEngine';
 *
 *   plantProfileEngine({ plantId, weather, season,
 *                        haveInGarden, scanResult, region,
 *                        recentScans, missedWaterings,
 *                        careCompliance });
 *
 * What this is
 * ────────────
 *   The platform's single "detail page" composite. Wraps the
 *   pre-existing plantProfile (identity / care / bloom /
 *   companions / pollinator / diseases / autoAddSuggestion) and
 *   layers on:
 *     • today-tasks      (PlantTaskEngine)
 *     • health score     (PlantHealthEngine)
 *     • knowledge feed   (PlantKnowledgeEngine)
 *
 *   One envelope, one read; downstream UI never has to call four
 *   engines to render the platform's promised plant page.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only; no engine modified.
 *   • Wave-5 single-writer invariant preserved.
 */

import { plantProfile } from './plantProfiles';
import { generatePlantTasks } from './PlantTaskEngine';
import { computePlantHealthScore } from './PlantHealthEngine';
import { getPlantKnowledge } from './PlantKnowledgeEngine';

export const PLANT_PROFILE_ENGINE_VERSION = 'plant-profile-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function plantProfileEngine(ctx: any) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const profile = plantProfile(c as any);
    if (!_isObj(profile) || !(profile as any).ok) {
      return Object.freeze({
        runtimeVersion: PLANT_PROFILE_ENGINE_VERSION,
        ok: false,
        reason: _isObj(profile) ? (profile as any).reason : 'error',
        plantId: _isObj(c) ? c.plantId : '',
      });
    }
    const tasks     = generatePlantTasks(c as any);
    const health    = computePlantHealthScore(c as any);
    const knowledge = getPlantKnowledge(c as any);

    return Object.freeze({
      runtimeVersion: PLANT_PROFILE_ENGINE_VERSION,
      ok:    true,
      reason: '',
      profile,
      tasks,
      health,
      knowledge,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_PROFILE_ENGINE_VERSION,
    ok: false, reason: 'error',
    plantId: '',
  }));
}
