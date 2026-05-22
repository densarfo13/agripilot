/**
 * generateLifecycleTasks.js — thin facade that exposes the stage-
 * based task list from `cropLifecycleEngine` at the spec-requested
 * import path.
 *
 *   import { generateLifecycleTasks }
 *     from 'src/core/lifecycle/generateLifecycleTasks.js';
 *
 *   const tasks = generateLifecycleTasks({ crop, plantingDate, mode });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A consumer-friendly accessor over `computeLifecycleSnapshot`.
 *   It does NOT generate a parallel task system — task generation
 *   stays in `cropLifecycleEngine`. This file simply gives the
 *   spec's named import path a stable handle and shapes the output
 *   into the existing task envelope.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { computeLifecycleSnapshot } from './cropLifecycleEngine.js';

/**
 * Return the stage-appropriate task envelopes for the given
 * lifecycle context. Each task is shaped for the existing task
 * generator: `{ titleKey, titleFallback, actionType, params,
 * stage, urgency }`.
 *
 * @param {object} input  — same shape as computeLifecycleSnapshot
 * @returns {Array<object>}
 */
export function generateLifecycleTasks(input) {
  try {
    const snap = computeLifecycleSnapshot(input);
    if (!snap || !Array.isArray(snap.stageTasks)) return [];
    const stage = snap.currentStage;
    // Honest defaults: low urgency for planning / post-harvest;
    // medium for active growth stages; high for harvest_ready
    // (acting late on a ripe crop is a real cost).
    const urgencyOf = (s) => {
      if (s === 'planning' || s === 'post_harvest') return 'low';
      if (s === 'harvest_ready' || s === 'harvest') return 'high';
      return 'medium';
    };
    const urgency = urgencyOf(stage);
    return snap.stageTasks.map((t, i) => ({
      ...t,
      stage,
      urgency,
      // Tag follow-up so the existing scan-task pipeline can dedupe.
      isLifecycle: true,
      seq: i,
    }));
  } catch {
    return [];
  }
}

const _module = { generateLifecycleTasks };
export default _module;
