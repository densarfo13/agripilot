/**
 * getPrimaryGuidance — the single typed entry point spec §2 asks
 * for. One screen = one primary recommendation.
 *
 *   import { getPrimaryGuidance } from 'src/intelligence/getPrimaryGuidance';
 *
 *   const guidance = getPrimaryGuidance({ mode: 'farm', weather, crop, ... });
 *   render(<Tile {...guidance} />);
 *
 * What it returns
 * ───────────────
 * The shape the user sees — title / message / actionLabel /
 * actionRoute / reason / timing / confidenceTone. NEVER scores,
 * probabilities, or AI internals (spec §11).
 *
 * What it does NOT do
 * ───────────────────
 *   • Does not call satellite / prediction / AI adapters
 *     directly. Those are gated by their own feature flags
 *     (enableSatelliteEngine / enablePredictionEngine /
 *     enableAiAdapter / enableScoringEngine / enableRiskEngine).
 *     When their flags are off, the rule-based ladder serves.
 *   • Does not bypass memory cooldowns. The orchestrator's
 *     memory store stamps the chosen kind+key as a side effect
 *     when commit !== false.
 *
 * Strict-rule audit
 *   • Pure / never throws. Falls back to the canonical
 *     FALLBACK_RECOMMENDATION on any error.
 *   • Re-uses the existing orchestrator — single source of truth.
 */

import { getRecommendation, FALLBACK_RECOMMENDATION } from './recommendation/recommendationEngine.js';
import type {
  RecommendationContext,
  RecommendationEnvelope,
  RecommendationOptions,
} from './recommendation/recommendationEngine.js';
import { toConfidenceTone } from './recommendation/recommendationConfidence.js';
import type { ConfidenceTone } from './recommendation/recommendationConfidence.js';

export interface PrimaryGuidance {
  readonly titleKey: string;
  readonly messageKey: string;
  readonly actionLabelKey: string;
  readonly actionRoute: string;
  readonly reasonKey: string;
  /** Estimated time-to-complete in minutes. */
  readonly estimatedMinutes: number;
  /**
   * User-facing tone — never a percentage. Engine confidence
   * tier ('low' | 'medium' | 'high') maps to
   * 'building' | 'observing' | 'confident'.
   */
  readonly confidenceTone: ConfidenceTone;
}

export type PrimaryGuidanceContext = RecommendationContext;
export type PrimaryGuidanceOptions  = RecommendationOptions;

function _toGuidance(env: RecommendationEnvelope): PrimaryGuidance {
  return Object.freeze({
    titleKey:         env.titleKey,
    messageKey:       env.messageKey,
    actionLabelKey:   env.actionLabelKey,
    actionRoute:      env.actionRoute,
    reasonKey:        env.reasonKey,
    estimatedMinutes: env.estimatedMinutes,
    confidenceTone:   toConfidenceTone(env.confidence),
  });
}

/**
 * Return the single primary guidance for the supplied context.
 * Never throws — returns the fallback envelope on any error.
 */
export function getPrimaryGuidance(
  ctx: PrimaryGuidanceContext,
  opts: PrimaryGuidanceOptions = {},
): PrimaryGuidance {
  try {
    const env = getRecommendation(ctx, opts);
    return _toGuidance(env);
  } catch {
    return _toGuidance(FALLBACK_RECOMMENDATION);
  }
}

export default Object.freeze({ getPrimaryGuidance });
