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

// Spec-declared issue codes. Anything outside this set is dropped so
// the tuner only learns from curated categories.
const ISSUE_TAGS = new Set([
  'pest', 'drought', 'excess_rain', 'missed_tasks', 'poor_growth', 'other',
]);

function sanitizeIssues(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  const clean = [];
  for (const v of arr) {
    const k = String(v || '').trim().toLowerCase();
    if (ISSUE_TAGS.has(k) && !clean.includes(k)) clean.push(k);
    if (clean.length >= 6) break;
  }
  return clean;
}

/**
 * Some farmer-facing quality vocabularies ('average') don't match the
 * internal band set. Normalize them into the four canonical bands so
 * the scorer + learning engine see consistent values.
 */
const QUALITY_ALIAS = {
  average: 'fair',
  avg: 'fair',
  ok: 'fair',
};

function toFiniteOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeHarvestInput(raw = {}) {
  const yieldKg = toFiniteOrNull(raw.actualYieldKg ?? raw.yieldKg ?? raw.yield);
  const unitRaw = String(raw.yieldUnit || raw.unit || 'kg').toLowerCase();
  const yieldUnit = ['kg', 'lb', 'crate', 'bushel', 'bag'].includes(unitRaw) ? unitRaw : 'kg';
  let qraw = String(raw.qualityBand || raw.quality || '').toLowerCase();
  if (QUALITY_ALIAS[qraw]) qraw = QUALITY_ALIAS[qraw];
  const quality = QUALITY_BANDS.has(qraw) ? qraw : null;
  const notes = typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : null;
  const issues = sanitizeIssues(raw.issues || raw.issueTags);
  const harvestedAt = (() => {
    const d = raw.harvestedAt || raw.harvestDate;
    if (!d) return null;
    const parsed = d instanceof Date ? d : new Date(d);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  })();
  return {
    actualYieldKg: yieldKg,
    yieldUnit,
    qualityBand: quality,
    notes,
    issues,
    harvestedAt,
  };
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

  // Farmer-reported issues count toward the issue signal even when no
  // IssueReport row was created — some farmers only tell us at
  // harvest time.
  const farmerIssues = (norm.issues || []).length;
  const outcomeDraft = {
    cropKey: cycle.cropType || cycle.cropKey || null,
    cropCycleId: cycle.id || null,
    actualYieldKg: norm.actualYieldKg,
    yieldUnit: norm.yieldUnit,
    qualityBand,
    notes: norm.notes,
    issues: norm.issues || [],
    harvestedAt: (norm.harvestedAt || harvestDate).toISOString(),
    completedTasksCount: progress.completed,
    skippedTasksCount: progress.skipped,
    overdueTasksCount,
    issueCount: issueCount + farmerIssues,
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
