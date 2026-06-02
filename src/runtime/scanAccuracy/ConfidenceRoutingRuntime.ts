/**
 * ConfidenceRoutingRuntime.ts — §CONFIDENCE ROUTING.
 *
 * Pure routing function. Given a confidence percentage, returns the
 * route the scan pipeline should take. NEVER stops on low confidence —
 * the contract is that every scan ends with at least one valid route.
 *
 *   ≥ 85  → 'ai_accept'    (AI result accepted; create task + follow-up)
 *   65-84 → 'medium_ask'   (show alternatives; grower picks)
 *   < 65  → 'human_review' (community / officer / admin)
 *
 * Self-contained; pure; never throws.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';

export const CONFIDENCE_ROUTING_VERSION = 'confidence-routing-v1' as const;

export const HIGH_CONFIDENCE_MIN = 85;
export const MEDIUM_CONFIDENCE_MIN = 65;

export type ConfidenceRoute = 'ai_accept' | 'medium_ask' | 'human_review';

export interface ConfidenceRoutingDecision {
  route: ConfidenceRoute;
  confidencePct: number;
  acceptedAi: boolean;
  needsGrowerInput: boolean;
  needsHumanReview: boolean;
  reason: string;
}

export interface ConfidenceRoutingHealthEnvelope {
  initialized: true;
  routingReady: true;
  highCutoff: number;
  mediumCutoff: number;
  noDeadEnds: true;
  noBypassing: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

/** Pure routing decision — never throws, always returns a defined route. */
export function routeByConfidence(confidencePct: number)
  : Readonly<ConfidenceRoutingDecision> {
  return _safe(() => {
    const safePct = (typeof confidencePct === 'number' && isFinite(confidencePct))
      ? Math.max(0, Math.min(100, confidencePct)) : 0;
    if (safePct >= HIGH_CONFIDENCE_MIN) {
      return Object.freeze<ConfidenceRoutingDecision>({
        route: 'ai_accept',
        confidencePct: safePct,
        acceptedAi: true, needsGrowerInput: false, needsHumanReview: false,
        reason: 'AI confidence at or above ' + HIGH_CONFIDENCE_MIN + '%.',
      });
    }
    if (safePct >= MEDIUM_CONFIDENCE_MIN) {
      return Object.freeze<ConfidenceRoutingDecision>({
        route: 'medium_ask',
        confidencePct: safePct,
        acceptedAi: false, needsGrowerInput: true, needsHumanReview: false,
        reason: 'AI confidence ' + safePct + '% — grower confirms the match.',
      });
    }
    return Object.freeze<ConfidenceRoutingDecision>({
      route: 'human_review',
      confidencePct: safePct,
      acceptedAi: false, needsGrowerInput: false, needsHumanReview: true,
      reason: 'AI confidence below ' + MEDIUM_CONFIDENCE_MIN + '% — route to human review.',
    });
  }, Object.freeze<ConfidenceRoutingDecision>({
    route: 'human_review' as ConfidenceRoute,
    confidencePct: 0, acceptedAi: false,
    needsGrowerInput: false, needsHumanReview: true,
    reason: 'Routing threw — defaulting to human review (no dead end).',
  }));
}

export function confidenceRoutingReady(): boolean { return true; }

export function confidenceRoutingHealth()
  : Readonly<ConfidenceRoutingHealthEnvelope> {
  return _safe(() => Object.freeze<ConfidenceRoutingHealthEnvelope>({
    initialized: true,
    routingReady: true as const,
    highCutoff: HIGH_CONFIDENCE_MIN,
    mediumCutoff: MEDIUM_CONFIDENCE_MIN,
    noDeadEnds: true as const,
    noBypassing: true as const,
    confidence: 'high' as Confidence,
    explanation:
      'Confidence routing: >=' + HIGH_CONFIDENCE_MIN + ' AI-accept, ' +
      MEDIUM_CONFIDENCE_MIN + '-' + (HIGH_CONFIDENCE_MIN - 1) +
      ' grower-pick, <' + MEDIUM_CONFIDENCE_MIN + ' human review. ' +
      'Every confidence yields exactly one route — never a dead end.',
    limitations:
      'Thresholds are decision support, not absolute correctness signals. ' + GUIDANCE_TAIL,
  }), Object.freeze<ConfidenceRoutingHealthEnvelope>({
    initialized: true,
    routingReady: true as const,
    highCutoff: HIGH_CONFIDENCE_MIN,
    mediumCutoff: MEDIUM_CONFIDENCE_MIN,
    noDeadEnds: true as const, noBypassing: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Confidence routing initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installConfidenceRoutingGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__confidenceRoutingHealth !== 'function') {
      w.__confidenceRoutingHealth = function () {
        const out = confidenceRoutingHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Confidence Routing]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
