/**
 * farmTrustState.js — Daily Farmer Confidence state classifier.
 *
 *   import { classifyFarmTrustState, TRUST_STATE }
 *     from 'src/core/trust/farmTrustState.js';
 *
 *   const verdict = classifyFarmTrustState({
 *     loopHealth: summariseLoopHealth(),
 *     farmMemory: getFarmMemorySnapshot(),
 *     learningSnapshot: getLearningSnapshot(),
 *   });
 *
 *   verdict = {
 *     state:        'building_trust' | 'stable' | 'high_confidence' | 'needs_review',
 *     label:        { key, fallback },
 *     headline:     { key, fallback, params },
 *     supportLine:  { key, fallback, params } | null,
 *     contributors: [{ key, fallback, kind, weight }],
 *     engagementScore: number 0..100,
 *     improvementRate: number 0..1,
 *     confidence:   'low' | 'medium' | 'high',
 *     engineVersion:'farm-trust-state-v1',
 *     generatedAt:  number,
 *   }
 *
 * What this is
 * ────────────
 *   Folds the Confidence Loop summary + farm memory + learning
 *   snapshot into ONE of four farmer-facing states with a calm
 *   one-line headline.
 *
 *   States (NOT a credit score, NEVER shown as a number):
 *     • BUILDING_TRUST  — too little data yet to claim more
 *     • STABLE          — typical day, recommendations are landing
 *     • HIGH_CONFIDENCE — repeated successful outcomes; we can be
 *                          more direct
 *     • NEEDS_REVIEW    — recent worsening trend OR repeated
 *                          ignores; we need to listen, not push
 *
 *   Decision rule (worse-case-wins for safety):
 *     • Disputed/worsened ≥ 1 OR ignored ≥ 5  → NEEDS_REVIEW
 *     • Improved ≥ 3 AND improvementRate ≥ 0.5 → HIGH_CONFIDENCE
 *     • totalRecommendations < 3            → BUILDING_TRUST
 *     • otherwise                            → STABLE
 *
 *   The headline is built from the contributors so the farmer
 *   sees WHY they're in this state — never a bare label.
 *
 *   Compose-only: reads three existing snapshot facades, never
 *   writes back to any store.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is an envelope.
 *   • Worse-of-rules wins for safety.
 */

const ENGINE_VERSION = 'farm-trust-state-v1';

export const TRUST_STATE = Object.freeze({
  BUILDING_TRUST:  'building_trust',
  STABLE:          'stable',
  HIGH_CONFIDENCE: 'high_confidence',
  NEEDS_REVIEW:    'needs_review',
});

const _STATE_RANK = Object.freeze({
  [TRUST_STATE.HIGH_CONFIDENCE]: 0,
  [TRUST_STATE.STABLE]:          1,
  [TRUST_STATE.BUILDING_TRUST]:  2,
  [TRUST_STATE.NEEDS_REVIEW]:    3,
});

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _worseOf(a, b) {
  return (_STATE_RANK[a] || 0) >= (_STATE_RANK[b] || 0) ? a : b;
}

function _labelFor(state) {
  switch (state) {
    case TRUST_STATE.HIGH_CONFIDENCE:
      return Object.freeze({
        key: 'farmTrustState.label.highConfidence', fallback: 'High confidence',
      });
    case TRUST_STATE.STABLE:
      return Object.freeze({
        key: 'farmTrustState.label.stable', fallback: 'Stable',
      });
    case TRUST_STATE.BUILDING_TRUST:
      return Object.freeze({
        key: 'farmTrustState.label.buildingTrust', fallback: 'Building trust',
      });
    case TRUST_STATE.NEEDS_REVIEW:
    default:
      return Object.freeze({
        key: 'farmTrustState.label.needsReview', fallback: 'Needs review',
      });
  }
}

function _headlineFor(state) {
  switch (state) {
    case TRUST_STATE.HIGH_CONFIDENCE:
      return Object.freeze({
        key:      'farmTrustState.headline.highConfidence',
        fallback: 'Your care has been working — Farroway can be more direct with guidance.',
      });
    case TRUST_STATE.STABLE:
      return Object.freeze({
        key:      'farmTrustState.headline.stable',
        fallback: 'Things are steady. Keep your routine going.',
      });
    case TRUST_STATE.BUILDING_TRUST:
      return Object.freeze({
        key:      'farmTrustState.headline.buildingTrust',
        fallback: 'Farroway is learning your farm — guidance will sharpen as you log more.',
      });
    case TRUST_STATE.NEEDS_REVIEW:
    default:
      return Object.freeze({
        key:      'farmTrustState.headline.needsReview',
        fallback: 'A few recent recommendations missed the mark. Farroway will hold back and listen.',
      });
  }
}

function _supportLineFor(state, ctx) {
  // A short calm follow-up sentence — softens the headline.
  switch (state) {
    case TRUST_STATE.HIGH_CONFIDENCE:
      return Object.freeze({
        key:      'farmTrustState.support.highConfidence',
        fallback: 'Recent care resolved {count} issues — keep doing what works.',
        params:   { count: ctx.improvedCount },
      });
    case TRUST_STATE.STABLE:
      return Object.freeze({
        key:      'farmTrustState.support.stable',
        fallback: 'Keep scanning when something looks off so guidance stays close to your farm.',
      });
    case TRUST_STATE.BUILDING_TRUST:
      return Object.freeze({
        key:      'farmTrustState.support.buildingTrust',
        fallback: 'A few more scans and logged tasks will help Farroway find your patterns.',
      });
    case TRUST_STATE.NEEDS_REVIEW:
    default:
      return Object.freeze({
        key:      'farmTrustState.support.needsReview',
        fallback: 'Tell us what felt off — Farroway adjusts based on what you say.',
      });
  }
}

