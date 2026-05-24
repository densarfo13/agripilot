/**
 * soilRecommendationEngine.js — guidance-only facade over the
 * soil intelligence engine.
 *
 *   import { soilRecommendationsFor }
 *     from 'src/core/soil/soilRecommendationEngine.js';
 *
 *   const r = soilRecommendationsFor({ crop, stage, soil, weather, scan });
 *   // r.guidance         → [{ key, fallback, params }]
 *   // r.recommendedCheck → { key, fallback, params } | null
 *
 * Why a facade?
 *   The Phase 2 spec asks for a `soilRecommendationEngine.js`
 *   file. Reasoning lives in `soilIntelligenceEngine.js` — this
 *   re-exports just the guidance subset so callers that don't
 *   need the risk breakdown stay slim.
 *
 * Strict-rule audit
 *   • Pure. Never throws.
 */

import { analyzeSoilContext } from './soilIntelligenceEngine.js';

/**
 * @param {object} ctx
 * @returns {{ guidance, recommendedCheck, disclaimer, confidence }}
 */
export function soilRecommendationsFor(ctx) {
  try {
    const s = analyzeSoilContext(ctx);
    return {
      guidance:         Array.isArray(s.safeGuidance) ? s.safeGuidance.slice() : [],
      recommendedCheck: s.recommendedCheck || null,
      disclaimer:       s.disclaimer || null,
      confidence:       s.confidence || 'low',
      isEstimate:       true,
    };
  } catch {
    return {
      guidance: [], recommendedCheck: null, disclaimer: null,
      confidence: 'low', isEstimate: true,
    };
  }
}

const _module = { soilRecommendationsFor };
export default _module;
