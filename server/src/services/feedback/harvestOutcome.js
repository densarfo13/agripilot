/**
 * harvestOutcome.js — pure helpers for normalizing a farmer's
 * reported harvest and turning it into an outcome record the
 * recommendation engine can learn from later.
 *
 *   normalizeHarvestInput(raw)   → { actualYieldKg, qualityBand, notes }
 *   computeHarvestOutcome({ cycle, tasks, actions, input })
 *                                → { cropKey, actualYieldKg, quality,
 *                                    completionRate, skipRate, issueCount,
 *                                    durationDays }
 *
 * No I/O. The persistence layer wraps these and writes to the DB.
 */

import { ACTION_TYPES } from './actionTypes.js';
import { computeProgress } from './responseEngine.js';
import { deriveOutcomeClass } from './learningEngine.js';

const QUALITY_BANDS = new Set(['poor', 'fair', 'good', 'excellent']);

function toFiniteOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeHarvestInput(raw = {}) {
  const yieldKg = toFiniteOrNull(raw.actualYieldKg ?? raw.yieldKg ?? raw.yield);
  const qraw = String(raw.qualityBand || raw.quality || '').toLowerCase();
  const quality = QUALITY_BANDS.has(qraw) ? qraw : null;
  const notes = typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : null;
  return { actualYieldKg: yieldKg, qualityBand: quality, notes };
}

/**
 * deriveQualityBand — when the farmer doesn't supply a quality band
 * explicitly, infer one from the completion + skip + issue signals
 * so the recommendation tuner has *something* to learn from. Not a
 * substitute for farmer self-report.
 */
export function deriveQualityBand({ completionRate = 0, skipRate = 0, issueCount = 0 } = {}) {
  if (completionRate >= 0.85 && skipRate < 0.1 && issueCount === 0) return 'excellent';
  if (completionRate >= 0.7  && skipRate < 0.2 && issueCount <= 1) return 'good';
  if (completionRate >= 0.4  && skipRate < 0.4 && issueCount <= 2) return 'fair';
  return 'poor';
}

/**
 * computeHarvestOutcome — assemble the durable outcome record from
 * the cycle + task plan + action log + farmer input.
 */
export function computeHarvestOutcome({
  cycle = {},
  tasks = [],
  actions = [],
  input = {},
} = {}) {
  const norm = normalizeHarvestInput(input);
  const progress = computeProgress({ tasks });
  const issueCount = actions.filter((a) => a.actionType === ACTION_TYPES.ISSUE_REPORTED).length;

  const resolved = progress.completed + progress.skipped;
  const completionRate = resolved ? Number((progress.completed / resolved).toFixed(3)) : 0;
  const skipRate = resolved ? Number((progress.skipped / resolved).toFixed(3)) : 0;

  const qualityBand = norm.qualityBand
    || deriveQualityBand({ completionRate, skipRate, issueCount });

  const plantingDate = cycle.plantingDate ? new Date(cycle.plantingDate) : null;
  const harvestDate  = new Date();
  const durationDays = plantingDate
    ? Math.max(0, Math.floor((harvestDate.getTime() - plantingDate.getTime()) / 86_400_000))
    : null;

  const overdueTasksCount = tasks.filter((t) =>
    t.status === 'pending' && t.dueDate && new Date(t.dueDate).getTime() < harvestDate.getTime()
  ).length;

  const outcomeDraft = {
    cropKey: cycle.cropType || cycle.cropKey || null,
    cropCycleId: cycle.id || null,
    actualYieldKg: norm.actualYieldKg,
    qualityBand,
    notes: norm.notes,
    completedTasksCount: progress.completed,
    skippedTasksCount: progress.skipped,
    overdueTasksCount,
    issueCount,
    completionRate,
    skipRate,
    durationDays,
    reportedAt: harvestDate.toISOString(),
  };
  // Derive outcomeClass using the shared learning helper so the tuner
  // and the outcome aggregator always agree.
  outcomeDraft.outcomeClass = deriveOutcomeClass(outcomeDraft);
  return outcomeDraft;
}

export const _internal = { deriveQualityBand, QUALITY_BANDS };
