/**
 * marketAnalytics.js — thin wrapper over `trackEvent` that auto-
 * attaches the user's active market id.
 *
 * Spec coverage (Multi-market expansion §6)
 *   • Track per region: users, listings, transactions
 *
 * Pattern
 *   trackMarketEvent('listing_created', { listingId, crop }) →
 *     trackEvent('listing_created', { listingId, crop, marketId: 'GH' })
 *
 *   The dashboard groups by `marketId` so each market gets its
 *   own funnel without forcing surfaces to compute the id at
 *   every callsite.
 *
 * Storage
 *   Reads `farroway_active_market` (the manual-override stamp)
 *   and the user's profile + active farm via the resolver.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • No-op if `trackEvent` is unavailable.
 *   • Stable id contract: surfaces calling this helper are
 *     guaranteed to land on the same market id as the resolver
 *     used elsewhere.
 */

import { trackEvent } from '../analytics/analyticsStore.js';
import { resolveActiveMarketId } from './marketResolver.js';

function _safeReadJson(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function _resolveCurrentMarketId() {
  try {
    return resolveActiveMarketId({
      profile:    _safeReadJson('farroway_user_profile') || {},
      activeFarm: _safeReadJson('farroway_active_farm'),
    });
  } catch { return null; }
}

/**
 * trackMarketEvent(name, payload?) — fires `trackEvent` with
 * `marketId` auto-merged into the payload. Pass `marketId`
 * explicitly in the payload to override (e.g. server-driven
 * events that already know the market).
 */
export function trackMarketEvent(name, payload = {}) {
  if (!name) return;
  const merged = { ...(payload || {}) };
  if (!merged.marketId) {
    const id = _resolveCurrentMarketId();
    if (id) merged.marketId = id;
  }
  try { trackEvent(name, merged); }
  catch { /* swallow */ }
}

export default { trackMarketEvent };
