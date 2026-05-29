/**
 * runtime/grow/flowerMarketplaceGate.js — Phase 10 marketplace
 * gate.
 *
 *   import {
 *     flowerMarketplaceState,
 *     FLOWER_MARKETPLACE_VERSION,
 *     FLOWER_MARKETPLACE_CATEGORIES,
 *   } from 'src/runtime/grow/flowerMarketplaceGate.js';
 *
 * Why this exists as a GATE, not a working marketplace
 * ────────────────────────────────────────────────────
 *   The standing strict-rule says DO NOT build marketplace.
 *   The wave-8 App Store safety mode forces marketplace flags
 *   OFF in the native shell. So Phase 10 ships only the SHAPE
 *   of flower-marketplace state — categories, listing envelope,
 *   buyer-channel constants — with the marketplace itself
 *   default-gated.
 *
 *   The engine returns a null envelope reading:
 *     reason: 'marketplace_gated'
 *   unless the caller explicitly passes ungatedFlag:true
 *   (engineering / QA only — never wired to production UI).
 *
 *   When backend + App Store policy clear marketplace, this is
 *   the single chokepoint that flips on. The shape is stable so
 *   future work is composition, not replacement.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Marketplace gated CLOSED by default.
 *   • No persistence writes. No fetch.
 *   • No PII surfaced.
 */

export const FLOWER_MARKETPLACE_VERSION = 'flower-marketplace-v1';

export const FLOWER_MARKETPLACE_CATEGORIES = Object.freeze([
  'roses', 'lavender', 'sunflowers', 'tulips', 'marigolds',
]);

export const FLOWER_BUYER_CHANNELS = Object.freeze([
  'florists', 'landscapers', 'garden_centers',
]);

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _nullEnvelope(reason) {
  return Object.freeze({
    runtimeVersion: FLOWER_MARKETPLACE_VERSION,
    ok: false, reason,
    categories: FLOWER_MARKETPLACE_CATEGORIES,
    buyerChannels: FLOWER_BUYER_CHANNELS,
    listings: Object.freeze([]),
    deferred: Object.freeze({
      marketplaceUx:
        'wave-8 App Store safety mode forces marketplace flags '
        + 'OFF in the native shell; no UI for sell-flowers ships '
        + 'in RC1',
      backendListings:
        'no marketplace listing backend yet; envelope shape is '
        + 'stable for future composition',
      payments:
        'payment + escrow services not wired',
    }),
  });
}

export function flowerMarketplaceState(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    if (!c.ungatedFlag) return _nullEnvelope('marketplace_gated');

    // Even when ungated, this engine only describes the local
    // listing intent — actual marketplace network operations are
    // gated by the strict rule that this code base cannot make
    // external service calls from the UI layer.
    const myListings = _safe(() =>
      (Array.isArray(c.myListings) ? c.myListings : [])
        .filter(_isObj)
        .map((l) => Object.freeze({
          category:   _isObj(l) ? l.category : '',
          quantity:   _isObj(l) ? l.quantity : null,
          unit:       _isObj(l) ? l.unit : '',
          createdAt:  _isObj(l) ? l.createdAt : '',
          status:     'draft', // never beyond draft locally
        })), []);

    return Object.freeze({
      runtimeVersion: FLOWER_MARKETPLACE_VERSION,
      ok: true, reason: 'ungated_dev',
      categories:    FLOWER_MARKETPLACE_CATEGORIES,
      buyerChannels: FLOWER_BUYER_CHANNELS,
      listings:      Object.freeze(myListings),
      deferred: Object.freeze({
        backendListings:
          'local-only listing drafts; backend listing service '
          + 'has not been built',
      }),
    });
  }, _nullEnvelope('error'));
}
