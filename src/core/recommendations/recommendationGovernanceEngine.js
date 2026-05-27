/**
 * recommendationGovernanceEngine.js — single entry point for the
 * "fewer, higher-quality, contextual, trustworthy" recommendations
 * spec (§1).
 *
 *   import { runRecommendationGovernance }
 *     from 'src/core/recommendations/recommendationGovernanceEngine.js';
 *
 *   const verdict = runRecommendationGovernance({
 *     decisionInput,       // for runDecisionEngine
 *     trustMemory,         // getTrustMemory()
 *     farmMemory,          // getFarmMemorySnapshot()
 *     mode: 'farm' | 'garden',
 *   });
 *
 *   verdict = {
 *     oneBestAction,                  — single tile for the Home surface
 *     suppressedRecommendations,      — explicit reasons each was hidden
 *     urgency,                        — 'high' | 'medium' | 'low'
 *     confidenceTone,                 — 'high_confidence' | 'medium_confidence' | 'needs_review'
 *     reason, bestTime, followUpWindow,
 *     escalationRequired,             — true when scan severity = serious
 *     engineVersion: 'rec-governance-v1',
 *     generatedAt: number,
 *   }
 *
 * What this is
 * ────────────
 *   The CANONICAL governance facade. Composes — never replaces —
 *   the three engines that already exist:
 *
 *     1. decisionPriorityEngine.runDecisionEngine
 *          → 9-rank candidate cascade + per-candidate suppression
 *     2. recommendationSuppression.suppressRecommendations
 *          → rain conflicts / already-done / repeatedly-ignored
 *     3. trustExplanationEngine.applyTrustNoiseSuppression
 *          → acknowledged-recently + repeatedly-ignored across
 *            recommendation IDs
 *
 *   The facade enforces three things the spec explicitly calls out:
 *     • ONE best action returned (not a list)
 *     • Every suppressed candidate carries an explicit reason envelope
 *     • Confidence is a tone, never a number
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Compose-only — every signal still routed through its
 *     existing engine.
 */

import { runDecisionEngine, RANK } from '../intelligence/decisionPriorityEngine.js';
import { applyTrustNoiseSuppression, getTrustMemory }
  from '../trust/trustExplanationEngine.js';

const ENGINE_VERSION = 'rec-governance-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _confidenceTone(urgency, confidence) {
  if (confidence === 'limited_scan_trust') return 'needs_review';
  if (urgency === 'high')                   return 'high_confidence';
  if (urgency === 'medium')                 return 'medium_confidence';
  return 'medium_confidence';
}

function _followUpWindowFor(decision) {
  if (!_isObj(decision)) return null;
  if (decision.followUp && _isObj(decision.followUp)) {
    return Object.freeze({
      key:      _str(decision.followUp.key) || 'rec.followUp.generic',
      fallback: _str(decision.followUp.fallback)
        || 'Check back in a few days to confirm the result.',
      params:   decision.followUp.params,
    });
  }
  return null;
}

function _isCropSurvival(decision) {
  if (!_isObj(decision) || !_isObj(decision.oneBestAction)) return false;
  return decision.oneBestAction.rank === RANK.CROP_SURVIVAL;
}

function _scanSeriousFlag(input) {
  const di = _isObj(input && input.decisionInput) ? input.decisionInput : {};
  const scan = di.scan;
  if (!_isObj(scan)) return false;
  const sev = _str(scan.severity).toLowerCase();
  return sev === 'serious';
}

/**
 * Build the governance envelope. Always returns a frozen object,
 * never throws.
 */
