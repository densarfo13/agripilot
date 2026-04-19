/**
 * getTodayScreenState(ctx) — single resolver that decides whether
 * the Today screen should render the ACTIVE or DONE layout.
 *
 *   state          'active' | 'done'
 *   primaryTask    the one task we want the farmer to focus on,
 *                  null in the DONE state
 *   secondaryTasks max 2 remaining-useful tasks; only emitted in
 *                  ACTIVE state
 *   optionalChecks proactive checks (scan for issues / inspect
 *                  field / review status) — only emitted in DONE
 *                  state, never in ACTIVE
 *   riskAlerts     filtered list of alerts actually worth showing
 *   nextHint       { textKey } pointing to the next real milestone
 *   progress       { percent, done, total, overdueCount, riskLevel }
 *
 * Rules:
 *   - if any REQUIRED task is still pending → ACTIVE
 *   - optional checks never count as incomplete required work
 *   - in DONE state the primary slot is empty — the caller renders
 *     DoneStateCard instead
 */

const OPTIONAL_CHECK_DEFS = Object.freeze([
  {
    code: 'scan_crop',
    titleKey: 'today.optional.scanCrop',
    whyKey:   'today.optional.scanCrop.why',
    iconEmoji: '\uD83D\uDD0D', // 🔍
  },
  {
    code: 'inspect_field',
    titleKey: 'today.optional.inspectField',
    whyKey:   'today.optional.inspectField.why',
    iconEmoji: '\uD83C\uDF3E', // 🌾
  },
  {
    code: 'review_status',
    titleKey: 'today.optional.reviewStatus',
    whyKey:   'today.optional.reviewStatus.why',
    iconEmoji: '\uD83D\uDCCB', // 📋
  },
]);

export const OPTIONAL_CHECKS = OPTIONAL_CHECK_DEFS;

function isRequiredTask(task) {
  if (!task) return false;
  // Synthetic override tasks (heat/pest/catchup) are always required.
  if (typeof task.source === 'string' && task.source.startsWith('override:')) return true;
  // Anything else: required unless explicitly marked optional, which
  // the current task schema doesn't expose — so everything routed
  // through buildTodayFeed is required by definition.
  return task.optional !== true;
}

/**
 * pickNextHintKey(payload) — which "next step" copy to show.
 *   ACTIVE:  show first secondary title (already human-friendly)
 *   DONE:    "No more tasks today" unless the server surfaced a
 *            concrete hint (e.g. scheduled task a few days out).
 */
function pickNextHintKey({ state, primaryTask, secondaryTasks, serverHint }) {
  if (state === 'active') {
    if (serverHint) return { text: serverHint };
    if (secondaryTasks?.[0]?.title) return { text: secondaryTasks[0].title };
    return { textKey: 'today.nextHint.keepGoing' };
  }
  // DONE state
  if (serverHint) return { text: serverHint };
  return { textKey: 'today.nextHint.noMoreToday' };
}

/**
 * @param {Object} ctx
 * @param {Object|null} ctx.primaryTask   server-shaped primary task
 * @param {Array}       ctx.secondaryTasks
 * @param {Array}       [ctx.riskAlerts=[]]
 * @param {Array}       [ctx.weatherAlerts=[]]
 * @param {number}      [ctx.overdueCount=0]
 * @param {number}      [ctx.tasksDone=0]
 * @param {number}      [ctx.totalTasks=0]
 * @param {string}      [ctx.riskLevel='low']
 * @param {string}      [ctx.serverHint]  server-provided next-step copy
 * @returns {{
 *   state: 'active'|'done',
 *   primaryTask,
 *   secondaryTasks,
 *   optionalChecks,
 *   riskAlerts,
 *   nextHint,
 *   progress
 * }}
 */
export function getTodayScreenState(ctx = {}) {
  const rawPrimary = ctx.primaryTask || null;
  const rawSecondaries = Array.isArray(ctx.secondaryTasks) ? ctx.secondaryTasks : [];

  const requiredPrimary = rawPrimary && isRequiredTask(rawPrimary) ? rawPrimary : null;
  const requiredSecondaries = rawSecondaries.filter(isRequiredTask).slice(0, 2);
  const hasRequiredWork = !!requiredPrimary || requiredSecondaries.length > 0;

  const state = hasRequiredWork ? 'active' : 'done';

  // Risk alerts: only render when actually present. An empty shell
  // is worse than nothing in the DONE state.
  const riskAlerts = Array.isArray(ctx.riskAlerts) ? ctx.riskAlerts : [];
  const weatherAlerts = Array.isArray(ctx.weatherAlerts) ? ctx.weatherAlerts : [];

  const progress = {
    percent: Number.isFinite(ctx.totalTasks) && ctx.totalTasks > 0
      ? Math.max(0, Math.min(100, Math.round(((ctx.tasksDone || 0) / ctx.totalTasks) * 100)))
      : null,
    done: ctx.tasksDone || 0,
    total: ctx.totalTasks || 0,
    overdueCount: ctx.overdueCount || 0,
    riskLevel: ctx.riskLevel || 'low',
  };

  const nextHint = pickNextHintKey({
    state,
    primaryTask: requiredPrimary,
    secondaryTasks: requiredSecondaries,
    serverHint: ctx.serverHint,
  });

  return {
    state,
    primaryTask: state === 'active' ? requiredPrimary : null,
    secondaryTasks: state === 'active' ? requiredSecondaries : [],
    optionalChecks: state === 'done' ? OPTIONAL_CHECK_DEFS : [],
    riskAlerts,
    weatherAlerts,
    nextHint,
    progress,
  };
}

export const _internal = { isRequiredTask, pickNextHintKey, OPTIONAL_CHECK_DEFS };
