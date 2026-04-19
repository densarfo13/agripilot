/**
 * getFailureRecoveryOptions — when a cycle closes as `failed` or
 * `high_risk`, we don't just show the generic next-cycle options
 * from nextCycleEngine; we produce a recovery-specific set that:
 *
 *   - explains what likely went wrong (as i18n keys)
 *   - offers a safer / easier retry plan
 *   - suggests a switch when the same crop in the same region has
 *     burned them more than once
 *
 *   getFailureSummary(outcome, actions) →
 *     { causes: string[], severityKey: string }
 *
 *   getImprovedRetryPlan(outcome, cycle) →
 *     { cropKey, tweaks: string[] }  — i18n keys the UI renders
 *     as bullets under a "Next time, try …" heading.
 *
 *   getFailureRecoveryOptions({ outcome, cycle, actions,
 *                               pastOutcomes }) →
 *     { classKey, causes: string[], retry, switchSuggested: bool,
 *       adviceKey }
 *
 * All output is i18n keys, so wording comes through t().
 */

// Action-type string literals — kept here as constants rather than
// imported from the server package so this module stays in the
// browser bundle without dragging server code in. They must match
// the values in server/src/services/feedback/actionTypes.js.
const TYPE_SKIPPED = 'task_skipped';
const TYPE_ISSUE   = 'issue_reported';

export function getFailureSummary(outcome = {}, actions = []) {
  const causes = [];
  const skipped = Number(outcome.skippedTasksCount) || 0;
  const issueTags = Array.isArray(outcome.issues) ? outcome.issues : [];

  // Farmer-reported issue tags carry the strongest signal.
  if (issueTags.includes('drought'))      causes.push('failure.cause.drought');
  if (issueTags.includes('excess_rain'))  causes.push('failure.cause.excessRain');
  if (issueTags.includes('pest'))         causes.push('failure.cause.pest');
  if (issueTags.includes('poor_growth'))  causes.push('failure.cause.poorGrowth');

  // Structural signals.
  if (skipped >= 3)                       causes.push('failure.cause.missedTasks');
  const weatherSkip = (actions || []).some((a) =>
    a.actionType === TYPE_SKIPPED
    && /heat|rain|wind|frost|weather/i.test(String(a.details?.reason || ''))
  );
  if (weatherSkip)                        causes.push('failure.cause.weatherDelays');
  if ((actions || []).filter((a) => a.actionType === TYPE_ISSUE).length >= 2) {
    causes.push('failure.cause.multipleIssues');
  }

  // Keep it short — farmer-facing.
  const deduped = [];
  const seen = new Set();
  for (const c of causes) {
    if (!seen.has(c)) { seen.add(c); deduped.push(c); }
    if (deduped.length >= 3) break;
  }

  const severityKey =
    deduped.length >= 2 ? 'failure.severity.major'
    : deduped.length === 1 ? 'failure.severity.moderate'
    : 'failure.severity.minor';

  return { causes: deduped, severityKey };
}

/**
 * Suggest a concrete "next time" tweak plan, tied to the outcome's
 * cause profile. Tweaks are all i18n keys.
 */
export function getImprovedRetryPlan(outcome = {}, cycle = {}) {
  const tweaks = [];
  const issueTags = Array.isArray(outcome.issues) ? outcome.issues : [];
  if (issueTags.includes('drought') || issueTags.includes('missed_tasks')) {
    tweaks.push('failure.retry.improvedWatering');
  }
  if (issueTags.includes('excess_rain')) {
    tweaks.push('failure.retry.plantEarlier');
  }
  if (issueTags.includes('pest')) {
    tweaks.push('failure.retry.earlierPestChecks');
  }
  if ((Number(outcome.skippedTasksCount) || 0) >= 3) {
    tweaks.push('failure.retry.fewerTasks');
  }
  if (!tweaks.length) tweaks.push('failure.retry.earlyStart');
  return {
    cropKey: cycle.cropType || outcome.cropKey || null,
    tweaks: tweaks.slice(0, 3),
  };
}

/**
 * Has the same (crop × region) combination failed more than once?
 * If so we should nudge toward switching rather than retrying.
 */
function repeatedFailures(cropKey, stateCode, pastOutcomes) {
  if (!cropKey || !Array.isArray(pastOutcomes) || pastOutcomes.length < 2) return false;
  const fails = pastOutcomes.filter((o) => {
    if (!o) return false;
    const sameCrop = String(o.cropKey || o.crop || '').toLowerCase() === String(cropKey).toLowerCase();
    const sameRegion = !stateCode || String(o.stateCode || '').toUpperCase() === String(stateCode).toUpperCase();
    const klass = o.outcomeClass || 'successful';
    return sameCrop && sameRegion && (klass === 'failed' || klass === 'high_risk');
  });
  return fails.length >= 2;
}

export function getFailureRecoveryOptions({
  outcome = {}, cycle = {}, actions = [], pastOutcomes = [], region = null,
} = {}) {
  const klass = outcome.outcomeClass || 'successful';
  if (klass !== 'failed' && klass !== 'high_risk') {
    return null; // non-failure: defer to nextCycleEngine
  }
  const { causes, severityKey } = getFailureSummary(outcome, actions);
  const retry = getImprovedRetryPlan(outcome, cycle);
  const switchSuggested = klass === 'failed'
    || repeatedFailures(
      cycle.cropType || outcome.cropKey,
      region?.stateCode,
      pastOutcomes,
    );
  const adviceKey = switchSuggested
    ? 'failure.advice.tryDifferentCrop'
    : 'failure.advice.retryWithTweaks';
  const classKey = klass === 'failed'
    ? 'summary.headline.failed'
    : 'summary.headline.highRisk';
  return { classKey, causes, severityKey, retry, switchSuggested, adviceKey };
}

export const _internal = { repeatedFailures };
