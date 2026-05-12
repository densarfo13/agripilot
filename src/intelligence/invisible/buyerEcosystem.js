/**
 * buyerEcosystem.js — buyer-match + listing-readiness signals
 * (Invisible Intelligence spec §3).
 *
 *   const signal = computeBuyerEcosystem({
 *     crop, quantity, location, harvestDate,
 *     listingStatus, buyerInterest, verifiedBuyers,
 *   });
 *
 * Honest "no fake buyers" guarantee
 * ─────────────────────────────────
 *   The spec is explicit: "Do not expose buyer contact until
 *   verified." We extend that: do not fabricate buyer interest,
 *   match quality, or trust level when no real buyer pipeline
 *   data exists. The module surfaces ONLY listing-readiness
 *   signals derived from data we actually have on-device
 *   (the user's own listing state), and only that.
 *
 *   For the spec's outputs:
 *     • buyer match signal     — requires real buyer feed; quiet by default
 *     • listing readiness      — derived from listingStatus only
 *     • buyer trust level      — requires verified buyer registry; quiet
 *     • next action            — based on listing readiness only
 *
 *   When a real buyer marketplace exists (future spec round), this
 *   module gains active branches. Today, it only surfaces the
 *   listing-readiness half because that's the only piece we can
 *   honestly compute from on-device data.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • visibleToUser:false unless the caller passed real listing data
 *     AND there's an actionable hint to surface.
 *   • Buyer contact info is NEVER emitted in farmerMessage even
 *     when present in inputs — the field is parsed but not echoed.
 */

import { makeQuietFallback, makeActiveSignal } from './moduleShape.js';

const SOURCE = 'buyerEcosystem';
const QUIET_MESSAGE = 'Buyer matching will improve when the marketplace is connected.';

function _str(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

export function computeBuyerEcosystem(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const crop = _str(safe.crop);
  const quantity = (typeof safe.quantity === 'number' && Number.isFinite(safe.quantity))
    ? safe.quantity : null;
  const listingStatus = _str(safe.listingStatus);

  // Listing readiness — the ONE branch we can honestly compute
  // without a real buyer feed. Surface a calm hint when the user
  // has a harvest-stage indicator but no listing yet.
  if (crop && quantity && (!listingStatus || listingStatus === 'draft' || listingStatus === 'none')) {
    return makeActiveSignal({
      signal:           'listing_ready',
      confidence:       'medium',
      farmerMessage:    `Your ${crop} could be listed when you're ready to sell.`,
      recommendedAction: 'Create listing when ready',
      urgency:          'low',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // Listing active — calm acknowledgement, NO buyer fabrication.
  if (listingStatus === 'active') {
    return makeActiveSignal({
      signal:           'listing_active',
      confidence:       'medium',
      farmerMessage:    'Your listing is active. We will notify you when verified buyers show interest.',
      recommendedAction: null,
      urgency:          'low',
      source:           SOURCE,
      visibleToUser:    true,
    });
  }

  // Default — quiet fallback. No fake buyers.
  return makeQuietFallback(SOURCE, QUIET_MESSAGE);
}

export default { computeBuyerEcosystem };
