/**
 * yieldPrediction.js — Phase 3 stub.
 *
 * STATUS: STUB ARCHITECTURE-READY. NOT imported anywhere. Existing
 * yield logic at:
 *   src/core/yield/yieldPredictionEngine.js
 *   src/lib/intelligence/yieldPredictionEngine.js
 * will be consolidated behind this entrypoint when the wiring PR
 * lands. Until then the stub provides a stable shape for new
 * consumers.
 *
 * Output shape:
 *
 *   {
 *     expectedYieldRange: { min, max, unit } | null,
 *     confidence:         number,    // 0..1
 *     limitingFactors:    string[],  // i18n keys
 *     improvementActions: string[],  // i18n keys
 *     methodology:        string | null,
 *   }
 */

export function buildYieldPrediction(input = {}) {
  return Object.freeze({
    expectedYieldRange: null,
    confidence:         0,
    limitingFactors:    [],
    improvementActions: [],
    methodology:        null,
    _input:             input,
    _version:           YIELD_PREDICTION_VERSION,
  });
}

export const YIELD_PREDICTION_VERSION = '0.1.0-stub';
