/**
 * supplierMatcher.js — picks the best-fit supplier(s) for a given
 * context (crop / stage / need / region).
 *
 *   import { matchSuppliers } from 'src/core/suppliers/supplierMatcher.js';
 *
 *   const m = matchSuppliers({
 *     crop: 'tomato', region: 'ashanti',
 *     categories: ['stakes', 'compost'],
 *     country: 'GH', max: 3,
 *   });
 *   // → [{ supplier, score, trust }]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure ranker. Takes the registry (or any supplier list) and
 *   the current operating context; returns the most-relevant
 *   entries with a score + trust label envelope.
 *
 *   It does NOT decide WHETHER to show suppliers (the surface
 *   does, per the §5 placement rules in the spec). It does NOT
 *   contact suppliers. It does NOT make trust claims beyond what
 *   supplierTrustRules issues.
 *
 *   Empty results are normal — when no supplier in the registry
 *   matches the context, the surface MUST fall back to the
 *   FALLBACK_MESSAGE envelope from supplierTrustRules.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { listSuppliers, SUPPLIER_STATUS } from './supplierRegistry.js';
import { trustLabelFor, isSafeToShow } from './supplierTrustRules.js';

const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _scoreSupplier(supplier, ctx) {
  let score = 0;
  // Region match — strongest signal.
  if (ctx.region && supplier.region === ctx.region) score += 40;
  // Country match — weaker but still positive.
  if (ctx.country && supplier.country === ctx.country) score += 20;
  // Crop match — supplier explicitly lists the crop.
  if (ctx.crop && Array.isArray(supplier.cropsSupported)
      && supplier.cropsSupported.includes(ctx.crop)) score += 25;
  // Category overlap — count matching categories.
  if (Array.isArray(ctx.categories) && Array.isArray(supplier.categories)) {
    const overlap = ctx.categories.filter((c) => supplier.categories.includes(c)).length;
    score += overlap * 15;
  }
  // Verification bonus — verified suppliers ALWAYS outrank
  // unverified at equal context match.
  if (supplier.verifiedStatus === SUPPLIER_STATUS.VERIFIED) score += 30;
  // Distance penalty (smaller = closer).
  const d = Number(supplier.distanceEstimate);
  if (Number.isFinite(d)) score -= Math.min(d, 100) * 0.1;
  return score;
}

/**
 * Match suppliers to context.
 *
 * @param {object} ctx
 * @param {string} [ctx.crop]
 * @param {string} [ctx.region]
 * @param {string} [ctx.country]
 * @param {Array<string>} [ctx.categories]
 * @param {number} [ctx.max=3]
 * @param {Array<object>} [ctx.suppliers]  override the registry
 * @returns {Array<{supplier:object, score:number, trust:object}>}
 */
export function matchSuppliers(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const max = Math.max(1, Math.min(10, Number(c.max) || 3));
    const pool = Array.isArray(c.suppliers) ? c.suppliers : listSuppliers({
      country: c.country, region: c.region,
    });

    const ranked = pool
      .filter(isSafeToShow)
      .map((s) => ({ supplier: { ...s }, score: _scoreSupplier(s, c) }))
      // Keep entries that gained ANY positive context score, OR
      // are verified (verified-only fallback when context is
      // sparse).
      .filter((r) => r.score > 0 || r.supplier.verifiedStatus === SUPPLIER_STATUS.VERIFIED)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((r) => ({
        ...r,
        trust: trustLabelFor(r.supplier),
      }));

    return ranked;
  } catch { return []; }
}

const _module = { matchSuppliers };
export default _module;
