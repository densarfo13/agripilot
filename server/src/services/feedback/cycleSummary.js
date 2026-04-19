/**
 * cycleSummary.js — post-harvest summary + classification.
 *
 *   classifyHarvestOutcome(outcome)  → 'successful' | 'delayed' |
 *                                       'high_risk' | 'failed'
 *     Thin alias around learningEngine.deriveOutcomeClass so callers
 *     can read `classifyHarvestOutcome` where that reads more
 *     naturally.
 *
 *   buildHarvestSummary({ outcome, cycle, actions })
 *     Turns the raw metrics into a farmer-facing summary:
 *       {
 *         outcomeClass,                           // enum
 *         headlineKey,                            // i18n key
 *         wentWell:        ['summary.pestChecks', …],   // i18n keys
 *         couldImprove:    ['summary.heatStress',  …],  // i18n keys
 *         metrics: { completionRate, skippedTasksCount,
 *                    issueCount, qualityBand, durationDays,
 *                    yieldKg, timingDeltaDays }
 *       }
 *
 * The `wentWell` / `couldImprove` arrays are i18n keys — callers pass
 * them through t() so we honour the "no hardcoded English" rule and
 * every sentence translates cleanly.
 */

import { ACTION_TYPES } from './actionTypes.js';
import { deriveOutcomeClass, OUTCOME_CLASS } from './learningEngine.js';

export function classifyHarvestOutcome(outcome = {}) {
  return deriveOutcomeClass(outcome);
}

/**
 * deriveTimingDeltaDays(cycle) — negative if harvested early,
 * positive if late, null when we have no expectation to compare.
 */
function deriveTimingDeltaDays(cycle = {}) {
  if (!cycle.expectedHarvestDate) return null;
  const now = Date.now();
  const expected = new Date(cycle.expectedHarvestDate).getTime();
  if (!Number.isFinite(expected)) return null;
  return Math.round((now - expected) / 86_400_000);
}

/**
 * deriveWentWell(outcome, actions) — picks up to three things the
 * farmer did well, ordered by strength of the signal.
 */
function deriveWentWell(outcome, actions) {
  const out = [];
  const completionRate = Number(outcome.completionRate) || 0;
  const skipped = Number(outcome.skippedTasksCount) || 0;
  const completed = Number(outcome.completedTasksCount) || 0;
  const issues = Number(outcome.issueCount) || 0;
  const q = String(outcome.qualityBand || '').toLowerCase();

  if (completionRate >= 0.8) out.push('summary.wentWell.completedMostTasks');
  if (skipped === 0 && completed > 0) out.push('summary.wentWell.noSkips');
  if ((actions || []).some((a) => a.actionType === ACTION_TYPES.ISSUE_REPORTED)) {
    out.push('summary.wentWell.reportedIssuesEarly');
  }
  if (q === 'excellent' || q === 'good') out.push('summary.wentWell.qualityStrong');
  if (issues === 0 && completed >= 3) out.push('summary.wentWell.fewIssues');

  return out.slice(0, 3);
}

/**
 * deriveCouldImprove(outcome, cycle, actions) — same idea for the
 * improvement side. We keep the tone constructive: "heat stress
 * increased risk" not "you failed".
 */
const ISSUE_TAG_KEY = Object.freeze({
  pest:         'summary.issueTag.pest',
  drought:      'summary.issueTag.drought',
  excess_rain:  'summary.issueTag.excessRain',
  missed_tasks: 'summary.issueTag.missedTasks',
  poor_growth:  'summary.issueTag.poorGrowth',
  other:        'summary.issueTag.other',
});

function deriveCouldImprove(outcome, cycle, actions) {
  const out = [];
  const completionRate = Number(outcome.completionRate) || 0;
  const skipped = Number(outcome.skippedTasksCount) || 0;
  const issues = Number(outcome.issueCount) || 0;
  const q = String(outcome.qualityBand || '').toLowerCase();
  const klass = classifyHarvestOutcome(outcome);
  const timingDelta = deriveTimingDeltaDays(cycle);

  // Surface farmer-reported issue tags first — they're the strongest
  // signal we have about what hurt this cycle from the farmer's
  // perspective. Up to two before the derived bullets kick in.
  const issueTags = Array.isArray(outcome.issues) ? outcome.issues : [];
  for (const tag of issueTags.slice(0, 2)) {
    const key = ISSUE_TAG_KEY[tag];
    if (key) out.push(key);
  }

  if (skipped >= 3) out.push('summary.couldImprove.tooManySkips');
  else if (completionRate < 0.5 && completionRate > 0) out.push('summary.couldImprove.lowCompletion');

  if (issues >= 2) out.push('summary.couldImprove.multipleIssues');
  const weatherSkip = (actions || []).some((a) =>
    a.actionType === ACTION_TYPES.TASK_SKIPPED &&
    /heat|rain|wind|frost|weather/i.test(String(a.details?.reason || ''))
  );
  if (weatherSkip) out.push('summary.couldImprove.weatherDelays');

  if (timingDelta !== null && timingDelta > 7) out.push('summary.couldImprove.harvestedLate');
  if (timingDelta !== null && timingDelta < -7) out.push('summary.couldImprove.harvestedEarly');

  if (q === 'poor') out.push('summary.couldImprove.qualityPoor');
  if (klass === OUTCOME_CLASS.FAILED) out.push('summary.couldImprove.consider_support');

  // Dedupe while preserving order, then cap at 3.
  const seen = new Set();
  const capped = [];
  for (const k of out) {
    if (seen.has(k)) continue;
    seen.add(k);
    capped.push(k);
    if (capped.length >= 3) break;
  }
  return capped;
}

const HEADLINE_KEY = Object.freeze({
  successful: 'summary.headline.successful',
  delayed:    'summary.headline.delayed',
  high_risk:  'summary.headline.highRisk',
  failed:     'summary.headline.failed',
});

export function buildHarvestSummary({ outcome = {}, cycle = {}, actions = [] } = {}) {
  const outcomeClass = classifyHarvestOutcome(outcome);
  const wentWell = deriveWentWell(outcome, actions);
  // If the cycle genuinely went well and we haven't found anything
  // positive, surface a fallback so the farmer doesn't see an empty
  // "What went well" list.
  if (wentWell.length === 0 && (outcomeClass === OUTCOME_CLASS.SUCCESSFUL)) {
    wentWell.push('summary.wentWell.cycleCompleted');
  }

  return {
    outcomeClass,
    headlineKey: HEADLINE_KEY[outcomeClass] || HEADLINE_KEY.successful,
    wentWell,
    couldImprove: deriveCouldImprove(outcome, cycle, actions),
    metrics: {
      completionRate: Number(outcome.completionRate) || 0,
      completedTasksCount: Number(outcome.completedTasksCount) || 0,
      skippedTasksCount: Number(outcome.skippedTasksCount) || 0,
      overdueTasksCount: Number(outcome.overdueTasksCount) || 0,
      issueCount: Number(outcome.issueCount) || 0,
      qualityBand: outcome.qualityBand || null,
      durationDays: Number(outcome.durationDays) || null,
      yieldKg: Number(outcome.actualYieldKg) || null,
      timingDeltaDays: deriveTimingDeltaDays(cycle),
    },
  };
}

export const _internal = {
  deriveWentWell, deriveCouldImprove, deriveTimingDeltaDays, HEADLINE_KEY,
};
