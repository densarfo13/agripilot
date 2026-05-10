/**
 * recommendationEngine — typed facade over the canonical
 * orchestrator at `src/orchestration/orchestrator.js`.
 *
 * The orchestrator is the runtime authority — this module is the
 * typed entry point new TypeScript callers should bind to. Single
 * source of truth; zero duplication.
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React. Frozen exports.
 *   • Output never exposes scores, probabilities, or AI internals.
 *   • Memory cooldowns + dedup live in companion modules in this
 *     directory; the engine here just delegates.
 */

import {
  getNextBestRecommendation as _getNextBest,
  FALLBACK_RECOMMENDATION as _FALLBACK,
} from '../../orchestration/orchestrator.js';

export interface RecommendationEnvelope {
  readonly titleKey: string;
  readonly messageKey: string;
  readonly actionLabelKey: string;
  readonly actionRoute: string;
  readonly priority: string;
  readonly urgency: string;
  readonly confidence: string;
  readonly reasonKey: string;
  readonly estimatedMinutes: number;
  readonly sourceSignals: Readonly<Record<string, unknown>>;
}

export interface RecommendationContext {
  readonly userId?: string;
  readonly mode?: 'farm' | 'garden';
  readonly country?: string;
  readonly region?: string;
  readonly weather?: object | null;
  readonly crop?: string;
  readonly cropStage?: string;
  readonly farmSize?: number;
  readonly scanHistory?: ReadonlyArray<unknown>;
  readonly soilChecks?: ReadonlyArray<unknown>;
  readonly tasks?: ReadonlyArray<unknown>;
  readonly progressEvents?: ReadonlyArray<unknown>;
  readonly produceListings?: ReadonlyArray<unknown>;
  readonly buyerInterest?: ReadonlyArray<unknown>;
  readonly fundingMatches?: ReadonlyArray<unknown>;
}

export interface RecommendationOptions {
  readonly now?: number;
  /** When false, the orchestrator does not stamp memory. */
  readonly commit?: boolean;
}

export const FALLBACK_RECOMMENDATION: RecommendationEnvelope =
  _FALLBACK as RecommendationEnvelope;

/**
 * The headline API. Returns ONE recommendation per call; never
 * throws (falls back to the §11 envelope on any internal error).
 */
export function getRecommendation(
  ctx: RecommendationContext,
  opts: RecommendationOptions = {},
): RecommendationEnvelope {
  try {
    return _getNextBest(ctx as never, opts as never) as RecommendationEnvelope;
  } catch {
    return FALLBACK_RECOMMENDATION;
  }
}

export default Object.freeze({ getRecommendation, FALLBACK_RECOMMENDATION });
