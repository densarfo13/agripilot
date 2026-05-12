/**
 * marketIntelligence.js — sell timing + demand signals for the
 * Invisible Intelligence Architecture (spec §2).
 *
 *   const signal = computeMarketIntelligence({
 *     cropType, region, harvestStage, listings, priceFeed, history,
 *   });
 *   if (signal.visibleToUser) showHomeHint(signal.farmerMessage);
 *
 * Honest "no fake data" guarantee
 * ───────────────────────────────
 *   The spec is explicit: "If no real market data: show no fake
 *   price. Return: 'Market insights will improve after local price
 *   data is connected.'"
 *
 *   We don't have a live price feed today. So this module ALWAYS
 *   returns a quiet fallback (visibleToUser:false) unless the
 *   caller explicitly passes priceFeed data with at least one
 *   valid price observation. We never invent a price, a demand
 *   level, or a trend.
 *
 *   When real price data arrives (future spec round), this module
 *   composes:
 *     • sell-timing signal     (now / this week / next week)
 *     • demand level           (strong / steady / weak)
 *     • price trend            (rising / stable / falling)
 *
 *   For now, even with real data we lean toward the cautious
 *   spec language: "Demand for tomatoes looks strong this week",
 *   never percentages, never absolute prices.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • visibleToUser:false unless ALL of: priceFeed has data,
 *     cropType is non-null, region is non-null. Anything missing
 *     → quiet fallback. No fake signals.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'marketIntelligence';
const QUIET_MESSAGE = 'Market insights will improve after local price data is connected.';

function _str(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _hasValidPriceFeed(feed) {
  if (!feed) return false;
  if (Array.isArray(feed)) {
    return feed.length > 0 && feed.some((p) => p && typeof p === 'object'
      && typeof p.observedAt === 'string'
      && (typeof p.priceLow === 'number' || typeof p.priceHigh === 'number'));
  }
  if (typeof feed === 'object') {
    return Array.isArray(feed.observations) && feed.observations.length > 0;
  }
  return false;
}

export function computeMarketIntelligence(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const crop   = _str(safe.cropType);
  const region = _str(safe.region);

  // ── Trust + Safety: no real data → quiet fallback ───────────
  if (!_hasValidPriceFeed(safe.priceFeed) || !crop || !region) {
    return makeQuietFallback(SOURCE, QUIET_MESSAGE);
  }

  // ── Active signal path (future) ─────────────────────────────
  // When a real price feed exists, derive demand + trend from it.
  // We DELIBERATELY do not compose anything quantitative here —
  // until a price-feed integration is built, this branch returns
  // the quiet fallback. The shape is ready.
  return makeQuietFallback(SOURCE, QUIET_MESSAGE);
}

export default { computeMarketIntelligence };
