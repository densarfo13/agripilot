/**
 * hesitationDetector.js — infers hesitation from a user's event
 * stream. Hesitation is about *how* they moved through a step,
 * not just whether they completed it:
 *
 *   • long dwell time before committing
 *   • multiple retries on the same decision
 *   • back-navigation to a previously-completed step
 *   • repeated skips on a Today task
 *
 * Output shape:
 *   {
 *     hesitated:    boolean,
 *     perStep:      { [step]: { dwellMs, retries, backNavs, longDwell } },
 *     perTask:      { [taskId]: { skipCount, repeatSkipped } },
 *     reasons:      [{ stage, kind, detail }],
 *     slowestStep:  string | null,
 *     slowestDwellMs: number | null,
 *   }
 *
 * Thresholds are per-step — we don't want "60s on Welcome" to look
 * the same as "60s on Recommendations". Each threshold is an
 * opinionated starting point; tune from dashboards later.
 */

import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
  FUNNEL_STEP_ORDER,
} from './decisionEventTypes.js';

const DEFAULT_DWELL_THRESHOLD_MS = {
  [FUNNEL_STEPS.WELCOME]:              20_000,
  [FUNNEL_STEPS.LOCATION]:             45_000,
  [FUNNEL_STEPS.GROWING_TYPE]:         25_000,
  [FUNNEL_STEPS.EXPERIENCE]:           25_000,
  [FUNNEL_STEPS.SIZE_DETAILS]:         30_000,
  [FUNNEL_STEPS.RECOMMENDATIONS]:      40_000,
  [FUNNEL_STEPS.CROP_SELECTED]:        20_000,
  [FUNNEL_STEPS.FIRST_VALUE_SCREEN]:   30_000,
  [FUNNEL_STEPS.ONBOARDING_COMPLETED]: 10_000,
};

const BACK_NAV_PENALTY_THRESHOLD = 2;   // 2+ back-navigations = hesitation
const RETRY_PENALTY_THRESHOLD    = 2;   // 2+ retries on a decision
const REPEAT_SKIP_THRESHOLD      = 2;   // 2+ skips on same task

export function detectHesitation(events = [], opts = {}) {
  const safe = Array.isArray(events)
    ? [...events].filter(Boolean).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    : [];

  const dwellThresholds = { ...DEFAULT_DWELL_THRESHOLD_MS, ...(opts.dwellThresholds || {}) };
  const perStep = {};
  const perTask = {};
  const reasons = [];

  // ─── dwell time per step ────────────────────────────
  // Dwell = (timestamp of matching STEP_COMPLETED or STEP_ABANDONED) -
  //          (first STEP_VIEWED for that step). If there's no
  //          terminal event, we dwell up to the last event seen.
  const viewedByStep = {};
  for (const ev of safe) {
    if (ev.type === FUNNEL_EVENT_TYPES.STEP_VIEWED) {
      const step = ev.meta?.step;
      if (step && viewedByStep[step] == null) viewedByStep[step] = ev.timestamp;
    }
  }

  for (const step of Object.keys(viewedByStep)) {
    const viewedAt = viewedByStep[step];
    const terminal = safe.find((e) =>
      (e.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED || e.type === FUNNEL_EVENT_TYPES.STEP_ABANDONED)
      && e.meta?.step === step
      && e.timestamp >= viewedAt);
    const endAt = terminal?.timestamp ?? safe[safe.length - 1]?.timestamp ?? viewedAt;
    const dwellMs = Math.max(0, endAt - viewedAt);
    perStep[step] = perStep[step] || { dwellMs: 0, retries: 0, backNavs: 0, longDwell: false };
    perStep[step].dwellMs = dwellMs;
    const threshold = dwellThresholds[step] ?? 30_000;
    if (dwellMs > threshold) {
      perStep[step].longDwell = true;
      reasons.push({ stage: step, kind: 'long_dwell', detail: { dwellMs, threshold } });
    }
  }

  // ─── retries on location decision ───────────────────
  const retries = safe.filter((e) => e.type === DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED).length;
  if (retries > 0) {
    perStep[FUNNEL_STEPS.LOCATION] = perStep[FUNNEL_STEPS.LOCATION]
      || { dwellMs: 0, retries: 0, backNavs: 0, longDwell: false };
    perStep[FUNNEL_STEPS.LOCATION].retries = retries;
    if (retries >= RETRY_PENALTY_THRESHOLD) {
      reasons.push({ stage: FUNNEL_STEPS.LOCATION, kind: 'multi_retry', detail: { retries } });
    }
  }

  // ─── back-navigation counting ───────────────────────
  // A back-nav is a STEP_VIEWED for step S that happens AFTER a
  // STEP_COMPLETED for a step that comes LATER than S in the
  // canonical order.
  const completedOrder = [];
  for (const ev of safe) {
    if (ev.type !== FUNNEL_EVENT_TYPES.STEP_COMPLETED) continue;
    const idx = FUNNEL_STEP_ORDER.indexOf(ev.meta?.step);
    if (idx >= 0) completedOrder.push({ idx, step: ev.meta.step, at: ev.timestamp });
  }
  for (const ev of safe) {
    if (ev.type !== FUNNEL_EVENT_TYPES.STEP_VIEWED) continue;
    const step = ev.meta?.step;
    const idx = FUNNEL_STEP_ORDER.indexOf(step);
    if (idx < 0) continue;
    const wentBack = completedOrder.some((c) => c.idx > idx && c.at < ev.timestamp);
    if (wentBack) {
      perStep[step] = perStep[step] || { dwellMs: 0, retries: 0, backNavs: 0, longDwell: false };
      perStep[step].backNavs += 1;
    }
  }
  for (const [step, info] of Object.entries(perStep)) {
    if (info.backNavs >= BACK_NAV_PENALTY_THRESHOLD) {
      reasons.push({ stage: step, kind: 'back_nav', detail: { backNavs: info.backNavs } });
    }
  }

  // ─── task-level repeated skips ──────────────────────
  for (const ev of safe) {
    const taskId = ev.meta?.taskId;
    if (!taskId) continue;
    perTask[taskId] = perTask[taskId] || { skipCount: 0, repeatSkipped: false };
    if (ev.type === DECISION_EVENT_TYPES.TASK_SKIPPED) perTask[taskId].skipCount += 1;
    if (ev.type === DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED) perTask[taskId].repeatSkipped = true;
  }
  for (const [taskId, info] of Object.entries(perTask)) {
    if (info.skipCount >= REPEAT_SKIP_THRESHOLD || info.repeatSkipped) {
      reasons.push({ stage: 'today', kind: 'repeat_skip', detail: { taskId, skipCount: info.skipCount } });
    }
  }

  // ─── summarize ──────────────────────────────────────
  let slowestStep = null;
  let slowestDwellMs = null;
  for (const [step, info] of Object.entries(perStep)) {
    if (slowestDwellMs == null || info.dwellMs > slowestDwellMs) {
      slowestStep = step;
      slowestDwellMs = info.dwellMs;
    }
  }

  return {
    hesitated: reasons.length > 0,
    perStep,
    perTask,
    reasons,
    slowestStep,
    slowestDwellMs,
  };
}

