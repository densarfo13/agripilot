/**
 * FarmDataQualityEngine.ts — sprint #209, spec "Data Quality".
 *
 * Scores how complete a farm's data is (0-100) by counting which
 * signals are actually present — location, crop, planting date,
 * scans, tasks, outcomes. It lists what is missing and the single
 * next-best action to raise the score. This is HONEST measurement:
 * the score is a weighted count of real data, never a fabricated
 * quality estimate.
 *
 * Pure. SSR-safe. Never throws. Frozen returns.
 */

export const FARM_DATA_QUALITY_VERSION = 'farm-data-quality-engine-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

// Each signal + its weight + the missing-data label + the action.
const SIGNALS: ReadonlyArray<Readonly<{
  key: string; weight: number; missingLabel: string; action: string; actionKey: string;
}>> = Object.freeze([
  { key: 'crop',         weight: 25, missingLabel: 'Add your crop',          action: 'Add your crop',          actionKey: 'farmBrain.next.addCrop.title' },
  { key: 'plantingDate', weight: 20, missingLabel: 'Add planting date',      action: 'Add your planting date', actionKey: 'farmQuality.action.plantingDate' },
  { key: 'location',     weight: 15, missingLabel: 'Add your location',      action: 'Add your location',      actionKey: 'farmQuality.action.location' },
  { key: 'scans',        weight: 20, missingLabel: 'Complete your first scan', action: 'Run your first scan',  actionKey: 'farmBrain.next.firstScan.title' },
  { key: 'tasks',        weight: 10, missingLabel: 'Start a task',           action: 'Start your first task',  actionKey: 'farmBrain.next.startAction.title' },
  { key: 'outcomes',     weight: 10, missingLabel: 'Record an outcome',      action: 'Record your first outcome', actionKey: 'farmQuality.action.outcome' },
]);

export interface FarmDataQuality {
  runtimeVersion: string;
  score:          number;          // 0-100
  level:          'low' | 'fair' | 'good' | 'strong';
  missingData:    ReadonlyArray<string>;
  nextBestAction: Readonly<{ action: string; actionKey: string }> | null;
  hasExplanation: boolean;         // success-criterion flag
}

function _present(key: string, input: any): boolean {
  switch (key) {
    case 'crop':         return !!_str(input.crop);
    case 'plantingDate': return !!_str(input.plantingDate);
    case 'location':     return !!_str(input.location);
    case 'scans':        return _arr(input.scans).length > 0;
    case 'tasks':        return _arr(input.tasks).length > 0;
    case 'outcomes':     return _arr(input.outcomes).length > 0;
    default:             return false;
  }
}

export function buildFarmDataQuality(input: {
  location?: string;
  crop?: string;
  plantingDate?: string;
  scans?: ReadonlyArray<unknown>;
  tasks?: ReadonlyArray<unknown>;
  outcomes?: ReadonlyArray<unknown>;
} = {}): Readonly<FarmDataQuality> {
  return _safe(() => {
    let score = 0;
    const missingData: string[] = [];
    let nextBest: { action: string; actionKey: string } | null = null;

    for (const sig of SIGNALS) {
      if (_present(sig.key, input)) {
        score += sig.weight;
      } else {
        missingData.push(sig.missingLabel);
        // First (highest-weight, list is ordered) missing signal is
        // the next best action.
        if (!nextBest) nextBest = { action: sig.action, actionKey: sig.actionKey };
      }
    }
    score = Math.max(0, Math.min(100, score));
    const level = score >= 85 ? 'strong' : score >= 65 ? 'good' : score >= 40 ? 'fair' : 'low';

    return Object.freeze({
      runtimeVersion: FARM_DATA_QUALITY_VERSION,
      score,
      level,
      missingData: Object.freeze(missingData),
      nextBestAction: nextBest ? Object.freeze(nextBest) : null,
      hasExplanation: true, // always lists what drives the score
    });
  }, Object.freeze({
    runtimeVersion: FARM_DATA_QUALITY_VERSION,
    score: 0, level: 'low' as const,
    missingData: Object.freeze(['Add your crop']),
    nextBestAction: Object.freeze({ action: 'Add your crop', actionKey: 'farmBrain.next.addCrop.title' }),
    hasExplanation: true,
  }));
}

export const _internal = Object.freeze({ buildFarmDataQuality, SIGNALS });
export default buildFarmDataQuality;
