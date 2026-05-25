/**
 * marketplaceAdapter.js — feature-flagged marketplace adapter.
 *
 *   import { fetchMarketplace, isMarketplaceAdapterEnabled }
 *     from 'src/core/intelligence/adapters/marketplaceAdapter.js';
 *
 * Returns buyer-interest + readiness signals from the existing
 * marketplace engines. Flag-OFF returns an empty record.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { isFeatureEnabled, FEATURE } from '../../../config/featureFlags.js';
import { computeMarketReadiness } from '../../marketplace/marketReadinessEngine.js';
import { computeBuyerSignals } from '../../marketplace/buyerSignalEngine.js';
import { pricingInsightFor } from '../../marketplace/pricingInsightEngine.js';

export function isMarketplaceAdapterEnabled() {
  try { return isFeatureEnabled(FEATURE.MARKETPLACE_INTELLIGENCE); }
  catch { return false; }
}

/**
 * @param {object} [ctx]
 * @returns {Promise<object>}
 */
export async function fetchMarketplace(ctx) {
  try {
    if (!isMarketplaceAdapterEnabled()) {
      return {
        ok: false, reason: 'disabled',
        readiness: null, buyerSignals: null, pricing: null,
      };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const readiness = (() => {
      try { return computeMarketReadiness(c); }
      catch { return null; }
    })();
    const buyerSignals = (() => {
      try { return computeBuyerSignals(c); }
      catch { return null; }
    })();
    const pricing = (() => {
      try { return pricingInsightFor(c); }
      catch { return null; }
    })();
    return { ok: true, readiness, buyerSignals, pricing };
  } catch {
    return {
      ok: false, reason: 'exception',
      readiness: null, buyerSignals: null, pricing: null,
    };
  }
}

const _module = { fetchMarketplace, isMarketplaceAdapterEnabled };
export default _module;
