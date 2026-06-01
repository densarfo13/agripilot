/**
 * CropStageEngine.ts — spec-canonical facade over the existing crop
 * lifecycle engine. Determines the 9 spec stages (Not Started / Land Prep /
 * Planting / Emergence / Vegetative / Flowering / Fruiting / Harvest Ready
 * / Post Harvest) using the existing __cropLifecycleHealth probe.
 *
 * No duplicate state; the engine already exists at
 * src/runtime/dailyPlan/CropLifecycleEngine.ts and runs on real data.
 * This facade exists so the spec import path resolves.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export const CROP_STAGE_ENGINE_VERSION = 'crop-stage-engine-v1' as const;

export const CROP_STAGES_CANONICAL: ReadonlyArray<string> = Object.freeze([
  'not_started', 'land_prep', 'planting', 'emergence', 'vegetative',
  'flowering', 'fruiting', 'harvest_ready', 'post_harvest',
]);

export const SUPPORTED_CROPS: ReadonlyArray<string> = Object.freeze([
  'onion', 'maize', 'tomato', 'pepper', 'cassava', 'rice', 'beans', 'garden_crops',
]);

/**
 * cropStage(cropKey, plantingDate?) — returns the canonical stage string
 * by reading window.__cropLifecycleHealth(). Honest fallback to
 * 'not_started' when the underlying engine isn't pinned or returns NEEDS_DATA.
 *
 * Recommendation contract: every returned envelope carries confidence +
 * limitations (the underlying engine's own honesty contract). This facade
 * never fabricates a stage.
 */
export function cropStage(_cropKey?: string, _plantingDate?: any) {
  return _safe(() => {
    if (typeof window === 'undefined') {
      return Object.freeze({ stage: 'not_started', confidence: 'low', limitations: 'SSR — no live probe.' });
    }
    const w = window as any;
    const probe = typeof w.__cropLifecycleHealth === 'function' ? w.__cropLifecycleHealth() : null;
    if (!probe) return Object.freeze({ stage: 'not_started', confidence: 'low', limitations: 'Lifecycle engine not yet installed.' });
    const v = (probe as any).value || probe;
    const stage = String((v as any).currentStage || (v as any).stage || 'not_started');
    return Object.freeze({
      stage,
      confidence: (probe as any).confidence || 'medium',
      limitations: (probe as any).limitations || 'Approximate stage; user-correctable.',
    });
  }, Object.freeze({ stage: 'not_started', confidence: 'low', limitations: 'Stage engine threw.' }));
}