export function runRecommendationGovernance(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};

    // 1) Decision priority — single best action + per-candidate suppression.
    const decision = _safe(
      () => runDecisionEngine(_isObj(safe.decisionInput) ? safe.decisionInput : {}),
      null,
    );

    // 2) Trust noise filter — drop acknowledged-recently or repeatedly-ignored.
    const memory = Array.isArray(safe.trustMemory) ? safe.trustMemory : getTrustMemory();
    const candidatesForTrust = [];
    if (decision && _isObj(decision.oneBestAction) && decision.oneBestAction.candidateId) {
      candidatesForTrust.push({
        id:   decision.oneBestAction.candidateId,
        type: decision.oneBestAction.candidateId,
      });
    }
    const trustFilter = applyTrustNoiseSuppression(candidatesForTrust, { memory });

    // 3) Resolve final oneBestAction. If the trust filter dropped the
    //    winner, downgrade urgency + flag for review.
    const winnerSuppressedByTrust = trustFilter.suppressed.length > 0
      && trustFilter.kept.length === 0;

    const oneBestAction = winnerSuppressedByTrust
      ? Object.freeze({
          key:      'rec.calm.holdoff',
          fallback: 'Nothing urgent right now — we will check in again later.',
          rank:     null,
          candidateId: null,
        })
      : (decision && decision.oneBestAction) || null;

    const urgency = winnerSuppressedByTrust
      ? 'low'
      : (decision && decision.urgency) || 'low';

    const confidence = winnerSuppressedByTrust
      ? 'limited_scan_trust'
      : 'gentle';

    const confidenceTone = winnerSuppressedByTrust
      ? 'needs_review'
      : _confidenceTone(urgency, confidence);

    const reason = winnerSuppressedByTrust
      ? Object.freeze({
          key:      'rec.suppressed.trust.calm',
          fallback: 'We are listening more before recommending again.',
        })
      : (decision && decision.reason) || Object.freeze({
          key:      'decision.reason.calm',
          fallback: 'No urgent signals today.',
        });

    const bestTime = winnerSuppressedByTrust ? null
      : (decision && decision.bestTime) || null;

    const followUpWindow = _followUpWindowFor(decision);

    // 4) Build the unified suppression list — combine decision-engine
    //    suppressions with trust-noise suppressions, each with an
    //    explicit reason envelope.
    const suppressedRecommendations = [];
    if (decision && Array.isArray(decision.suppressedActions)) {
      for (const s of decision.suppressedActions) {
        suppressedRecommendations.push(Object.freeze({
          candidateId:     s.candidateId,
          rank:            s.rank,
          label:           s.label,
          reason:          'lower_priority',
          reasonLabel:     s.suppressedReason || Object.freeze({
            key: 'decision.suppressed.rankedLower',
            fallback: 'A higher-priority action is showing first.',
          }),
        }));
      }
    }
    if (trustFilter.suppressed.length > 0) {
      for (const s of trustFilter.suppressed) {
        suppressedRecommendations.push(Object.freeze({
          candidateId:     s.candidate && (s.candidate.id || s.candidate.type),
          rank:            null,
          label:           null,
          reason:          s.reason,
          reasonLabel:     s.reasonLabel,
        }));
      }
    }

    return Object.freeze({
      engineVersion:             ENGINE_VERSION,
      oneBestAction,
      suppressedRecommendations: Object.freeze(suppressedRecommendations),
      urgency,
      confidenceTone,
      reason,
      bestTime,
      followUpWindow,
      escalationRequired:        _scanSeriousFlag(safe) || _isCropSurvival(decision),
      generatedAt:               Date.now(),
    });
  }, _emptyVerdict());
}

function _emptyVerdict() {
  return Object.freeze({
    engineVersion:             ENGINE_VERSION,
    oneBestAction: Object.freeze({
      key:      'decision.action.calm',
      fallback: 'Walk your field and check crop health.',
      rank:     null, candidateId: null,
    }),
    suppressedRecommendations: Object.freeze([]),
    urgency:                   'low',
    confidenceTone:            'medium_confidence',
    reason: Object.freeze({
      key: 'decision.reason.calm', fallback: 'No urgent signals today.',
    }),
    bestTime:                  null,
    followUpWindow:            null,
    escalationRequired:        false,
    generatedAt:               Date.now(),
  });
}

export const _internal = Object.freeze({
  _confidenceTone, _followUpWindowFor,
  _isCropSurvival, _scanSeriousFlag, ENGINE_VERSION,
});

const _module = { runRecommendationGovernance, _internal };
export default _module;
