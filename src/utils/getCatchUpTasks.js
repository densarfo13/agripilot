/**
 * getCatchUpTasks — when a farmer returns after several missed
 * days, replace the normal primary task with a calmer, focused
 * catch-up action instead of pretending they kept up.
 *
 *   getCatchUpPrimaryTask({ missedDays, tasks, weather, stage })
 *     → synthetic { title/titleKey, detail, priority, urgency,
 *                   priorityScore, source: 'catchup', tags }
 *     or null when there's nothing material to catch up on.
 *
 *   adjustProgressAfterGap({ progressPercent, missedDays })
 *     → downshifted percent so the progress bar reflects reality
 *
 *   buildCatchUpTasks(ctx) → { primary, extras }
 *     Uses the above + picks one optional check ("inspect field")
 *     as a secondary — never surfaces more than 2 items.
 *
 * Pure. The Today engine checks `patternInfo.pattern === 'inactive'`
 * then calls this; it passes the returned primary to the page.
 */

const MISSED_THRESHOLD = 3;

/**
 * Choose what catch-up means given context:
 *   - outstanding watering + hot weather → rewatering
 *   - outstanding harvest task               → harvest check
 *   - stage 'harvest_ready'                   → harvest check
 *   - otherwise                              → inspect field
 */
function pickCatchUpKind({ tasks, weather, stage }) {
  const pending = (tasks || []).filter((t) => t?.status === 'pending');
  const hasWatering = pending.some((t) => /water|irrig/i.test(String(t.title || '')));
  const heatHigh = weather && (weather.heatRisk === 'high' || Number(weather.tempHighC) >= 35);
  if (hasWatering && heatHigh) return 'water';
  const hasHarvest = pending.some((t) => /harvest|pick|dig/i.test(String(t.title || '')));
  if (hasHarvest || stage === 'harvest_ready') return 'harvest';
  return 'inspect';
}

const KIND_CONFIG = Object.freeze({
  water:   {
    titleKey: 'catchUp.primary.water',
    detailKey: 'catchUp.detail.water',
    tags: ['watering', 'catchup'],
    priorityScore: 92,
    priority: 'high',
  },
  harvest: {
    titleKey: 'catchUp.primary.harvest',
    detailKey: 'catchUp.detail.harvest',
    tags: ['harvest', 'catchup'],
    priorityScore: 90,
    priority: 'high',
  },
  inspect: {
    titleKey: 'catchUp.primary.inspect',
    detailKey: 'catchUp.detail.inspect',
    tags: ['inspect', 'catchup'],
    priorityScore: 80,
    priority: 'high',
  },
});

export function getCatchUpPrimaryTask({ missedDays = 0, tasks = [], weather = null, stage = null } = {}) {
  if ((missedDays || 0) < MISSED_THRESHOLD) return null;
  const kind = pickCatchUpKind({ tasks, weather, stage });
  const cfg = KIND_CONFIG[kind];
  return {
    id: `catchup:${kind}`,
    source: 'catchup',
    kind,
    titleKey: cfg.titleKey,
    detailKey: cfg.detailKey,
    priorityScore: cfg.priorityScore,
    priority: cfg.priority,
    urgency: 'high',
    tags: cfg.tags,
    missedDays,
    banner: { textKey: 'catchUp.banner.missedDays', vars: { n: missedDays } },
  };
}

/**
 * adjustProgressAfterGap — if the farmer returned after a multi-day
 * gap, the progress-percent should reflect the slippage (a visible
 * drop nudges "Needs attention" status). We cap the pullback at
 * 20 points; this is cosmetic-only for the status pill.
 */
export function adjustProgressAfterGap({ progressPercent = null, missedDays = 0 } = {}) {
  if (!Number.isFinite(progressPercent)) return progressPercent;
  if ((missedDays || 0) < MISSED_THRESHOLD) return progressPercent;
  const pullback = Math.min(20, (missedDays - MISSED_THRESHOLD + 1) * 5);
  return Math.max(0, Math.round(progressPercent - pullback));
}

export function buildCatchUpTasks(ctx = {}) {
  const primary = getCatchUpPrimaryTask(ctx);
  if (!primary) return { primary: null, extras: [] };
  // Single optional secondary — always "check field" so the farmer
  // has a low-effort second step but nothing overwhelming.
  const secondary = {
    id: 'catchup:secondary:inspect',
    source: 'catchup',
    kind: 'inspect',
    titleKey: 'catchUp.secondary.inspect',
    priority: 'medium',
    priorityScore: 55,
    tags: ['inspect', 'catchup'],
  };
  return { primary, extras: primary.kind === 'inspect' ? [] : [secondary] };
}

export const _internal = { MISSED_THRESHOLD, pickCatchUpKind, KIND_CONFIG };
