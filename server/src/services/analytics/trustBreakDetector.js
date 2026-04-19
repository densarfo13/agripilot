/**
 * trustBreakDetector.js — detects where the product lost trust
 * with the user. Unlike drop-off (which is "they didn't finish"),
 * a trust break is "the system said X, and the user's behavior
 * told us X was wrong".
 *
 * Six canonical patterns:
 *
 *   1. LOW_CONF_ABANDONED
 *        Step showed low-confidence output, user left without
 *        completing. The softest signal. Suggests copy tuning.
 *
 *   2. DETECT_OVERRIDDEN_BY_MANUAL
 *        Auto-detect succeeded and user CONFIRMED — then later
 *        overrode with a manual selection. Detect was wrong but
 *        convincing.
 *
 *   3. PERMISSION_DENIED_EXIT
 *        User denied location permission and did not continue
 *        through manual. Classic trust hiccup.
 *
 *   4. HIGH_CONF_REC_REJECTED
 *        System showed a recommendation at high confidence and
 *        the user rejected or switched. Strong disagreement.
 *
 *   5. ISSUE_AFTER_TASK_COMPLETED
 *        Within TASK_ISSUE_WINDOW_MS of completing a task, the
 *        user reported an issue. "You told me to do X and now I
 *        have a problem."
 *
 *   6. REPEAT_SKIP_THEN_ABANDONED
 *        User hit TASK_REPEAT_SKIPPED on a task and then never
 *        did any Today task afterwards.
 *
 * Output:
 *   {
 *     broken: boolean,
 *     count: number,
 *     patterns: { [pattern]: number },
 *     breaks: [{ type, at, context }],
 *   }
 */

import { DECISION_EVENT_TYPES, FUNNEL_EVENT_TYPES, FUNNEL_STEPS } from './decisionEventTypes.js';

export const TRUST_BREAK_PATTERNS = Object.freeze({
  LOW_CONF_ABANDONED:         'low_conf_abandoned',
  DETECT_OVERRIDDEN_BY_MANUAL: 'detect_overridden_by_manual',
  PERMISSION_DENIED_EXIT:     'permission_denied_exit',
  HIGH_CONF_REC_REJECTED:     'high_conf_rec_rejected',
  ISSUE_AFTER_TASK_COMPLETED: 'issue_after_task_completed',
  REPEAT_SKIP_THEN_ABANDONED: 'repeat_skip_then_abandoned',
});

const TASK_ISSUE_WINDOW_MS        = 24 * 60 * 60 * 1000; // 24h
const ABANDON_WINDOW_AFTER_MS     = 10 * 60 * 1000;      // 10 min silence = abandoned

