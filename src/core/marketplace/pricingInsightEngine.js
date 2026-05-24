/**
 * pricingInsightEngine.js — HONEST pricing band (never a fixed
 * price, never a guarantee).
 *
 *   import { pricingInsightFor, PRICING_TIER }
 *     from 'src/core/marketplace/pricingInsightEngine.js';
 *
 *   const p = pricingInsightFor({
 *     crop: 'tomato', region: 'ashanti',
 *     unit: 'kg',
 *     recentLocalPrices: [3.5, 4.0, 3.0, 4.2, 3.8],
 *   });
 *   // p.range          → { min, max, mid }   (numbers in local currency unit)
 *   // p.tier           → 'lower' | 'typical' | 'upper'
 *   // p.confidence     → 'low' | 'medium'    (NEVER 'high')
 *   // p.disclaimer     → { key, fallback }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small helper that takes recent local price observations
 *   (from the operator-curated weekly snapshot or the user's
 *   own past listings) and produces a WIDE range. Always shows
 *   the disclaimer envelope alongside the number.
 *
 *   It is NOT a live market data feed. It does NOT predict
 *   future prices. It does NOT guarantee a sale at the shown
 *   range. With fewer than 3 recent local observations it returns
 *   `{ ok: false, reason: 'not_enough_data' }` and the surface
 *   should fall back to "Check with local buyers."
 *
 *   Confidence is HARD-CAPPED at 'medium'. There is no trained
 *   pricing model — only a moving window of local observations.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const PRICING_TIER = Object.freeze({
  LOWER:   'lower',
  TYPICAL: 'typical',
  UPPER:   'upper',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

const _DISCLAIMER = Object.freeze(_msg(
  'marketplace.pricing.disclaimer',
  'Pricing is an estimate from recent local listings — actual sale price depends on quality, buyer, and timing.',
));

const _FALLBACK = Object.freeze(_msg(
  'marketplace.pricing.checkLocal',
  'Check with local buyers — we do not have enough recent data for a reliable range yet.',
));

function _numbers(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

function _median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Compute a pricing range from recent local observations.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function pricingInsightFor(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const prices = _numbers(c.recentLocalPrices);
    if (prices.length < 3) {
      return {
        ok: false,
        reason: 'not_enough_data',
        fallback: { ..._FALLBACK },
        disclaimer: { ..._DISCLAIMER },
      };
    }
    const med = _median(prices);
    // Range is +/- 25 % of median, widened further when the
    // raw observations themselves are noisy.
    const spread = Math.max(...prices) - Math.min(...prices);
    const noise  = spread > med * 0.6 ? 0.4 : 0.25;
    const min = Math.max(0, med * (1 - noise));
    const max = med * (1 + noise);
    const userPrice = Number(c.proposedPrice);
    let tier = PRICING_TIER.TYPICAL;
    if (Number.isFinite(userPrice)) {
      if (userPrice < min * 1.05) tier = PRICING_TIER.LOWER;
      else if (userPrice > max * 0.95) tier = PRICING_TIER.UPPER;
    }
    return {
      ok:          true,
      range:       { min: Math.round(min * 100) / 100,
                     max: Math.round(max * 100) / 100,
                     mid: Math.round(med * 100) / 100 },
      tier,
      sampleSize:  prices.length,
      unit:        c.unit || null,
      confidence:  prices.length >= 8 ? 'medium' : 'low',
      isEstimate:  true,
      disclaimer:  { ..._DISCLAIMER },
    };
  } catch {
    return {
      ok: false, reason: 'exception',
      fallback: { ..._FALLBACK },
      disclaimer: { ..._DISCLAIMER },
    };
  }
}

const _module = { PRICING_TIER, pricingInsightFor };
export default _module;
