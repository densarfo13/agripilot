/**
 * soilIntelligence.js — Phase 3 stub.
 *
 * STATUS: STUB ARCHITECTURE-READY. Returns the documented shape
 * with placeholder values. NOT imported anywhere. No network
 * calls. Existing soil logic at:
 *   src/core/soil/soilIntelligenceEngine.js
 *   src/lib/soilIntelligence.js
 * will be consolidated behind this entrypoint when product
 * activates it. Until then this is a dead file with a stable
 * interface for future consumers to code against.
 *
 * Output shape (stable contract):
 *
 *   {
 *     moistureLevel:    number | null,    // 0..1
 *     phEstimate:       number | null,    // 0..14
 *     nutrientRisk:     'none'|'low'|'medium'|'high'|null,
 *     recommendationKey: string | null,   // i18n key
 *     confidence:       number,            // 0..1
 *     factors:          { reason: string }[],
 *   }
 */

export function buildSoilIntelligence(input = {}) {
  return Object.freeze({
    moistureLevel:    null,
    phEstimate:       null,
    nutrientRisk:     null,
    recommendationKey: null,
    confidence:       0,
    factors:          [],
    _input:           input,
    _version:         SOIL_INTELLIGENCE_VERSION,
  });
}

export const SOIL_INTELLIGENCE_VERSION = '0.1.0-stub';
