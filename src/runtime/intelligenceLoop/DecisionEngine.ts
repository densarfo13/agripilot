/**
 * src/runtime/intelligenceLoop/DecisionEngine.ts — Phase 3.
 *
 * Maps orientation → grower-safe recommendation envelope.
 * The output is ALWAYS safe-worded — banned phrases never
 * survive even if upstream emits them.
 */

import {
  LOOP_PRIORITY, BANNED_WORDS,
} from './intelligenceLoopContracts';

export const LOOP_DECISION_ENGINE_VERSION = 'loop-decision-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const BANNED_RE = new RegExp(
  '\\b(' + BANNED_WORDS.map((w) => w.replace(/\s+/g, '\\s+')).join('|')
  + ')\\b', 'gi');

const SAFE_REPLACEMENTS: Record<string, string> = Object.freeze({
  guaranteed:  'expected',
  confirmed:   'likely',
  'will cure': 'is recommended to treat',
  'will heal': 'should help',
  certainly:   'likely',
  definitely:  'likely',
});

function _scrub(text: string): string {
  if (!_str(text)) return '';
  return _str(text).replace(BANNED_RE, (m) => {
    const lo = m.toLowerCase();
    const safe = SAFE_REPLACEMENTS[lo] || 'likely';
    // Preserve initial capitalisation.
    return m[0] === m[0].toUpperCase()
      ? safe[0].toUpperCase() + safe.slice(1) : safe;
  });
}

export function decideRecommendation(orientation: any) {
  return _safe(() => {
    if (!_isObj(orientation)) return _emptyDecision();
    const o = orientation as any;
    const likelyIssue = o.likelyIssue || null;
    const conf = _str(o.confidence) || 'unknown';
    const risk = _str(o.riskLevel) || 'unknown';

    // ─── Priority ─────────────────────────────────────────
    let priority = LOOP_PRIORITY.CAN_WAIT;
    let title    = 'Routine check recommended';
    let body     = 'A routine check is recommended today.';
    let reason   = 'baseline';

    if (likelyIssue) {
      const issueName = _str((likelyIssue as any).name);
      const kind = _str((likelyIssue as any).kind);
      if (risk === 'high') {
        priority = LOOP_PRIORITY.DO_NOW;
        title = 'Inspect plant for ' + issueName;
        body  = 'A ' + kind + ' match is likely — inspect now '
              + 'and monitor closely.';
        reason = 'likely_' + kind + '_high_risk';
      } else {
        priority = LOOP_PRIORITY.DO_TODAY;
        title = 'Inspect plant for ' + issueName;
        body  = 'A possible ' + kind + ' match — inspect today '
              + 'and monitor for spread.';
        reason = 'likely_' + kind;
      }
    } else if ((o.context && (o.context as any).weatherRisk) === 'high') {
      priority = LOOP_PRIORITY.DO_TODAY;
      title  = 'Monitor plant after weather';
      body   = 'Warm humid conditions — monitor the plant for '
             + 'early disease signs today.';
      reason = 'weather_high';
    } else if (o.likelyPlant && conf !== 'low') {
      priority = LOOP_PRIORITY.CAN_WAIT;
      title  = 'Plant identified';
      body   = 'Plant matched the catalog — review the care '
             + 'guide when convenient.';
      reason = 'plant_identified';
    } else {
      priority = LOOP_PRIORITY.CAN_WAIT;
      title  = 'Needs review';
      body   = 'Photo is hard to read — upload another image '
             + 'in better light, or save for review.';
      reason = 'low_confidence';
    }

    const needsReview = conf === 'low'
      || !o.likelyPlant
      || (o.constraints && (o.constraints as any).noKnowledge);

    // Final safety wash on user-facing copy.
    const safeTitle = _scrub(title);
    const safeBody  = _scrub(body);

    return Object.freeze({
      runtimeVersion: LOOP_DECISION_ENGINE_VERSION,
      phase: 'decide',
      plantId: _str(o.plantId),
      recommendationTitle: safeTitle,
      recommendationBody:  safeBody,
      priority,
      needsReview: !!needsReview,
      confidence: conf,
      reason,
    });
  }, _emptyDecision());
}

function _emptyDecision() {
  return Object.freeze({
    runtimeVersion: LOOP_DECISION_ENGINE_VERSION,
    phase: 'decide',
    plantId: '',
    recommendationTitle: 'Routine check recommended',
    recommendationBody:  'A routine check is recommended today.',
    priority: LOOP_PRIORITY.CAN_WAIT,
    needsReview: false,
    confidence: 'unknown',
    reason: 'baseline',
  });
}

export { _scrub as _scrubForTests };
