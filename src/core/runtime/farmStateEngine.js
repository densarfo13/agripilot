/**
 * farmStateEngine.js — Continuous Farm Loop Engine, 4-state classifier.
 *
 *   import { classifyFarmState, STATE }
 *     from 'src/core/runtime/farmStateEngine.js';
 *
 *   const verdict = classifyFarmState({
 *     decision, riskForecast, farmMemory, scoreSnapshot,
 *     weather, lifecycle, scanHistory,
 *   });
 *
 *   verdict = {
 *     state:        'stable' | 'improving' | 'needs_attention' | 'high_risk',
 *     label:        { key, fallback },
 *     headline:     { key, fallback, params } | null,
 *     confidence:   'low' | 'medium' | 'high',
 *     contributors: [{ kind, severity, key, fallback, params? }],
 *     score0to100:  number,
 *     trend:        'up' | 'down' | 'flat' | null,
 *     engineVersion:'farm-state-v1',
 *     generatedAt:  number,
 *   }
 *
 * What this is
 * ────────────
 *   Pure compose-only classifier. Reads the existing farm-health
 *   signals — the Decision Priority verdict, the predictive risk
 *   forecast, the farm-memory snapshot and (optional) Farroway
 *   Score — and folds them into ONE of four states with a calm
 *   one-line headline.
 *
 *   Not a replacement for `farrowayScoreEngine` (still the canonical
 *   0–100 score). This is the categorical lens the Continuous Farm
 *   Loop needs to choose copy + visual treatment.
 *
 *   The decision rule:
 *     • HIGH_RISK         — decision urgency='high' OR riskForecast
 *                            shows any 'high' severity risk OR memory
 *                            says hasWorseningTrend.
 *     • NEEDS_ATTENTION   — decision urgency='medium' OR any 'medium'
 *                            risk OR hasRecurringIssue.
 *     • IMPROVING         — successful interventions logged AND no
 *                            high/medium signals (recovery in progress).
 *     • STABLE            — fallback (no urgent signals).
 *
 *   Score-band mapping (when Farroway Score is provided):
 *     ≥ 80 → STABLE
 *     60..79 → IMPROVING
 *     40..59 → NEEDS_ATTENTION
 *     < 40 → HIGH_RISK
 *   Whichever rule yields the WORSE state wins (safety bias) so a
 *   high-score farm with an active frost risk still surfaces as
 *   HIGH_RISK.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is an envelope.
 *   • Caller passes plain objects — no live store reads here.
 */

export const STATE = Object.freeze({
  STABLE:          'stable',
  IMPROVING:       'improving',
  NEEDS_ATTENTION: 'needs_attention',
  HIGH_RISK:       'high_risk',
});

const ENGINE_VERSION = 'farm-state-v1';

const _STATE_RANK = Object.freeze({
  [STATE.STABLE]:          0,
  [STATE.IMPROVING]:       1,
  [STATE.NEEDS_ATTENTION]: 2,
  [STATE.HIGH_RISK]:       3,
});

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');

function _worseOf(a, b) {
  return (_STATE_RANK[a] || 0) >= (_STATE_RANK[b] || 0) ? a : b;
}

function _scoreToState(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 80) return STATE.STABLE;
  if (score >= 60) return STATE.IMPROVING;
  if (score >= 40) return STATE.NEEDS_ATTENTION;
  return STATE.HIGH_RISK;
}

function _labelFor(state) {
  switch (state) {
    case STATE.HIGH_RISK:
      return Object.freeze({
        key: 'farmState.label.highRisk', fallback: 'High risk',
      });
    case STATE.NEEDS_ATTENTION:
      return Object.freeze({
        key: 'farmState.label.needsAttention', fallback: 'Needs attention',
      });
    case STATE.IMPROVING:
      return Object.freeze({
        key: 'farmState.label.improving', fallback: 'Improving',
      });
    case STATE.STABLE:
    default:
      return Object.freeze({
        key: 'farmState.label.stable', fallback: 'Stable',
      });
  }
}

function _headlineFor(state, contributors) {
  const top = contributors[0] || null;
  switch (state) {
    case STATE.HIGH_RISK:
      return top
        ? Object.freeze({
            key:      'farmState.headline.highRisk.withReason',
            fallback: 'Act today — {reason}',
            params:   { reason: top.fallback },
          })
        : Object.freeze({
            key:      'farmState.headline.highRisk.generic',
            fallback: 'Several urgent signals — please walk your field today.',
          });
    case STATE.NEEDS_ATTENTION:
      return top
        ? Object.freeze({
            key:      'farmState.headline.needsAttention.withReason',
            fallback: 'Worth a closer look — {reason}',
            params:   { reason: top.fallback },
          })
        : Object.freeze({
            key:      'farmState.headline.needsAttention.generic',
            fallback: 'A few things are worth a closer look soon.',
          });
    case STATE.IMPROVING:
      return Object.freeze({
        key:      'farmState.headline.improving.generic',
        fallback: 'Your recent care is paying off — keep the routine going.',
      });
    case STATE.STABLE:
    default:
      return Object.freeze({
        key:      'farmState.headline.stable.generic',
        fallback: 'All calm — no urgent signals today.',
      });
  }
}

/**
 * Translate inputs into the categorical farm state.
 *
 * @param {object} input
 * @param {object} [input.decision]       — runDecisionEngine() output
 * @param {object} [input.riskForecast]   — runPredictiveRisk() output
 * @param {object} [input.farmMemory]     — getFarmMemorySnapshot()
 * @param {object} [input.scoreSnapshot]  — { overall, band, trend }
 * @returns {object}
 */
