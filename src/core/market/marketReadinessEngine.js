/**
 * marketReadinessEngine.js — light-version harvest-to-market
 * transition (Phase §5).
 *
 *   import { computeMarketReadiness, READINESS_STATE,
 *            buildBasicListingDraft }
 *     from 'src/core/market/marketReadinessEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure helper that combines harvest readiness (from the
 *   already-shipped `harvestReadinessEngine`) with the listing
 *   trust signals (from `listingTrustSignals`) to produce ONE
 *   "is this ready to list?" view and a draft listing object the
 *   surface can review.
 *
 *   It does NOT (per spec):
 *     • build payments / escrow
 *     • route delivery / logistics
 *     • run bidding or auctions
 *     • promise prices
 *
 *   It simply tells the farmer "your tomato is in the ready
 *   window, here's a draft listing — review it" and trusts a
 *   human to do the actual selling.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Honest wording — no faked price, no guaranteed sale.
 */

import { computeHarvestReadiness, READINESS_LABEL } from '../intelligence/harvestReadinessEngine.js';
import { computeListingTrustSignals, LISTING_DISCLAIMER } from '../marketplace/listingTrustSignals.js';

export const READINESS_STATE = Object.freeze({
  NOT_READY:    'not_ready',
  APPROACHING:  'approaching',
  READY:        'ready',
  PAST:         'past',
  UNKNOWN:      'unknown',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _mapHarvestToState(label) {
  switch (label) {
    case READINESS_LABEL.TOO_EARLY:    return READINESS_STATE.NOT_READY;
    case READINESS_LABEL.MATURING:     return READINESS_STATE.APPROACHING;
    case READINESS_LABEL.READY_WINDOW: return READINESS_STATE.READY;
    case READINESS_LABEL.OVERDUE:      return READINESS_STATE.PAST;
    default:                           return READINESS_STATE.UNKNOWN;
  }
}

const STATE_MSG = Object.freeze({
  not_ready:    { key: 'market.state.not_ready',    fallback: '{crop} is still growing — too early to list.' },
  approaching:  { key: 'market.state.approaching',  fallback: '{crop} is approaching harvest — start planning the listing.' },
  ready:        { key: 'market.state.ready',        fallback: '{crop} may be ready — review the draft listing.' },
  past:         { key: 'market.state.past',         fallback: '{crop} is past the usual window — pick and store soon.' },
  unknown:      { key: 'market.state.unknown',      fallback: 'Add a planting date to estimate market readiness.' },
});

/**
 * Compute the market-readiness view for a crop.
 *
 * @param {object} args
 * @param {string} args.crop
 * @param {string|number|Date} [args.plantingDate]
 * @param {object} [args.weather]
 * @param {object} [args.listing]      partial listing draft (title, photo, …)
 * @param {object} [args.context]      { lastScanAt, sellerActiveDays, expectedHarvestDate }
 * @param {number} [args.estimatedQuantityKg]
 * @returns {object}
 */
export function computeMarketReadiness(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const crop = a.crop || null;
    if (!crop) {
      return Object.freeze({
        ok: false, reason: 'no_crop',
        state: READINESS_STATE.UNKNOWN,
        message: _msg(STATE_MSG.unknown.key, STATE_MSG.unknown.fallback, { crop: 'the plant' }),
        isEstimate: true,
        disclaimer: 'Pick a crop to see market guidance.',
      });
    }

    const harvest = computeHarvestReadiness({
      crop, plantingDate: a.plantingDate, weather: a.weather, nowMs: a.nowMs,
    });
    const state = _mapHarvestToState(harvest && harvest.readinessLabel);

    // Listing trust signals — feed in whatever the caller has so
    // far; missing values yield honest "low / unknown".
    const listing = (a.listing && typeof a.listing === 'object') ? a.listing : {};
    const ctx = (a.context && typeof a.context === 'object') ? a.context : {};
    const trust = computeListingTrustSignals(
      { ...listing, cropType: listing.cropType || crop, expectedHarvestDate: ctx.expectedHarvestDate || (harvest && harvest.earliest) || null },
      { lastScanAt: ctx.lastScanAt, sellerActiveDays: ctx.sellerActiveDays, nowMs: a.nowMs },
    );

    return Object.freeze({
      ok:                true,
      crop,
      state,
      message:           _msg(STATE_MSG[state].key, STATE_MSG[state].fallback, { crop }),
      harvest:           harvest && harvest.ok ? harvest : null,
      listingSignals:    trust,
      estimatedQuantityKg: Number.isFinite(Number(a.estimatedQuantityKg)) ? Number(a.estimatedQuantityKg) : null,
      readyForListing:   state === READINESS_STATE.READY || state === READINESS_STATE.APPROACHING,
      isEstimate:        true,
      disclaimer:        'Market guidance is an estimate — confirm details with buyers directly. No price guarantee.',
    });
  } catch {
    return Object.freeze({
      ok: false, reason: 'exception',
      state: READINESS_STATE.UNKNOWN,
      isEstimate: true,
      disclaimer: 'Market guidance is not available right now.',
    });
  }
}

/**
 * Build a BASIC listing draft from the readiness view. Surfaces
 * present this for the farmer to review and edit before posting.
 * Honest defaults — fields the caller hasn't supplied stay empty.
 *
 * @param {object} args
 * @param {string} args.crop
 * @param {number} [args.estimatedQuantityKg]
 * @param {string} [args.location]
 * @param {string} [args.harvestEarliest]
 * @param {string} [args.harvestLatest]
 * @returns {object} draft listing
 */
export function buildBasicListingDraft(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const crop = a.crop ? String(a.crop) : '';
    return Object.freeze({
      title:               crop ? `${crop} for sale` : '',
      cropType:            crop || null,
      description:         '',           // farmer fills in
      quantity:            Number.isFinite(Number(a.estimatedQuantityKg))
        ? `${Math.round(Number(a.estimatedQuantityKg) * 10) / 10} kg`
        : '',
      price:               '',           // farmer sets; NO suggestion
      location:            a.location || '',
      photo:               '',           // farmer uploads
      harvestEarliest:     a.harvestEarliest || null,
      harvestLatest:       a.harvestLatest || null,
      disclaimer:          LISTING_DISCLAIMER,
    });
  } catch {
    return Object.freeze({
      title: '', cropType: null, description: '', quantity: '',
      price: '', location: '', photo: '',
      harvestEarliest: null, harvestLatest: null,
      disclaimer: LISTING_DISCLAIMER,
    });
  }
}

const _module = {
  READINESS_STATE,
  computeMarketReadiness,
  buildBasicListingDraft,
};
export default _module;
