/**
 * yieldPredictionEngine.js — spec-named facade at src/core/yield/.
 *
 *   import { predictYield } from 'src/core/yield/yieldPredictionEngine.js';
 *
 * The Phase 2 spec names this file `yieldPredictionEngine.js`. The
 * actual hedged-range implementation lives at
 * `src/core/intelligence/yieldForecastEngine.js#estimateYield`.
 * This facade is a thin re-export under the spec-named path and
 * provides a `predictYield` alias that matches the spec verb.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

import { estimateYield } from '../intelligence/yieldForecastEngine.js';

export { estimateYield };

/**
 * Alias matching the spec verb.
 * @param {object} ctx
 * @returns {object}
 */
export function predictYield(ctx) {
  try { return estimateYield(ctx); }
  catch {
    return { ok: false, reason: 'exception', confidenceLabel: 'low', isEstimate: true };
  }
}

const _module = { estimateYield, predictYield };
export default _module;