export function classifyFarmState(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const decision     = _isObj(safe.decision)     ? safe.decision     : null;
    const riskForecast = _isObj(safe.riskForecast) ? safe.riskForecast : null;
    const farmMemory   = _isObj(safe.farmMemory)   ? safe.farmMemory   : null;
    const scoreSnap    = _isObj(safe.scoreSnapshot) ? safe.scoreSnapshot : null;

    const contributors = [];
    let ruleState = STATE.STABLE;

    // ── Decision-driven contributor
    const urgency = _str(decision && decision.urgency).toLowerCase();
    if (urgency === 'high') {
      ruleState = _worseOf(ruleState, STATE.HIGH_RISK);
      if (decision.reason) {
        contributors.push(Object.freeze({
          kind:     'decision_high',
          severity: 'high',
          key:      decision.reason.key,
          fallback: decision.reason.fallback,
          params:   decision.reason.params,
        }));
      }
    } else if (urgency === 'medium') {
      ruleState = _worseOf(ruleState, STATE.NEEDS_ATTENTION);
      if (decision.reason) {
        contributors.push(Object.freeze({
          kind:     'decision_medium',
          severity: 'medium',
          key:      decision.reason.key,
          fallback: decision.reason.fallback,
          params:   decision.reason.params,
        }));
      }
    }

    // ── Predictive risk contributors
    const risks = (riskForecast && Array.isArray(riskForecast.risks))
      ? riskForecast.risks : [];
    let highRiskCount   = 0;
    let mediumRiskCount = 0;
    for (const r of risks) {
      if (!r) continue;
      const sev = _str(r.severity).toLowerCase();
      if (sev === 'high') {
        highRiskCount += 1;
        contributors.push(Object.freeze({
          kind:     r.kind || 'risk',
          severity: 'high',
          key:      r.label && r.label.key,
          fallback: r.label && r.label.fallback,
          params:   r.label && r.label.params,
        }));
      } else if (sev === 'medium') {
        mediumRiskCount += 1;
        contributors.push(Object.freeze({
          kind:     r.kind || 'risk',
          severity: 'medium',
          key:      r.label && r.label.key,
          fallback: r.label && r.label.fallback,
          params:   r.label && r.label.params,
        }));
      }
    }
    if (highRiskCount > 0) ruleState = _worseOf(ruleState, STATE.HIGH_RISK);
    else if (mediumRiskCount > 0) ruleState = _worseOf(ruleState, STATE.NEEDS_ATTENTION);

    // ── Memory-driven contributors
    const flags = farmMemory && farmMemory.activeFlags;
    if (flags) {
      if (flags.hasWorseningTrend) {
        ruleState = _worseOf(ruleState, STATE.HIGH_RISK);
        contributors.push(Object.freeze({
          kind:     'memory_worsening',
          severity: 'high',
          key:      'farmState.contributor.worseningTrend',
          fallback: 'Recent scans suggest this issue is getting worse.',
        }));
      } else if (flags.hasRecurringIssue) {
        ruleState = _worseOf(ruleState, STATE.NEEDS_ATTENTION);
        contributors.push(Object.freeze({
          kind:     'memory_recurring',
          severity: 'medium',
          key:      'farmState.contributor.recurringIssue',
          fallback: 'The same issue has been scanned before — worth checking.',
        }));
      }
      if (flags.hasSuccessfulInterventions
          && ruleState === STATE.STABLE
          && !flags.hasRecurringIssue
          && !flags.hasWorseningTrend) {
        ruleState = STATE.IMPROVING;
        contributors.push(Object.freeze({
          kind:     'memory_wins',
          severity: 'low',
          key:      'farmState.contributor.recentWins',
          fallback: 'Recent care has resolved issues — keep going.',
          params:   { count: _num(farmMemory.resolvedCount) || 0 },
        }));
      }
    }

    // ── Score-band-driven state (worse-of wins)
    const score0to100 = _num(scoreSnap && scoreSnap.overall);
    const scoreState  = _scoreToState(score0to100);
    if (scoreState) ruleState = _worseOf(ruleState, scoreState);

    // ── Confidence: sum of how many distinct sources contributed.
    const sources = new Set();
    if (decision)     sources.add('decision');
    if (risks.length) sources.add('risk');
    if (farmMemory)   sources.add('memory');
    if (scoreSnap)    sources.add('score');
    const confidence = sources.size >= 3 ? 'high'
                     : sources.size === 2 ? 'medium'
                     : 'low';

    // ── Trend from score snapshot if present
    const trend = (scoreSnap && _str(scoreSnap.trend))
      ? _str(scoreSnap.trend).toLowerCase() : null;

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      state:         ruleState,
      label:         _labelFor(ruleState),
      headline:      _headlineFor(ruleState, contributors),
      confidence,
      contributors:  Object.freeze(contributors.slice(0, 4)),
      score0to100:   score0to100 != null ? score0to100 : null,
      trend:         trend === 'up' || trend === 'down' || trend === 'flat' ? trend : null,
      generatedAt:   Date.now(),
    });
  }, _emptyVerdict());
}

function _emptyVerdict() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    state:         STATE.STABLE,
    label:         _labelFor(STATE.STABLE),
    headline:      _headlineFor(STATE.STABLE, []),
    confidence:    'low',
    contributors:  Object.freeze([]),
    score0to100:   null,
    trend:         null,
    generatedAt:   Date.now(),
  });
}

export const _internal = Object.freeze({
  _worseOf, _scoreToState, _labelFor, _headlineFor, ENGINE_VERSION,
});

const _module = { classifyFarmState, STATE, _internal };
export default _module;
