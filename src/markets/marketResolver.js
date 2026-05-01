/**
 * marketResolver.js — resolves the user's active market from
 * detected/saved location + a manual override stamp.
 *
 * Spec coverage (Multi-market expansion §5)
 *   • Auto location detection
 *   • Manual override
 *
 * Resolution chain
 *   1. Manual override (`farroway_active_market`) — wins if set.
 *   2. profile.country / activeFarm.country → market id via
 *      catalog COUNTRY_TO_ID.
 *   3. Default focus from `growthRegion.getGrowthRegion()`.
 *   4. Final fallback: 'GH' (the pilot's primary market).
 *
 * Storage
 *   farroway_active_market : 'GH' | 'KE' | 'NG' | 'TZ' | 'IN' | 'US'
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Idempotent — returns the same id for the same inputs.
 *   • Emits `farroway:active_market_changed` so subscribed
 *     surfaces refresh on cross-tab + same-tab changes.
 */

import { trackEvent } from '../analytics/analyticsStore.js';
import { getMarket, getMarketIdByCountry, listMarkets } from './marketCatalog.js';
import { getGrowthRegion } from '../growth/growthRegion.js';

export const ACTIVE_MARKET_KEY = 'farroway_active_market';
const CHANGE_EVENT = 'farroway:active_market_changed';
const FALLBACK_ID = 'GH';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACTIVE_MARKET_KEY);
  } catch { return null; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACTIVE_MARKET_KEY, String(value || '').toUpperCase());
  } catch { /* swallow */ }
}

function _emit(id) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const ev = (typeof CustomEvent === 'function')
        ? new CustomEvent(CHANGE_EVENT, { detail: { id } })
        : new Event(CHANGE_EVENT);
      window.dispatchEvent(ev);
    }
  } catch { /* swallow */ }
}

/** Returns the manual-override market id, or null. */
export function getOverrideMarketId() {
  const raw = String(_safeRead() || '').toUpperCase();
  if (!raw) return null;
  return getMarket(raw) ? raw : null;
}

/**
 * resolveActiveMarketId({ profile, activeFarm }) → market id
 * Always returns a valid id.
 */
export function resolveActiveMarketId({ profile = {}, activeFarm = null } = {}) {
  const override = getOverrideMarketId();
  if (override) return override;

  const country =
    activeFarm?.country
    || activeFarm?.location?.country
    || profile?.country
    || '';
  const fromCountry = getMarketIdByCountry(country);
  if (fromCountry && getMarket(fromCountry)) return fromCountry;

  // Pilot focus fallback.
  try {
    const focus = getGrowthRegion();
    const focusId = getMarketIdByCountry(focus?.country);
    if (focusId && getMarket(focusId)) return focusId;
  } catch { /* swallow */ }

  return FALLBACK_ID;
}

/** Convenience: returns the full market object. */
export function resolveActiveMarket(args) {
  return getMarket(resolveActiveMarketId(args));
}

/** Manually pin an active market (settings / switcher). */
export function setActiveMarketId(id, { source = 'manual' } = {}) {
  const next = String(id || '').toUpperCase();
  if (!getMarket(next)) return null;
  _safeWrite(next);
  try { trackEvent('market_switched', { id: next, source }); }
  catch { /* swallow */ }
  _emit(next);
  return next;
}

/** Clear the manual override (revert to auto-resolution). */
export function clearMarketOverride() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACTIVE_MARKET_KEY);
    }
  } catch { /* swallow */ }
  _emit(null);
}

/** Stable list of all available markets, for switcher dropdowns. */
export function getAllMarkets() {
  return listMarkets();
}

export const ACTIVE_MARKET_CHANGED_EVENT = CHANGE_EVENT;

export default {
  ACTIVE_MARKET_KEY,
  ACTIVE_MARKET_CHANGED_EVENT,
  getOverrideMarketId,
  resolveActiveMarketId,
  resolveActiveMarket,
  setActiveMarketId,
  clearMarketOverride,
  getAllMarkets,
};