/**
 * Classify the daily farmer trust state.
 *
 * @param {object} input
 * @param {object} [input.loopHealth]       — summariseLoopHealth()
 * @param {object} [input.farmMemory]       — getFarmMemorySnapshot()
 * @param {object} [input.learningSnapshot] — getLearningSnapshot()
 */
export function classifyFarmTrustState(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const lh = _isObj(safe.loopHealth)       ? safe.loopHealth       : {};
    const fm = _isObj(safe.farmMemory)       ? safe.farmMemory       : {};
    const ls = _isObj(safe.learningSnapshot) ? safe.learningSnapshot : {};

    const total            = _num(lh.totalRecommendations)  || 0;
    const improvedCount    = _num(lh.improvedCount)         || 0;
    const worsenedCount    = _num(lh.worsenedCount)         || 0;
    const ignoredCount     = _num(lh.ignoredCount)          || 0;
    const improvementRate  = _num(lh.improvementRate)       || 0;
    const engagementScore  = _num(lh.engagementScore)       || 0;

    const flags = (fm && fm.activeFlags) || {};
    const learningBoost = _num(ls.averageBoost) || 0;

    // ── Decision rules (worse-of-state-rank wins)
    let state = TRUST_STATE.STABLE;

    // Building-trust threshold takes effect only if we have nothing
    // bad to flag. We let high_confidence or needs_review win below.
    if (total < 3) state = TRUST_STATE.BUILDING_TRUST;

    if (improvedCount >= 3 && improvementRate >= 0.5) {
      state = _worseOf(state, TRUST_STATE.HIGH_CONFIDENCE);
      // High_confidence has the lowest rank (0), so worse-of of
      // (state, HIGH_CONFIDENCE) returns the current state unless
      // state was already HIGH_CONFIDENCE. We deliberately set
      // state ← HIGH_CONFIDENCE here (override BUILDING_TRUST /
      // STABLE) UNLESS a worse signal also fires below.
      state = TRUST_STATE.HIGH_CONFIDENCE;
    }

    // Worse signals — these dominate.
    if (worsenedCount >= 1
        || ignoredCount >= 5
        || flags.hasWorseningTrend
        || learningBoost <= -0.20) {
      state = TRUST_STATE.NEEDS_REVIEW;
    }

    // ── Contributors (top 3) describing WHY we landed in this state.
    const contributors = [];
    if (improvedCount > 0) {
      contributors.push(Object.freeze({
        kind: 'improved', weight: improvedCount,
        key:  'farmTrustState.contributor.improvedCount',
        fallback: '{count} successful outcome(s) recently.',
        params: { count: improvedCount },
      }));
    }
    if (worsenedCount > 0) {
      contributors.push(Object.freeze({
        kind: 'worsened', weight: -worsenedCount,
        key:  'farmTrustState.contributor.worsenedCount',
        fallback: '{count} recent outcome(s) got worse.',
        params: { count: worsenedCount },
      }));
    }
    if (ignoredCount > 0) {
      contributors.push(Object.freeze({
        kind: 'ignored', weight: -ignoredCount,
        key:  'farmTrustState.contributor.ignoredCount',
        fallback: '{count} recommendation(s) you skipped recently.',
        params: { count: ignoredCount },
      }));
    }
    if (flags.hasSuccessfulInterventions && state !== TRUST_STATE.NEEDS_REVIEW) {
      contributors.push(Object.freeze({
        kind: 'wins', weight: 1,
        key:  'farmTrustState.contributor.priorWins',
        fallback: 'Past care on this farm has resolved similar issues.',
      }));
    }
    if (flags.hasWorseningTrend) {
      contributors.push(Object.freeze({
        kind: 'worsening_trend', weight: -2,
        key:  'farmTrustState.contributor.worseningTrend',
        fallback: 'A recent issue appears to be getting worse.',
      }));
    }
    contributors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    const topContributors = contributors.slice(0, 3);

    // ── Confidence in the state itself.
    const sources = (total > 0 ? 1 : 0)
                  + (Object.keys(flags).length > 0 ? 1 : 0)
                  + (learningBoost !== 0 ? 1 : 0);
    const confidence = sources >= 3 ? 'high'
                     : sources === 2 ? 'medium'
                     : 'low';

    return Object.freeze({
      engineVersion:   ENGINE_VERSION,
      state,
      label:           _labelFor(state),
      headline:        _headlineFor(state),
      supportLine:     _supportLineFor(state, { improvedCount }),
      contributors:    Object.freeze(topContributors),
      engagementScore,
      improvementRate,
      confidence,
      generatedAt:     Date.now(),
    });
  }, _emptyVerdict());
}

function _emptyVerdict() {
  return Object.freeze({
    engineVersion:   ENGINE_VERSION,
    state:           TRUST_STATE.BUILDING_TRUST,
    label:           _labelFor(TRUST_STATE.BUILDING_TRUST),
    headline:        _headlineFor(TRUST_STATE.BUILDING_TRUST),
    supportLine:     _supportLineFor(TRUST_STATE.BUILDING_TRUST, { improvedCount: 0 }),
    contributors:    Object.freeze([]),
    engagementScore: 0,
    improvementRate: 0,
    confidence:      'low',
    generatedAt:     Date.now(),
  });
}

export const _internal = Object.freeze({
  _worseOf, _labelFor, _headlineFor, _supportLineFor, ENGINE_VERSION,
});

const _module = { classifyFarmTrustState, TRUST_STATE, _internal };
export default _module;
