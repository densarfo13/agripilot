/**
 * soilRiskEngine.js — risk-only facade over soilIntelligenceEngine.
 *
 *   import { computeSoilRisks } from 'src/core/soil/soilRiskEngine.js';
 *
 *   const r = computeSoilRisks({ crop, stage, soil, weather, scan });
 *   // r.soilRisk / r.drainageRisk / r.moistureRisk / r.nutrientRisk
 *
 * Why a facade?
 *   The Phase 2 spec asks for a `soilRiskEngine.js` file
 *   specifically. The actual reasoning lives in
 *   `soilIntelligenceEngine.js` (one implementation, one source
 *   of truth). This facade re-exports just the risk subset so
 *   callers that only care about risk levels don't pull the
 *   full envelope.
 *
 * Strict-rule audit
 *   • Pure. Never throws.
 */

import { analyzeSoilContext, SOIL_RISK } from './soilIntelligenceEngine.js';

export { SOIL_RISK };

/**
 * Project the analyzeSoilContext output to its risk-only subset.
 *
 * @param {object} ctx
 * @returns {{ soilRisk, drainageRisk, moistureRisk, nutrientRisk, confidence }}
 */
export function computeSoilRisks(ctx) {
  try {
    const s = analyzeSoilContext(ctx);
    return {
      soilRisk:     s.soilRisk,
      drainageRisk: s.drainageRisk,
      moistureRisk: s.moistureRisk,
      nutrientRisk: s.nutrientRisk,
      confidence:   s.confidence,
      isEstimate:   true,
    };
  } catch {
    return {
      soilRisk:     SOIL_RISK.UNKNOWN,
      drainageRisk: SOIL_RISK.UNKNOWN,
      moistureRisk: SOIL_RISK.UNKNOWN,
      nutrientRisk: SOIL_RISK.UNKNOWN,
      confidence:   'low',
      isEstimate:   true,
    };
  }
}

const _module = { SOIL_RISK, computeSoilRisks };
export default _module;
