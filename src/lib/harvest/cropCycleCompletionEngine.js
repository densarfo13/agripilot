/**
 * cropCycleCompletionEngine.js — single source of truth for the
 * farm's crop-cycle state.
 *
 *   getCropCycleState({ farm, now }) → {
 *     state,                // 'active' | 'harvest_ready' | 'completed'
 *     harvestState,         // pass-through from detection engine
 *     shouldSuppressGrowthTasks,  // true when state === 'completed'
 *     shouldInjectHarvestTasks,   // true when state === 'harvest_ready'
 *     nextStep: { key, fallback, actionKey? },
 *   }
 *
 * The state machine is intentionally small:
 *
 *   active ──(timeline reaches harvest stage OR
 *             timeline past lifecycle OR
 *             manual override = harvest)──→ harvest_ready
 *
 *   harvest_ready ──(recordHarvest saved)──→ completed
 *
 *   completed ──(no transition until a new cycle starts — i.e. the
 *                farm's plantingDate changes)──→ active
 *
 * Callers use shouldSuppressGrowthTasks to stop generating
 * vegetative-stage tasks after completion, and
 * shouldInjectHarvestTasks to merge harvest templates into the
 * daily pool while the crop is ready.
 */

import { detectHarvestState } from './harvestDetectionEngine.js';

function nextStepFor(state) {
  switch (state) {
    case 'harvest_ready':
      return {
        key: 'harvest.cycle.nextStep.harvestReady',
        fallback: 'Harvest when you\u2019re ready — then record the amount so we can wrap the cycle.',
        actionKey: 'record_harvest',
      };
    case 'completed':
      return {
        key: 'harvest.cycle.nextStep.completed',
        fallback: 'Cycle complete. Prepare storage, review performance, or start a new planting cycle.',
        actionKey: 'start_new_cycle',
      };
    case 'active':
    default:
      return {
        key: 'harvest.cycle.nextStep.active',
        fallback: 'Keep up with today\u2019s tasks — your crop is on its way.',
        actionKey: 'open_today_tasks',
      };
  }
}

export function getCropCycleState({ farm = null, now = null } = {}) {
  const harvestState = detectHarvestState({ farm, now });
  if (!harvestState) {
    return Object.freeze({
      state: 'active',
      harvestState: null,
      shouldSuppressGrowthTasks: false,
      shouldInjectHarvestTasks: false,
      nextStep: nextStepFor('active'),
    });
  }

  const state = harvestState.cycleState;   // 'active' | 'harvest_ready' | 'completed'
  return Object.freeze({
    state,
    harvestState,
    shouldSuppressGrowthTasks: state === 'completed',
    shouldInjectHarvestTasks:  state === 'harvest_ready',
    nextStep: nextStepFor(state),
  });
}

export const _internal = Object.freeze({ nextStepFor });