export function detectTrustBreaks(events = [], opts = {}) {
  const safe = Array.isArray(events)
    ? [...events].filter(Boolean).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    : [];
  const breaks = [];
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();

  // ─── 1. LOW_CONF_ABANDONED ──────────────────────────
  for (const ev of safe) {
    if (ev.type !== FUNNEL_EVENT_TYPES.STEP_VIEWED) continue;
    const step = ev.meta?.step;
    if (!step) continue;
    const level = ev.confidence?.level;
    if (level !== 'low') continue;
    const abandoned = safe.some((e) =>
      e.type === FUNNEL_EVENT_TYPES.STEP_ABANDONED
      && e.meta?.step === step
      && e.timestamp >= ev.timestamp);
    if (abandoned) {
      breaks.push({
        type: TRUST_BREAK_PATTERNS.LOW_CONF_ABANDONED,
        at: ev.timestamp,
        context: { step, confidence: ev.confidence || null },
      });
    }
  }

  // ─── 2. DETECT_OVERRIDDEN_BY_MANUAL ─────────────────
  // Confirmed yes followed by manual override. Both events are
  // in the decision-quality stream.
  const confirmedYesIdx = safe.findIndex((e) => e.type === DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES);
  if (confirmedYesIdx >= 0) {
    const override = safe.slice(confirmedYesIdx + 1).find((e) =>
      e.type === DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL);
    if (override) {
      breaks.push({
        type: TRUST_BREAK_PATTERNS.DETECT_OVERRIDDEN_BY_MANUAL,
        at: override.timestamp,
        context: {
          confirmedAt: safe[confirmedYesIdx].timestamp,
          overriddenAt: override.timestamp,
          deltaMs: override.timestamp - safe[confirmedYesIdx].timestamp,
        },
      });
    }
  }

  // ─── 3. PERMISSION_DENIED_EXIT ─────────────────────
  const denial = safe.find((e) => e.type === 'onboarding_location_permission_denied');
  if (denial) {
    const continuedManually = safe.some((e) =>
      (e.type === DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL
       || e.type === 'onboarding_manual_country_selected')
      && e.timestamp > denial.timestamp);
    const completedLocation = safe.some((e) =>
      e.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED
      && e.meta?.step === FUNNEL_STEPS.LOCATION
      && e.timestamp > denial.timestamp);
    const last = safe[safe.length - 1];
    const silent = last && (now - last.timestamp) >= ABANDON_WINDOW_AFTER_MS;
    if (!continuedManually && !completedLocation && silent) {
      breaks.push({
        type: TRUST_BREAK_PATTERNS.PERMISSION_DENIED_EXIT,
        at: denial.timestamp,
        context: { minutesSilent: Math.round((now - denial.timestamp) / 60000) },
      });
    }
  }

  // ─── 4. HIGH_CONF_REC_REJECTED ─────────────────────
  for (const ev of safe) {
    if (ev.type !== DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED) continue;
    if (ev.confidence?.level !== 'high') continue;
    const crop = ev.meta?.crop;
    const rejectedLater = safe.some((e) =>
      (e.type === DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED
       || e.type === DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION)
      && e.timestamp >= ev.timestamp
      && (!crop || e.meta?.crop === crop || e.meta?.from === crop));
    if (rejectedLater) {
      breaks.push({
        type: TRUST_BREAK_PATTERNS.HIGH_CONF_REC_REJECTED,
        at: ev.timestamp,
        context: { crop: crop || null, confidence: ev.confidence || null },
      });
    }
  }

  // ─── 5. ISSUE_AFTER_TASK_COMPLETED ─────────────────
  const completions = safe.filter((e) => e.type === DECISION_EVENT_TYPES.TASK_COMPLETED);
  for (const done of completions) {
    const followUp = safe.find((e) =>
      e.type === DECISION_EVENT_TYPES.ISSUE_REPORTED
      && e.timestamp >= done.timestamp
      && e.timestamp - done.timestamp <= TASK_ISSUE_WINDOW_MS
      && (!done.meta?.taskId || !e.meta?.taskId || e.meta.taskId === done.meta.taskId));
    if (followUp) {
      breaks.push({
        type: TRUST_BREAK_PATTERNS.ISSUE_AFTER_TASK_COMPLETED,
        at: followUp.timestamp,
        context: {
          taskId: done.meta?.taskId || null,
          issueType: followUp.meta?.type || null,
          latencyMs: followUp.timestamp - done.timestamp,
        },
      });
    }
  }

  // ─── 6. REPEAT_SKIP_THEN_ABANDONED ─────────────────
  const repeatSkip = safe.find((e) => e.type === DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED);
  if (repeatSkip) {
    const anyTaskAfter = safe.some((e) =>
      (e.type === DECISION_EVENT_TYPES.TASK_COMPLETED
       || e.type === DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED)
      && e.timestamp > repeatSkip.timestamp);
    if (!anyTaskAfter) {
      breaks.push({
        type: TRUST_BREAK_PATTERNS.REPEAT_SKIP_THEN_ABANDONED,
        at: repeatSkip.timestamp,
        context: { taskId: repeatSkip.meta?.taskId || null },
      });
    }
  }

  const patterns = {};
  for (const b of breaks) patterns[b.type] = (patterns[b.type] || 0) + 1;

  return {
    broken: breaks.length > 0,
    count: breaks.length,
    patterns,
    breaks,
  };
}

/**
 * aggregateTrustBreakCounts — dashboard rollup. `users` is
 * `[{ userId, events }]`. Output includes the rate of each
 * pattern across the user base.
 */
export function aggregateTrustBreakCounts(users = []) {
  const out = {
    totalUsers: 0,
    usersWithBreaks: 0,
    byPattern: Object.fromEntries(Object.values(TRUST_BREAK_PATTERNS).map((p) => [p, 0])),
    totalBreaks: 0,
  };
  if (!Array.isArray(users)) return { ...out, trustBreakRate: null };
  for (const u of users) {
    out.totalUsers += 1;
    const info = detectTrustBreaks(u?.events || []);
    if (info.broken) out.usersWithBreaks += 1;
    out.totalBreaks += info.count;
    for (const [p, n] of Object.entries(info.patterns)) {
      out.byPattern[p] = (out.byPattern[p] || 0) + n;
    }
  }
  return {
    ...out,
    trustBreakRate: out.totalUsers > 0
      ? +(out.usersWithBreaks / out.totalUsers).toFixed(3)
      : null,
  };
}

export const _internal = {
  TASK_ISSUE_WINDOW_MS,
  ABANDON_WINDOW_AFTER_MS,
};