/**
 * aggregateHesitationCounts — for product dashboards. `users` is
 * an array of `{ userId, events }`. Returns:
 *   {
 *     totalUsers,
 *     hesitatedUsers,
 *     hesitationRate,
 *     byStage:  { [step]: count },
 *     byKind:   { long_dwell, multi_retry, back_nav, repeat_skip },
 *     averageDwellMsByStep: { [step]: number },
 *   }
 */
export function aggregateHesitationCounts(users = []) {
  const out = {
    totalUsers: 0,
    hesitatedUsers: 0,
    byStage: {},
    byKind: { long_dwell: 0, multi_retry: 0, back_nav: 0, repeat_skip: 0 },
    averageDwellMsByStep: {},
  };
  if (!Array.isArray(users)) return { ...out, hesitationRate: null };
  const dwellSums   = {};
  const dwellCounts = {};
  for (const u of users) {
    out.totalUsers += 1;
    const info = detectHesitation(u?.events || []);
    if (info.hesitated) out.hesitatedUsers += 1;
    for (const r of info.reasons) {
      out.byStage[r.stage] = (out.byStage[r.stage] || 0) + 1;
      out.byKind[r.kind]  = (out.byKind[r.kind]  || 0) + 1;
    }
    for (const [step, stepInfo] of Object.entries(info.perStep)) {
      if (!Number.isFinite(stepInfo.dwellMs) || stepInfo.dwellMs <= 0) continue;
      dwellSums[step]   = (dwellSums[step]   || 0) + stepInfo.dwellMs;
      dwellCounts[step] = (dwellCounts[step] || 0) + 1;
    }
  }
  for (const step of Object.keys(dwellSums)) {
    out.averageDwellMsByStep[step] = Math.round(dwellSums[step] / dwellCounts[step]);
  }
  return {
    ...out,
    hesitationRate: out.totalUsers > 0 ? +(out.hesitatedUsers / out.totalUsers).toFixed(3) : null,
  };
}

export const _internal = {
  DEFAULT_DWELL_THRESHOLD_MS,
  BACK_NAV_PENALTY_THRESHOLD,
  RETRY_PENALTY_THRESHOLD,
  REPEAT_SKIP_THRESHOLD,
};
