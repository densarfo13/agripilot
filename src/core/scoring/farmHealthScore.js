/**
 * farmHealthScore.js — categorical farm health signal (v2 §8).
 *
 *   import { computeFarmHealthScore }
 *     from 'src/core/scoring/farmHealthScore.js';
 *
 * What it is
 * ──────────
 *   A pure helper that folds a few honest signals — scan trend,
 *   task completion, weather exposure, unresolved issues, crop
 *   stress, pending follow-ups — into ONE of four plain-language
 *   states:
 *
 *     'improving' | 'stable' | 'needs_attention' | 'high_risk'
 *
 *   It deliberately returns a STATE, not a precise number. A
 *   "73/100 farm score" would imply precision Farroway does not
 *   have (spec: "No fake precision scores"). The state is paired
 *   with the drivers that produced it so the UI can explain it.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O. No ML.
 */

export const HEALTH_STATE = Object.freeze({
  IMPROVING:       'improving',
  STABLE:          'stable',
  NEEDS_ATTENTION: 'needs_attention',
  HIGH_RISK:       'high_risk',
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const _ratio = (v) => Math.max(0, Math.min(1, _num(v)));

/**
 * @param {object} inputs
 * @param {string} [inputs.scanTrend]            'improving'|'declining'|'flat'
 * @param {number} [inputs.taskCompletionRate]   0..1
 * @param {string} [inputs.weatherExposure]      'low'|'medium'|'high'
 * @param {number} [inputs.unresolvedIssues]     count
 * @param {string|number} [inputs.cropStress]    'low'|'medium'|'high' OR 0..1
 * @param {number} [inputs.followUpsPending]     count
 * @returns {{ state:string, drivers:string[], note:string }}
 */
export function computeFarmHealthScore(inputs) {
  try {
    const s = (inputs && typeof inputs === 'object') ? inputs : {};
    const scanTrend = _str(s.scanTrend);
    const taskRate  = _ratio(s.taskCompletionRate);
    const weather   = _str(s.weatherExposure);
    const unresolved = Math.max(0, Math.round(_num(s.unresolvedIssues)));
    const followUps  = Math.max(0, Math.round(_num(s.followUpsPending)));
    const cropStress = (typeof s.cropStress === 'number')
      ? _ratio(s.cropStress)
      : (_str(s.cropStress) === 'high' ? 0.85
        : _str(s.cropStress) === 'medium' ? 0.5
        : _str(s.cropStress) === 'low' ? 0.15 : 0);

    // Negative pressure points (higher = worse).
    let risk = 0;
    const drivers = [];
    if (scanTrend === 'declining') { risk += 2; drivers.push('scan trend declining'); }
    if (cropStress >= 0.7)         { risk += 2; drivers.push('high crop stress'); }
    else if (cropStress >= 0.4)    { risk += 1; drivers.push('some crop stress'); }
    if (unresolved >= 3)           { risk += 2; drivers.push(`${unresolved} unresolved issues`); }
    else if (unresolved >= 1)      { risk += 1; drivers.push(`${unresolved} unresolved issue${unresolved > 1 ? 's' : ''}`); }
    if (weather === 'high')        { risk += 1; drivers.push('high weather exposure'); }
    if (taskRate < 0.4)            { risk += 1; drivers.push('low task completion'); }
    if (followUps >= 3)            { risk += 1; drivers.push(`${followUps} follow-ups pending`); }

    // Positive offsets — strong habits pull the state up.
    if (scanTrend === 'improving') risk -= 1;
    if (taskRate >= 0.75)          risk -= 1;

    let state;
    if (risk >= 5)      state = HEALTH_STATE.HIGH_RISK;
    else if (risk >= 3) state = HEALTH_STATE.NEEDS_ATTENTION;
    else if (risk <= 0 && (scanTrend === 'improving' || taskRate >= 0.75)) {
      state = HEALTH_STATE.IMPROVING;
    } else {
      state = HEALTH_STATE.STABLE;
    }

    const note = (state === HEALTH_STATE.IMPROVING || state === HEALTH_STATE.STABLE)
      ? 'Based on recent activity. Keep monitoring as the season changes.'
      : 'Based on recent activity — review the items above and re-check soon.';

    return { state, drivers, note };
  } catch {
    return { state: HEALTH_STATE.STABLE, drivers: [], note: '' };
  }
}

const _module = { HEALTH_STATE, computeFarmHealthScore };
export default _module;
