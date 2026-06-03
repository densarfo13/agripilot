/**
 * todaysActionFunnel.js — 5-step funnel logger + aggregator for
 * Today's Action Engine V1.
 *
 *   Shown → Started → Completed → OutcomeRecorded → FollowUpCompleted
 *
 *   logEvent(prisma, { userId, actionId, kind, ... })
 *   computeFunnel(prisma, days?) → { stages, completionPct, target, generatedAt }
 *
 * Pure async helpers. Never throw. Frozen returns.
 * Honesty: completionPct returns null when fewer than MIN_SAMPLE
 * shown events — never fabricates a green percentage from 1 farmer.
 */

const KIND_VALUES = Object.freeze([
  'shown',
  'started',
  'completed',
  'outcome_recorded',
  'follow_up_completed',
]);

const OUTCOME_VALUES = Object.freeze(['better', 'same', 'worse']);

const MIN_SAMPLE = 5;            // honest threshold for the funnel
const TARGET_COMPLETION_PCT = 50; // spec target

function _str(v) { return typeof v === 'string' ? v : ''; }
function _num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }
function _pct(n, d) {
  if (!d || d === 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

/**
 * Append-only insert. Caller fires once per stage transition.
 * Returns { ok, id, reason? }.
 */
export async function logEvent(prisma, args = {}) {
  try {
    if (!prisma || !prisma.todaysActionEvent) {
      return { ok: false, reason: 'prisma_missing' };
    }
    const kind = _str(args.kind);
    if (!KIND_VALUES.includes(kind)) {
      return { ok: false, reason: 'invalid_kind' };
    }
    if (kind === 'outcome_recorded' && !OUTCOME_VALUES.includes(_str(args.outcome))) {
      return { ok: false, reason: 'invalid_outcome' };
    }
    const row = await prisma.todaysActionEvent.create({
      data: {
        userId:   args.userId ? _str(args.userId) : null,
        actionId: args.actionId ? _str(args.actionId).slice(0, 100) : null,
        taskId:   args.taskId ? _str(args.taskId).slice(0, 100) : null,
        scanId:   args.scanId ? _str(args.scanId).slice(0, 100) : null,
        kind,
        outcome:  kind === 'outcome_recorded' ? _str(args.outcome) : null,
        metadata: args.metadata && typeof args.metadata === 'object'
                    ? args.metadata : null,
      },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[todays-action-funnel] logEvent failed:',
        err && err.message);
    } catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

/**
 * Compute the 5-step funnel over the last N days.
 *
 *   { stages: [ { kind, count, pctOfShown } x5 ],
 *     uniqueUsersShown,
 *     completionPct, target, meetsTarget,
 *     outcomes: { better, same, worse },
 *     generatedAt }
 */
export async function computeFunnel(prisma, days = 30) {
  try {
    if (!prisma || !prisma.todaysActionEvent) {
      return _empty('prisma_missing');
    }
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 3600 * 1000);
    const rows = await prisma.todaysActionEvent.findMany({
      where:   { capturedAt: { gte: since } },
      orderBy: { capturedAt: 'desc' },
      take:    20000,
      select:  { kind: true, outcome: true, userId: true },
    });

    const counts = Object.fromEntries(KIND_VALUES.map((k) => [k, 0]));
    const usersShown = new Set();
    const outcomes = { better: 0, same: 0, worse: 0 };
    for (const r of rows) {
      if (counts[r.kind] != null) counts[r.kind]++;
      if (r.kind === 'shown' && r.userId) usersShown.add(r.userId);
      if (r.kind === 'outcome_recorded' && r.outcome
          && OUTCOME_VALUES.includes(r.outcome)) {
        outcomes[r.outcome]++;
      }
    }

    const shownCount = counts.shown;
    const completionPct = shownCount >= MIN_SAMPLE
      ? _pct(counts.completed, shownCount)
      : null;

    const stages = KIND_VALUES.map((k) => Object.freeze({
      kind:        k,
      count:       counts[k],
      pctOfShown:  shownCount >= MIN_SAMPLE
                     ? _pct(counts[k], shownCount)
                     : null,
    }));

    return Object.freeze({
      ok:                true,
      windowDays:        days,
      uniqueUsersShown:  usersShown.size,
      stages:            Object.freeze(stages),
      outcomes:          Object.freeze(outcomes),
      completionPct,
      target:            TARGET_COMPLETION_PCT,
      meetsTarget:       completionPct != null
                           ? completionPct > TARGET_COMPLETION_PCT
                           : null,
      minSample:         MIN_SAMPLE,
      generatedAt:       new Date().toISOString(),
      limitations:       'Decision support, not a guarantee.',
    });
  } catch (err) {
    return _empty('exception', err && err.message);
  }
}

function _empty(reason, message) {
  return Object.freeze({
    ok: false, reason, message,
    windowDays: 0, uniqueUsersShown: 0,
    stages: Object.freeze(KIND_VALUES.map((k) =>
      Object.freeze({ kind: k, count: 0, pctOfShown: null }))),
    outcomes: Object.freeze({ better: 0, same: 0, worse: 0 }),
    completionPct: null,
    target: TARGET_COMPLETION_PCT,
    meetsTarget: null,
    minSample: MIN_SAMPLE,
    generatedAt: new Date().toISOString(),
    limitations: 'Decision support, not a guarantee.',
  });
}

export function todaysActionFunnelInfo() {
  return Object.freeze({
    name:                'todays-action-funnel',
    kindValues:          KIND_VALUES,
    outcomeValues:       OUTCOME_VALUES,
    minSample:           MIN_SAMPLE,
    completionTargetPct: TARGET_COMPLETION_PCT,
    nullWhenInsufficientData: true,
  });
}

export const _internal = Object.freeze({
  _pct, KIND_VALUES, OUTCOME_VALUES, MIN_SAMPLE, TARGET_COMPLETION_PCT,
});

export default logEvent;
