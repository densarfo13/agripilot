/**
 * predictions — feature-flag-gated foundation for prediction
 * engines (harvest / risk / task / weather impact / irrigation /
 * disease / growth).
 *
 *   Feature flag: enablePredictionEngine (default OFF)
 *
 * Behaviour
 *   • Flag OFF: every export returns the safe rule-based
 *     equivalent from `src/intelligence/core/prediction.js` +
 *     `src/intelligence/core/risk.js`. No new code paths.
 *   • Flag ON: callers can plug richer prediction models in
 *     behind this module's facade. Today the facade simply
 *     points at the rule-based engines so the contract is
 *     stable; concrete ML adapters arrive when feature work
 *     happens.
 *
 * Output contract (spec §5)
 *   Predictions IMPROVE timing / orchestration / prioritization
 *   under the hood. The user never sees percentages, scores, or
 *   model output. The orchestrator consumes the confidence tier
 *   ('low' | 'medium' | 'high') and maps it to a tone via
 *   recommendationConfidence.
 */

import { isFeatureEnabled } from '../../config/features.js';
import {
  predictNextBestAction as _predictAction,
} from '../../intelligence/core/prediction.js';
import {
  estimateCropRisk as _estimateRisk,
} from '../../intelligence/core/risk.js';

const FLAG = 'enablePredictionEngine';

export type PredictionConfidence = 'low' | 'medium' | 'high';

export interface PredictionResult {
  readonly confidence: PredictionConfidence;
  /** Free-form internal note; never surfaced raw to the user. */
  readonly note?: string;
}

export function isPredictionEnabled(): boolean {
  try { return !!isFeatureEnabled(FLAG); } catch { return false; }
}

/**
 * Harvest-readiness prediction. Today delegates to the
 * rule-based pipeline in core/prediction.js. Real ML model
 * adapter arrives later behind the same facade.
 */
export function predictHarvestReadiness(ctx: unknown): PredictionResult {
  try {
    const pred = _predictAction(ctx as never);
    return Object.freeze({
      confidence: (pred?.confidence || 'low') as PredictionConfidence,
      note:       pred?.note || undefined,
    });
  } catch {
    return Object.freeze({ confidence: 'low' });
  }
}

/**
 * Disease-risk prediction. Delegates to the existing rule-based
 * risk estimator until a richer model is wired.
 */
export function predictDiseaseRisk(ctx: unknown): PredictionResult {
  try {
    const risk = _estimateRisk(ctx as never);
    return Object.freeze({
      confidence: (risk?.confidence || 'low') as PredictionConfidence,
      note:       risk?.note || undefined,
    });
  } catch {
    return Object.freeze({ confidence: 'low' });
  }
}

/**
 * Weather-impact prediction. Today returns 'low' — the orchestrator
 * already weights weather signals via its own ladder, so this
 * facade is a placeholder for future granular forecasting.
 */
export function predictWeatherImpact(_ctx: unknown): PredictionResult {
  if (!isPredictionEnabled()) return Object.freeze({ confidence: 'low' });
  return Object.freeze({ confidence: 'low' });
}

/** Irrigation-timing prediction stub. */
export function predictIrrigationWindow(_ctx: unknown): PredictionResult {
  if (!isPredictionEnabled()) return Object.freeze({ confidence: 'low' });
  return Object.freeze({ confidence: 'low' });
}

/** Growth-stage prediction stub. */
export function predictGrowthProgression(_ctx: unknown): PredictionResult {
  if (!isPredictionEnabled()) return Object.freeze({ confidence: 'low' });
  return Object.freeze({ confidence: 'low' });
}

/** Generic task-prediction stub. */
export function predictNextTask(ctx: unknown): PredictionResult {
  return predictHarvestReadiness(ctx);
}

export default Object.freeze({
  isPredictionEnabled,
  predictHarvestReadiness,
  predictDiseaseRisk,
  predictWeatherImpact,
  predictIrrigationWindow,
  predictGrowthProgression,
  predictNextTask,
});
