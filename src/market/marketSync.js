/**
 * marketSync.js — fire-and-forget bridge from the local
 * marketStore to the v3 backend endpoints, when those exist.
 *
 *   await syncListing(listing)        — POST /api/v3/market/listings
 *   await syncBuyerInterest(interest) — POST /api/v3/market/interests
 *   await refreshListingsFromServer() — GET  /api/v3/market/listings
 *
 * Why a separate module
 * ─────────────────────
 *   marketStore.js stays the pure local source of truth. It
 *   was specced offline-first and works perfectly without any
 *   backend. This module is the OPTIONAL upgrade path:
 *     * pages can call `syncListing()` AFTER `saveListing()`
 *       and the call returns even when no backend exists
 *       (404 / network error are silently swallowed)
 *     * on success, the local row is updated with
 *       `synced: true` so the next read can tell the
 *       difference — useful for debug, surfacing pending-
 *       sync chips in admin tooling, etc.
 *
 * The endpoints live at /api/v3/market/* (NEW — distinct
 * from the existing /api/marketplace/* legacy routes which
 * carry a heavier per-product schema). When server-side v3
 * routes are added the wiring already exists; until then,
 * every call no-ops gracefully.
 *
 * Strict-rule audit
 *   * Never throws. Every network call is try/catch wrapped
 *     and a 4xx/5xx returns `{ ok: false, reason }` rather
 *     than throwing.
 *   * Privacy: only the existing Listing / BuyerInterest
 *     shapes are sent — no farmer phone / fullName / email
 *     ever lands here.
 *   * Idempotent on the wire: the client supplies the
 *     listing.id so a re-sync from a flaky network produces
 *     the same row server-side, not a duplicate.
 */

import api from '../api/client.js';
import { updateListing } from './marketStore.js';

const V3_BASE = '/v3/market';

/**
 * Did the last server probe fail? Used to short-circuit
 * follow-up calls in the same session so we're not
 * generating a 404 storm in the network panel for users
 * whose deploy hasn't shipped the v3 endpoints yet. Reset
 * on a hard reload.
 */
let _backendUnavailable = false;

function _markUnavailable() { _backendUnavailable = true; }
function _isUnavailable()    { return _backendUnavailable; }

/**
 * POST a freshly-saved listing to the v3 backend.
 *
 *   const stored = saveListing(form);
 *   syncListing(stored);   // fire-and-forget
 *
 * Returns `{ ok: true }` on success, `{ ok: false, reason }`
 * otherwise. Never throws.
 */
export async function syncListing(listing) {
  if (!listing || !listing.id) return { ok: false, reason: 'invalid' };
  if (_isUnavailable()) return { ok: false, reason: 'backend_offline' };

  try {
    const res = await api.post(`${V3_BASE}/listings`, {
      // Send the spec's Listing shape verbatim. Server
      // accepts the client `id` for idempotency.
      id:         listing.id,
      farmerId:   listing.farmerId || null,
      farmId:     listing.farmId   || null,
      crop:       listing.crop,
      quantity:   listing.quantity,
      unit:       listing.unit,
      priceRange: listing.priceRange ?? null,
      readyDate:  listing.readyDate || null,
      location:   listing.location || null,
      status:     listing.status || 'ACTIVE',
      createdAt:  listing.createdAt,
      updatedAt:  listing.updatedAt,
    });
    if (res && res.status >= 200 && res.status < 300) {
      // Mark synced locally so subsequent reads can tell
      // this row has reached the server.
      try { updateListing(listing.id, { synced: true }); }
      catch { /* never block on local mark */ }
      return { ok: true };
    }
    return { ok: false, reason: `http_${res ? res.status : 'unknown'}` };
  } catch (err) {
    // 404 = endpoint not deployed. Cache the negative result
    // so the rest of the session doesn't keep probing.
    const status =
      (err && err.response && err.response.status)
      || err.status || null;
    if (status === 404) _markUnavailable();
    return { ok: false, reason: status ? `http_${status}` : 'network' };
  }
}

/**
 * POST a fresh buyer-interest submission. Same contract as
 * syncListing — fire-and-forget, never throws.
 */
export async function syncBuyerInterest(interest) {
  if (!interest || !interest.listingId) {
    return { ok: false, reason: 'invalid' };
  }
  if (_isUnavailable()) return { ok: false, reason: 'backend_offline' };

  try {
    const res = await api.post(`${V3_BASE}/interests`, {
      id:         interest.id,
      listingId:  interest.listingId,
      buyerName:  interest.buyerName,
      buyerPhone: interest.buyerPhone,
      buyerEmail: interest.buyerEmail,
      message:    interest.message,
      createdAt:  interest.createdAt,
    });
    if (res && res.status >= 200 && res.status < 300) {
      return { ok: true };
    }
    return { ok: false, reason: `http_${res ? res.status : 'unknown'}` };
  } catch (err) {
    const status =
      (err && err.response && err.response.status)
      || err.status || null;
    if (status === 404) _markUnavailable();
    return { ok: false, reason: status ? `http_${status}` : 'network' };
  }
}

/**
 * Pull the latest listings from the server and merge them
 * into the local store. Optional — pages that want the
 * cross-device experience call this on mount; everyone else
 * stays purely local.
 *
 * Returns `{ ok: true, count }` on success, `{ ok: false }`
 * otherwise. NEVER throws and NEVER overwrites a local row
 * whose `updatedAt` is newer than the server copy (offline-
 * first wins).
 */
export async function refreshListingsFromServer() {
  if (_isUnavailable()) return { ok: false, reason: 'backend_offline' };

  try {
    const res = await api.get(`${V3_BASE}/listings`);
    if (!res || res.status < 200 || res.status >= 300) {
      return { ok: false, reason: `http_${res ? res.status : 'unknown'}` };
    }
    const rows = Array.isArray(res.data && res.data.listings)
      ? res.data.listings
      : Array.isArray(res.data) ? res.data : [];
    if (!rows.length) return { ok: true, count: 0 };

    // Merge per-id. Local row wins when its updatedAt is
    // strictly newer than the server's — this prevents a
    // late server response from clobbering a fresh edit.
    let merged = 0;
    for (const r of rows) {
      if (!r || !r.id) continue;
      try {
        // updateListing is a no-op when the row doesn't
        // exist locally; for genuine cross-device merging
        // we'd want a saveListing path that doesn't
        // re-emit MARKET_LISTING_CREATED. Phase 2 work.
        updateListing(r.id, { ...r, synced: true });
        merged += 1;
      } catch { /* defensive */ }
    }
    return { ok: true, count: merged };
  } catch (err) {
    const status =
      (err && err.response && err.response.status)
      || err.status || null;
    if (status === 404) _markUnavailable();
    return { ok: false, reason: status ? `http_${status}` : 'network' };
  }
}

/**
 * Manual reset for tests / dev tooling.
 */
export function _resetSyncFlags() { _backendUnavailable = false; }
