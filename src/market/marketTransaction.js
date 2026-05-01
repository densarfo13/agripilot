/**
 * marketTransaction.js — state machine + message templates +
 * stale-interest detection for the marketplace transaction flow.
 *
 * Spec coverage (Improve transaction flow §1, §3, §4, §5)
 *   §1 interest count surfaced to the farmer
 *   §3 prefilled messages (buyer→farmer + farmer→buyer)
 *   §4 listing status: interested | contacted | negotiating | sold
 *   §5 nudge system: stale interest detection
 *
 * Status state machine
 *
 *     interested ── Contact buyer ──▶ contacted
 *                                          │
 *                                          ▼
 *                              Mark negotiating ──▶ negotiating
 *                                                          │
 *                                                          ▼
 *                                                Accept ──▶ sold
 *
 *   Farmer can also Accept directly from `interested` /
 *   `contacted` to skip the middle. Once the status reaches
 *   `sold`, no further transitions are allowed.
 *
 * Strict-rule audit
 *   • Pure module — no DOM access; safe to import from anywhere.
 *   • Never throws.
 *   • All visible message strings via tStrict (the templates
 *     here only orchestrate the keys; the resolver in the caller
 *     does the localization).
 */

import { tStrict } from '../i18n/strictT.js';
import { updateInterestStatus, getBuyerInterests } from './marketStore.js';
import { trackEvent } from '../analytics/analyticsStore.js';

export const INTEREST_STATUS = Object.freeze({
  INTERESTED:  'interested',
  CONTACTED:   'contacted',
  NEGOTIATING: 'negotiating',
  SOLD:        'sold',
});

const TRANSITIONS = Object.freeze({
  interested:  ['contacted', 'negotiating', 'sold'],
  contacted:   ['negotiating', 'sold'],
  negotiating: ['sold'],
  sold:        [],
});

const TONES = Object.freeze({
  interested:  { color: '#86EFAC', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.32)' },
  contacted:   { color: '#7DD3FC', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.32)' },
  negotiating: { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.32)' },
  sold:        { color: 'rgba(255,255,255,0.78)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.22)' },
});

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;   // 24h

/** Returns the array of allowed next statuses. */
export function nextStatuses(current) {
  return TRANSITIONS[String(current || 'interested')] || [];
}

export function statusTone(status) {
  return TONES[String(status || 'interested')] || TONES.interested;
}

/** Localized status label. */
export function statusLabel(status) {
  const s = String(status || 'interested');
  return tStrict(
    `market.interest.status.${s}`,
    s.charAt(0).toUpperCase() + s.slice(1),
  );
}

/**
 * Move an interest to a new status. Validates the transition
 * against the state machine; ignores no-op transitions to keep
 * idempotency clean. Returns the updated record or null.
 */
export function transitionInterest(interestId, toStatus, opts = {}) {
  const allowed = ['interested', 'contacted', 'negotiating', 'sold'];
  if (!allowed.includes(toStatus)) return null;

  const interests = getBuyerInterests() || [];
  const current = interests.find((i) => i && i.id === interestId);
  if (!current) return null;

  const from = current.status || 'interested';
  if (from === toStatus) return current;       // idempotent
  // Allow forward-only transitions; the state machine never
  // walks backward (a farmer who taps Accept then changes their
  // mind closes a different listing entirely).
  const allowedNext = nextStatuses(from);
  if (!allowedNext.includes(toStatus)) return current;

  const updated = updateInterestStatus(interestId, {
    status: toStatus,
    farmerNote: opts.farmerNote || current.farmerNote || null,
  });
  try {
    trackEvent('farmer_interest_action', {
      interestId,
      listingId: current.listingId,
      from,
      to: toStatus,
    });
    // Marketplace monetization §5: emit `deal_closed` on the
    // sold transition. Mirrors the existing MARKET_LISTING_SOLD
    // emitted by markListingSold, so dashboards using either
    // name pick the close up.
    if (toStatus === 'sold') {
      trackEvent('deal_closed', {
        interestId,
        listingId: current.listingId,
      });
    }
  } catch { /* swallow */ }
  return updated;
}

/**
 * buildBuyerToFarmerMessage — prefilled template the BuyerInterest
 * form drops into the optional message field when empty.
 */
export function buildBuyerToFarmerMessage({ listing, buyerName = '', buyerLocation = '' } = {}) {
  const crop = listing?.crop || '';
  const tmpl = tStrict(
    'market.interest.template.buyerToFarmer',
    'Hi, I\u2019m interested in your {crop} listing. I\u2019m based in {location}. When can we connect?',
  );
  return tmpl
    .replace('{crop}',     crop || '')
    .replace('{location}', buyerLocation || '')
    .replace('{name}',     buyerName || '');
}

/**
 * buildFarmerToBuyerMessage — prefilled template the
 * "Contact buyer" modal shows on the farmer's screen, ready
 * for the farmer to copy/share.
 */
export function buildFarmerToBuyerMessage({ listing, buyer, farmerName = '' } = {}) {
  const crop = listing?.crop || '';
  const qty  = listing?.quantity != null
    ? `${listing.quantity}${listing.unit ? ' ' + listing.unit : ''}`
    : '';
  const buyerName = buyer?.buyerName || '';
  const tmpl = tStrict(
    'market.interest.template.farmerToBuyer',
    'Hi {buyerName}, this is {farmerName} from Farroway. I have {qty} of {crop} ready. When can we connect?',
  );
  return tmpl
    .replace('{buyerName}',  buyerName || tStrict('market.interest.fallbackBuyerName', 'there'))
    .replace('{farmerName}', farmerName || tStrict('market.interest.fallbackFarmerName', 'the farmer'))
    .replace('{qty}',        qty || tStrict('market.interest.fallbackQty', 'a fresh batch'))
    .replace('{crop}',       crop || tStrict('market.interest.fallbackCrop', 'produce'));
}

/**
 * Returns the subset of an interest list that is "stale" — still
 * in the `interested` state and older than 24h. Used by the
 * nudge banner to remind the farmer to respond.
 */
export function getStaleInterests(interests, now = Date.now()) {
  if (!Array.isArray(interests)) return [];
  return interests.filter((i) => {
    if (!i) return false;
    if ((i.status || 'interested') !== 'interested') return false;
    const t = Date.parse(i.createdAt || '');
    if (!Number.isFinite(t)) return false;
    return (now - t) >= STALE_THRESHOLD_MS;
  });
}

export const _internal = Object.freeze({
  STALE_THRESHOLD_MS,
  TRANSITIONS,
});

export default {
  INTEREST_STATUS,
  nextStatuses,
  statusTone,
  statusLabel,
  transitionInterest,
  buildBuyerToFarmerMessage,
  buildFarmerToBuyerMessage,
  getStaleInterests,
};
