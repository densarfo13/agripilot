/**
 * actionRecommendations.js — turn three counts into short
 * NGO-readable next-step strings.
 *
 *   getNGOAction({ pestHigh, droughtHigh, inactiveFarms })
 *     -> Array<{ messageKey, fallback, severity, kind }>
 *
 * Pure, deterministic. Three thresholded counts in, an action
 * list out. Mirrors the contract the brief calls for and stays
 * intentionally narrow — `src/ngo/actionEngine.js` is the
 * richer per-region action composer; this module is the
 * dashboard-level "what should I do today" summariser.
 *
 *   Instead of:
 *     "15 farms high risk"
 *
 *   Render:
 *     "Send field agent to inspect high-risk farms"
 *     "Advise farmers to check crops today"
 *     "Monitor drought-risk farms this week"
 *
 * Strict-rule audit
 *   * No raw model output — every action is a translatable
 *     phrase keyed off a domain (pest / drought / engagement)
 *   * Pure: no API calls, no localStorage reads. Caller passes
 *     the counts; this module turns them into strings.
 *   * tSafe friendly: every action carries `messageKey` +
 *     `fallback` so the NGO panel can route through tSafe
 *     without leaking English in non-English UIs.
 *   * No fake urgency: thresholds are tunable constants below;
 *     low counts produce zero actions (the dashboard renders
 *     a "no urgent actions" empty-state instead of fluffing
 *     the list).
 */

const PEST_HIGH_THRESHOLD     = 5;  // farms at HIGH pest risk
const DROUGHT_HIGH_THRESHOLD  = 5;  // farms at HIGH drought risk
const INACTIVE_THRESHOLD      = 3;  // farms gone quiet

const ACTION = Object.freeze({
  PEST_DEPLOY: Object.freeze({
    messageKey: 'ngo.actions.pestDeploy',
    fallback:   'Send field agent to inspect high-risk farms',
    severity:   'high',
    kind:       'pest',
  }),
  PEST_ADVISE: Object.freeze({
    messageKey: 'ngo.actions.pestAdvise',
    fallback:   'Advise farmers to check crops today',
    severity:   'medium',
    kind:       'pest',
  }),
  DROUGHT_MONITOR: Object.freeze({
    messageKey: 'ngo.actions.droughtMonitor',
    fallback:   'Monitor drought-risk farms this week',
    severity:   'high',
    kind:       'drought',
  }),
  DROUGHT_OUTREACH: Object.freeze({
    messageKey: 'ngo.actions.droughtOutreach',
    fallback:   'Reach out to farmers about water-saving practices',
    severity:   'medium',
    kind:       'drought',
  }),
  REENGAGE_INACTIVE: Object.freeze({
    messageKey: 'ngo.actions.reengageInactive',
    fallback:   'Follow up with inactive farmers this week',
    severity:   'medium',
    kind:       'engagement',
  }),
});

function _toCount(v) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * getNGOAction({ pestHigh, droughtHigh, inactiveFarms }) → Array
 *
 * Returns 0..N action objects, ordered by severity (high first)
 * then kind. An empty array means "no urgent actions" — the
 * caller should render an empty state, not a default phrase.
 */
export function getNGOAction(input = {}) {
  const pestHigh       = _toCount(input.pestHigh);
  const droughtHigh    = _toCount(input.droughtHigh);
  const inactiveFarms  = _toCount(input.inactiveFarms);

  const out = [];

  // Pest tier — both deploy AND advise can fire. Deploy when
  // the count is over the threshold; advise on smaller clusters
  // so a single early sighting doesn't get a full intervention.
  if (pestHigh >= PEST_HIGH_THRESHOLD) {
    out.push(ACTION.PEST_DEPLOY);
  } else if (pestHigh > 0) {
    out.push(ACTION.PEST_ADVISE);
  }

  // Drought tier — same shape.
  if (droughtHigh >= DROUGHT_HIGH_THRESHOLD) {
    out.push(ACTION.DROUGHT_MONITOR);
  } else if (droughtHigh > 0) {
    out.push(ACTION.DROUGHT_OUTREACH);
  }

  // Engagement tier — orthogonal to risk. Only fires when
  // measurable disengagement is happening; small dropouts are
  // expected and don't warrant an action.
  if (inactiveFarms >= INACTIVE_THRESHOLD) {
    out.push(ACTION.REENGAGE_INACTIVE);
  }

  return out;
}

// Re-export the threshold constants so tests + dashboards can
// reference them without re-declaring magic numbers.
export const THRESHOLDS = Object.freeze({
  PEST_HIGH:    PEST_HIGH_THRESHOLD,
  DROUGHT_HIGH: DROUGHT_HIGH_THRESHOLD,
  INACTIVE:     INACTIVE_THRESHOLD,
});

export default getNGOAction;
