/**
 * adaptiveWording — promotes a task's title from base → finish → completeNow
 * as distinct days without completion accumulate.
 *
 * Pure. Reads the canonical crop definition for alt titleKeys and the
 * repetition memory for the day count. Never mutates state.
 *
 * Tiers:
 *   days 0–1  →  task.titleKey                ("Clear your field")
 *   days ≥ 2  →  task.finishTitleKey         ("Finish clearing your field")
 *   days ≥ 3  →  task.completeNowTitleKey    ("Complete your land clearing now")
 *
 * Falls through cleanly if an alt key is missing.
 */

import { getDefinedTasks } from './cropDefinitions.js';
import { getRepetitionDays } from '../services/taskRepetitionMemory.js';

const FINISH_DAYS = 2;
const COMPLETE_NOW_DAYS = 3;

function findTaskDef(cropCode, stage, type) {
  if (!cropCode || !stage || !type) return null;
  const defs = getDefinedTasks(cropCode, stage);
  return (defs || []).find(d => d.type === type) || null;
}

/**
 * Resolve the right title key for the current day's tier.
 *
 * @param {Object} params
 * @param {string} params.type         task.type (e.g. 'clear_field')
 * @param {string} [params.cropCode]   crop (e.g. 'MAIZE')
 * @param {string} [params.stage]      crop stage (e.g. 'land_preparation')
 * @param {string} [params.baseKey]    fallback when no crop def is found
 * @param {number} [params.daysOverride]  test hook — skips memory read
 * @returns {{ key: string|null, tier: 'base'|'finish'|'completeNow' }}
 */
export function resolveAdaptiveTitleKey({ type, cropCode, stage, baseKey, daysOverride }) {
  const days = typeof daysOverride === 'number' ? daysOverride : getRepetitionDays(type);
  const def = findTaskDef(cropCode, stage, type);
  const base = baseKey || def?.titleKey || null;

  if (days >= COMPLETE_NOW_DAYS && def?.completeNowTitleKey) {
    return { key: def.completeNowTitleKey, tier: 'completeNow' };
  }
  if (days >= FINISH_DAYS && def?.finishTitleKey) {
    return { key: def.finishTitleKey, tier: 'finish' };
  }
  return { key: base, tier: 'base' };
}

export const ADAPTIVE_WORDING_CONFIG = { FINISH_DAYS, COMPLETE_NOW_DAYS };
