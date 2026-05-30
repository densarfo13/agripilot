/**
 * src/runtime/harvest/HarvestTaskEngine.ts — pure derivation of
 * recommended-task envelopes from a ripeness status. The engine
 * NEVER writes tasks itself — it returns task suggestions that
 * the UI passes to the canonical Task Runtime (addScanTasks).
 *
 * Strict-rule audit
 *   • Pure. Never throws. Frozen output.
 *   • Single ID per (scanId, status) pair → no duplicate-task
 *     fan-out on retry.
 *   • Wording: safe verbs only. No "guaranteed", no "definitely".
 */

import {
  RIPENESS_STATUS,
  type RipenessStatusValue,
  type HarvestRecommendedTask,
  idemTask,
} from './harvestContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface TaskInput {
  scanId:         string;
  plantName:      string;
  ripenessStatus: RipenessStatusValue;
  estimatedWindow?: string;
}

function _t(scanId: string, status: RipenessStatusValue,
            suffix: string, title: string, reason: string,
            urgency: 'low' | 'medium' | 'high',
            actionType: 'harvest' | 'inspect' | 'monitor' | 'follow_up_scan'
           ): HarvestRecommendedTask {
  return Object.freeze({
    // Deterministic id derived from the idempotency key + a
    // per-task suffix — guarantees the same scanId never produces
    // two harvest-task rows for the same status. The canonical
    // addScanTasks path also dedupes by id.
    id:         `${idemTask(scanId, status)}:${suffix}`,
    title, reason, urgency, actionType,
  });
}

/**
 * generateHarvestTasks — returns 1-2 recommended tasks per status.
 * Pure and deterministic.
 */
export function generateHarvestTasks(input: TaskInput): ReadonlyArray<HarvestRecommendedTask> {
  return _safe(() => {
    const sid  = String(input.scanId || '');
    if (!sid) return Object.freeze([]) as ReadonlyArray<HarvestRecommendedTask>;
    const name = String(input.plantName || 'crop');
    const win  = input.estimatedWindow ? ` (${input.estimatedWindow})` : '';

    switch (input.ripenessStatus) {
      case RIPENESS_STATUS.READY:
        return Object.freeze([
          _t(sid, RIPENESS_STATUS.READY, 'harvest',
             `Harvest ${name}${win}`,
             'Visual signals suggest the plant is likely ready.',
             'high', 'harvest'),
          _t(sid, RIPENESS_STATUS.READY, 'inspect',
             `Inspect ${name} for damage before harvest`,
             'Look for hidden rot or pest damage.',
             'medium', 'inspect'),
        ]);
      case RIPENESS_STATUS.ALMOST_READY:
        return Object.freeze([
          _t(sid, RIPENESS_STATUS.ALMOST_READY, 'recheck',
             `Check ${name} again in 2-3 days`,
             'Monitor color and firmness.',
             'medium', 'monitor'),
        ]);
      case RIPENESS_STATUS.NOT_READY:
        return Object.freeze([
          _t(sid, RIPENESS_STATUS.NOT_READY, 'continue-care',
             `Continue care for ${name}`,
             'Plant is not yet ready; follow up with another scan later.',
             'low', 'monitor'),
          _t(sid, RIPENESS_STATUS.NOT_READY, 'followup-scan',
             `Scan ${name} again in 1-2 weeks`,
             'Track readiness progress.',
             'low', 'follow_up_scan'),
        ]);
      case RIPENESS_STATUS.OVERRIPE:
        return Object.freeze([
          _t(sid, RIPENESS_STATUS.OVERRIPE, 'inspect-damage',
             `Inspect ${name} for rot or pest damage`,
             'Photo signals suggest possible damage — remove affected fruit if confirmed.',
             'high', 'inspect'),
        ]);
      default:
        return Object.freeze([]) as ReadonlyArray<HarvestRecommendedTask>;
    }
  }, Object.freeze([]) as ReadonlyArray<HarvestRecommendedTask>);
}

export const HARVEST_TASK_ENGINE_VERSION = 'harvest-task-engine-v1';
