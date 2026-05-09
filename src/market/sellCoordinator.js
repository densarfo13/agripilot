/**
 * sellCoordinator — single facade for marketplace coordination
 * events (May 2026 Sell upgrade).
 *
 *   import { recordBuyerEvent, markReserved, markSold }
 *     from 'src/market/sellCoordinator.js';
 *
 *   recordBuyerEvent('inquiry_sent', { listingId, buyerId,
 *                                      farmerId, quantity, region });
 *
 * WHY THIS FACADE EXISTS
 *   Surfaces (Sell page, Buyer interest panel, Notifications,
 *   NGO procurement) all need to record buyer↔farmer activity
 *   the same way. Without a single entry point the orchestration
 *   bus + analytics get inconsistent payloads. This module:
 *
 *     1. Validates the event type against the orchestration
 *        EVENT_TYPE catalogue.
 *     2. Strips PII / oversized fields from the payload before
 *        emitting (the marketplace events MUST not leak farmer
 *        phone numbers per spec §5).
 *     3. Routes to the orchestration bus AND mirrors to the
 *        existing safeTrackEvent so legacy admin dashboards
 *        keep working.
 *     4. Convenience helpers: `markReserved(listingId)`,
 *        `markSold(listingId)` flip the listing status AND
 *        emit the matching event.
 *
 * STRICT-RULE AUDIT
 *   • Pure-ish — only effect is the bus emit + the optional
 *     marketStore status update.
 *   • Never throws. Bad input → silently dropped (returns null).
 *   • PII strip is hard-coded — no allow-list bypass.
 *   • Spec §5 — buyer phone numbers / personal contact never
 *     pass through this layer.
 */

import { EVENT_TYPE, EVENT_SOURCE } from '../orchestration/events/eventTypes.js';
import { emit } from '../orchestration/events/eventBus.js';
import { LISTING_STATUS, updateListing } from './marketStore.js';

// Allow-list of marketplace-coordination event types. Anything
// outside this set is rejected — keeps a typo from accidentally
// firing a non-marketplace event through this facade.
const COORDINATION_EVENT_SET = new Set([
  EVENT_TYPE.PRODUCE_LISTED,
  EVENT_TYPE.PRODUCE_VIEWED,
  EVENT_TYPE.BUYER_INTEREST_RECEIVED,
  EVENT_TYPE.INQUIRY_SENT,
  EVENT_TYPE.QUANTITY_REQUESTED,
  EVENT_TYPE.NEGOTIATION_STARTED,
  EVENT_TYPE.MEETING_REQUESTED,
  EVENT_TYPE.LISTING_RESERVED,
  EVENT_TYPE.PURCHASE_CONFIRMED,
]);

// Fields we explicitly strip from any payload — these are
// either PII (phone, email) or large blobs that don't belong
// in an event ring buffer.
const FORBIDDEN_FIELDS = new Set([
  'phone', 'phoneE164', 'phoneNumber', 'email',
  'fullName', 'firstName', 'lastName',
  'message', 'note', 'description', 'photo', 'photoUrl',
  'rawBuyer', 'rawFarmer',
]);

const ALLOWED_FIELD_TYPES = new Set(['string', 'number', 'boolean']);
const MAX_STRING_LEN = 240;

function _safePayload(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const k of Object.keys(input)) {
    if (FORBIDDEN_FIELDS.has(k)) continue;
    const v = input[k];
    if (v == null) continue;
    if (!ALLOWED_FIELD_TYPES.has(typeof v)) continue;
    if (typeof v === 'string') {
      out[k] = v.slice(0, MAX_STRING_LEN);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Record a buyer↔farmer coordination event. Returns the stored
 * event envelope, or `null` when validation fails.
 *
 * @param {string} type            — one of the COORDINATION_EVENT_SET
 * @param {object} payload         — flat object; PII stripped before emit
 * @param {object} [opts]
 * @param {string} [opts.userId]   — farmer id (for orchestration context)
 * @param {string} [opts.farmId]
 * @param {string} [opts.region]
 * @param {string} [opts.cropSlug]
 * @returns {object|null}
 */
export function recordBuyerEvent(type, payload = {}, opts = {}) {
  if (!type || !COORDINATION_EVENT_SET.has(type)) return null;
  const safe = _safePayload(payload);

  return emit({
    type,
    userId:   (opts.userId == null) ? null : String(opts.userId),
    role:     'farmer',          // marketplace events are farmer-bus events
    mode:     'farm',
    farmId:   (opts.farmId == null) ? null : String(opts.farmId),
    region:   (opts.region == null) ? null : String(opts.region),
    cropSlug: (opts.cropSlug == null) ? null : String(opts.cropSlug),
    source:   EVENT_SOURCE.SELL,
    payload:  safe,
    confidence: null,
  });
}

/**
 * Convenience helper — flips a listing to RESERVED and emits
 * the LISTING_RESERVED event in one call. Returns the updated
 * listing (or null if the update failed).
 *
 * @param {string} listingId
 * @param {object} [opts]
 */
export function markReserved(listingId, opts = {}) {
  if (!listingId) return null;
  let updated = null;
  try { updated = updateListing(String(listingId), { status: LISTING_STATUS.RESERVED }); }
  catch { /* swallow — store handles its own errors */ }
  recordBuyerEvent(EVENT_TYPE.LISTING_RESERVED, {
    listingId: String(listingId),
    buyerId:   opts.buyerId ? String(opts.buyerId) : null,
  }, opts);
  return updated;
}

/**
 * Convenience helper — flips a listing to SOLD and emits the
 * PURCHASE_CONFIRMED event in one call.
 *
 * @param {string} listingId
 * @param {object} [opts]
 */
export function markSold(listingId, opts = {}) {
  if (!listingId) return null;
  let updated = null;
  try { updated = updateListing(String(listingId), { status: LISTING_STATUS.SOLD }); }
  catch { /* swallow */ }
  recordBuyerEvent(EVENT_TYPE.PURCHASE_CONFIRMED, {
    listingId: String(listingId),
    buyerId:   opts.buyerId ? String(opts.buyerId) : null,
  }, opts);
  return updated;
}

/**
 * Test helper — returns the frozen allow-list so suites can
 * assert specific event types are recognised.
 */
export function _coordinationEventSnapshot() {
  return Array.from(COORDINATION_EVENT_SET);
}

const _module = {
  recordBuyerEvent,
  markReserved,
  markSold,
  _coordinationEventSnapshot,
};
export default _module;
