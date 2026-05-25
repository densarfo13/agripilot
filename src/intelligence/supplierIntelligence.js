/**
 * supplierIntelligence.js — Phase 3 stub.
 *
 * STATUS: STUB ARCHITECTURE-READY. NOT imported anywhere. Entrypoint
 * for "what inputs should this farmer buy + where is it available
 * nearby". Future wire: pull supplier directory + farm context +
 * stage to suggest matched inputs.
 *
 * Output shape:
 *
 *   {
 *     suggestedInputs:    SuggestedInput[],
 *     reason:             string | null,    // dev-only label
 *     nearbyAvailability: { supplierName, distanceKm, stockState }[],
 *     confidence:         number,            // 0..1
 *   }
 *
 * @typedef {object} SuggestedInput
 * @property {string} categoryKey    i18n key for category label
 * @property {string} productNameKey i18n key for product label
 * @property {string} reasonKey      i18n key for "why this input"
 */

export function buildSupplierIntelligence(input = {}) {
  return Object.freeze({
    suggestedInputs:    [],
    reason:             null,
    nearbyAvailability: [],
    confidence:         0,
    _input:             input,
    _version:           SUPPLIER_INTELLIGENCE_VERSION,
  });
}

export const SUPPLIER_INTELLIGENCE_VERSION = '0.1.0-stub';
