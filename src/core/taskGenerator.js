/**
 * taskGenerator.js — combines crop-stage tasks, weather rules,
 * recent activity, and harvest readiness into the max-3
 * action list the daily plan card renders.
 *
 * Priority chain (spec §5):
 *   1. Critical alerts (severe weather)
 *   2. Weather-driven tasks
 *   3. Crop-stage tasks
 *   4. Missed / overdue (last 3 days)
 *   5. Harvest readiness / sell prep
 *
 * Output stays at MAX 3 actions. Anything past 3 is dropped
 * silently — the card is meant to keep the farmer focused.
 */

const MAX_ACTIONS = 3;

const A = (id, title, reason, urgency, actionType) => ({
  id, title, reason, urgency, actionType,
});

// ── Stage → suggested action template ────────────────────────
const STAGE_TASKS = Object.freeze({
  germination: {
    title: 'Check seedlings emerged',
    reason: 'Early seedlings are fragile — confirm they came up evenly.',
    urgency: 'medium',
    actionType: 'inspect',
  },
  establishment: {
    title: 'Check plant spacing and water gently',
    reason: 'New plants need light, regular water but no flooding.',
    urgency: 'medium',
    actionType: 'water',
  },
  vegetative: {
    title: 'Inspect leaves and weed lightly',
    reason: 'Weeds compete for water and nutrients during fast growth.',
    urgency: 'medium',
    actionType: 'weed',
  },
  flowering: {
    title: 'Inspect flowers and protect from pests',
    reason: 'Damage during flowering directly cuts your harvest.',
    urgency: 'high',
    actionType: 'inspect',
  },
  grain_filling: {
    title: 'Watch grain fill and water if soil dry',
    reason: 'Grain weight forms now — soil dryness reduces yield.',
    urgency: 'high',
    actionType: 'water',
  },
  fruiting: {
    title: 'Inspect fruits and pick ripe ones',
    reason: 'Ripe fruit left on the plant invites pests and rot.',
    urgency: 'medium',
    actionType: 'harvest',
  },
  harvest: {
    title: 'Plan your harvest and selling',
    reason: 'Your crop is at harvest stage — confirm readiness and prepare.',
    urgency: 'high',
    actionType: 'harvest',
  },
  post_harvest: {
    title: 'Sort and store your harvest',
    reason: 'Good sorting and storage protect price and reduce loss.',
    urgency: 'medium',
    actionType: 'inspect',
  },
});

function stageActionFor(stage) {
  if (!stage) return null;
  const tpl = STAGE_TASKS[stage];
  if (!tpl) return null;
  return A(`stage.${stage}`, tpl.title, tpl.reason, tpl.urgency, tpl.actionType);
}

/**
 * Severity → urgency ordering for de-duplication when an
 * alert already covers what an action would say.
 */
const URGENCY_RANK = { high: 3, medium: 2, low: 1 };

function dedupeByActionType(actions) {
  const seen = new Set();
  const out = [];
  for (const a of actions) {
    const key = a.actionType + ':' + a.id;
    if (seen.has(a.actionType)) continue;
    seen.add(a.actionType);
    seen.add(key);
    out.push(a);
  }
  return out;
}

/**
 * generateActions — main entry. Pure / no I/O.
 *
 * @param  {object} args
 * @param  {object} [args.cropStageInfo]   from estimateCropStage()
 * @param  {object} [args.weatherRules]    from applyWeatherRules()
 *                                          { actions, alerts }
 * @param  {object[]} [args.recentTasks]   optional last-3-day
 *                                          activity snapshot for
 *                                          overdue detection
 * @param  {string[]} [args.completedToday] action ids completed today
 * @param  {boolean} [args.harvestReady]   crop-stage flag
 *
 * @returns {object[]} max 3 actions
 */
export function generateActions({
  cropStageInfo = null,
  weatherRules  = { actions: [], alerts: [] },
  recentTasks   = [],
  completedToday = [],
  harvestReady   = false,
} = {}) {
  const out = [];

  // ── 1. Critical alerts already convey their own action.
  //       Higher-severity entries from weatherRules.actions sort
  //       to the top below, so we just push them all in here.
  if (Array.isArray(weatherRules.actions)) {
    for (const a of weatherRules.actions) {
      if (a && URGENCY_RANK[a.urgency]) out.push(a);
    }
  }

  // ── 2. Crop-stage task.
  const stageAction = stageActionFor(cropStageInfo && cropStageInfo.stage);
  if (stageAction) out.push(stageAction);

  // ── 3. Harvest readiness → sell prep.
  if (harvestReady) {
    out.push(A(
      'harvest.prepareToSell',
      'Prepare to sell',
      'Your crop is at harvest stage — confirm readiness, then list it on the Sell page when you are ready.',
      'high',
      'sell',
    ));
  }

  // ── 4. Overdue check — surfaces a single "follow up on
  //       missed task" entry when recentTasks contains items
  //       flagged as overdue. Caller-controlled shape so the
  //       generator stays decoupled from the task store.
  if (Array.isArray(recentTasks)) {
    const overdue = recentTasks.find((t) => t && t.overdue && t.title);
    if (overdue) {
      out.push(A(
        `overdue.${overdue.id || overdue.actionType || 'task'}`,
        overdue.title,
        'You started this earlier — finish it today so the schedule stays on track.',
        'medium',
        overdue.actionType || 'inspect',
      ));
    }
  }

  // ── Filter completed today. Dedupe by actionType so we don't
  //    push the farmer to "inspect" twice in different words.
  const filtered = out.filter((a) => !completedToday.includes(a.id));

  // Sort by urgency desc; stable for equal urgency.
  filtered.sort((a, b) => (URGENCY_RANK[b.urgency] || 0) - (URGENCY_RANK[a.urgency] || 0));

  return dedupeByActionType(filtered).slice(0, MAX_ACTIONS);
}

export const _internal = Object.freeze({ STAGE_TASKS, MAX_ACTIONS });
