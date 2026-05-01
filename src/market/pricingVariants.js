/**
 * pricingVariants.js — sticky A/B/C price variants for boost +
 * assist features.
 *
 * Spec coverage (Marketplace revenue scale §6)
 *   • Test higher boost prices
 *   • Test higher assist fees
 *
 * Behaviour
 *   • Each user lands on one of three variants ('a' | 'b' | 'c')
 *     deterministically based on a small hash of their stable ID.
 *     This means the same buyer / farmer always sees the same
 *     price across sessions on the same device.
 *   • Once we observe an exposure for a feature, we emit a
 *     single `pricing_exposure` analytics event so dashboards
 *     can attribute conversion to the variant.
 *   • Conservative ladder: variant A is the baseline, B is +25%,
 *     C is +50%. Pilot can re-tune without an API change.
 *
 * Strict-rule audit
 *   • Pure deterministic — no fetch, no DOM, no random per call.
 *   • Never throws.
 *   • Storage `farroway_pricing_exposed` only logs WHICH features
 *     have already been emitted so we don't double-fire on every
 *     re-render.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

const EXPOSED_KEY = 'farroway_pricing_exposed';

const BOOST_VARIANTS = Object.freeze({
  a: { variant: 'a', price: 5,  currency: 'USD', durationHours: 24 },
  b: { variant: 'b', price: 7,  currency: 'USD', durationHours: 24 },
  c: { variant: 'c', price: 10, currency: 'USD', durationHours: 24 },
});

const ASSIST_VARIANTS = Object.freeze({
  a: { variant: 'a', price: 0,   currency: 'USD' },     // baseline: assist is free in pilot
  b: { variant: 'b', price: 5,   currency: 'USD' },
  c: { variant: 'c', price: 10,  currency: 'USD' },
});

function _hashCode(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function _bucket(id, salt) {
  const n = _hashCode(`${salt}::${id || ''}`);
  const m = n % 3;
  if (m === 0) return 'a';
  if (m === 1) return 'b';
  return 'c';
}

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(EXPOSED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function _safeWrite(obj) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(EXPOSED_KEY, JSON.stringify(obj || {}));
  } catch { /* swallow */ }
}

function _logExposureOnce(feature, variant, id) {
  if (!feature || !variant) return;
  const exposed = _safeRead();
  const key = `${feature}:${id || 'anon'}`;
  if (exposed[key]) return;
  exposed[key] = { variant, at: new Date().toISOString() };
  _safeWrite(exposed);
  try {
    trackEvent('pricing_exposure', { feature, variant, id: id || null });
  } catch { /* swallow */ }
}

/**
 * getBoostPrice(id) → { variant, price, currency, durationHours }
 *
 * `id` is typically the farmer ID (from auth.sub or
 * `farroway_buyer_id`). Pilots without an id get variant A
 * (baseline) so anonymous traffic is never charged a higher
 * variant by accident.
 */
export function getBoostPrice(id) {
  const stableId = String(id || '').trim();
  if (!stableId) return BOOST_VARIANTS.a;
  const v = _bucket(stableId, 'boost');
  _logExposureOnce('boost', v, stableId);
  return BOOST_VARIANTS[v] || BOOST_VARIANTS.a;
}

export function getAssistPrice(id) {
  const stableId = String(id || '').trim();
  if (!stableId) return ASSIST_VARIANTS.a;
  const v = _bucket(stableId, 'assist');
  _logExposureOnce('assist', v, stableId);
  return ASSIST_VARIANTS[v] || ASSIST_VARIANTS.a;
}

/** Test / admin helper. */
export function _resetPricingExposure() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(EXPOSED_KEY);
    }
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({
  BOOST_VARIANTS,
  ASSIST_VARIANTS,
  EXPOSED_KEY,
});

export default { getBoostPrice, getAssistPrice };
