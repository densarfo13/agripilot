/**
 * src/runtime/harvest/HarvestStageEngine.ts — derives the
 * estimated harvest window when the ripeness engine didn't already
 * compute one (e.g., when the rule fell into UNKNOWN). Reads only
 * from the plant context — never from any engine that bypasses
 * ScanRuntime, and never directly from the camera.
 *
 * Pure. SSR-safe. Never throws.
 */

import {
  RIPENESS_STATUS,
  type RipenessStatusValue,
} from './harvestContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().trim() : '';
}

export interface StageInput {
  plantId:         string;
  ripenessStatus:  RipenessStatusValue;
  lifecycleStage?: string;
  region?:         string;
  season?:         string;
}

const DEFAULT_WINDOWS: Readonly<Record<RipenessStatusValue, string>> =
  Object.freeze({
    [RIPENESS_STATUS.READY]:        'today or within 1-3 days',
    [RIPENESS_STATUS.ALMOST_READY]: 'within 3-7 days',
    [RIPENESS_STATUS.NOT_READY]:    'monitor over 1-3 weeks',
    [RIPENESS_STATUS.OVERRIPE]:     'inspect today',
    [RIPENESS_STATUS.UNKNOWN]:      'monitor and re-scan in 3-5 days',
  });

/**
 * estimateHarvestWindow — accepts the ripeness status and the
 * plant context; returns a human-readable harvest window string.
 * Used only when the rule didn't already emit one. Safe wording.
 */
export function estimateHarvestWindow(input: StageInput): string {
  return _safe(() => {
    const status = input.ripenessStatus || RIPENESS_STATUS.UNKNOWN;
    const base = DEFAULT_WINDOWS[status] || DEFAULT_WINDOWS[RIPENESS_STATUS.UNKNOWN];
    const stage = _lower(input.lifecycleStage);
    if (status === RIPENESS_STATUS.NOT_READY) {
      if (stage.includes('seedling') || stage.includes('young')) {
        return 'monitor over 4-8 weeks';
      }
    }
    if (status === RIPENESS_STATUS.ALMOST_READY && _lower(input.season).includes('rain')) {
      // Honest hedge — rain season can delay; widen the window.
      return base + ' (rainy season may shift this)';
    }
    return base;
  }, DEFAULT_WINDOWS[RIPENESS_STATUS.UNKNOWN]);
}

export const HARVEST_STAGE_ENGINE_VERSION = 'harvest-stage-engine-v1';
