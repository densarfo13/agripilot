/**
 * marketStore.js — local-first store for produce listings
 * and buyer interests.
 *
 * The Buyer + Funding/Impact layer must work BEFORE the
 * server-side market endpoints exist, and must continue to
 * work offline once they do. This store is the local truth:
 *   * writes hit localStorage immediately
 *   * each write is also surfaced through `safeTrackEvent`
 *     so the analytics queue can sync the change once the
 *     network returns
 *   * reads always succeed — corrupt rows return as []
 *
 * Storage keys (per spec § 3):
 *   farroway_market_listings
 *   farroway_buyer_interests
 *
 * Models — see also `src/market/models.js`.
 *
 * Strict-rule audit
 *   * never throws — every storage call is try/catch wrapped
 *     and every read uses safeParse with a [] fallback
 *   * idempotent — saveListing(l) with an existing id
 *     UPDATES instead of duplicating
 *   * privacy — listings store farmerId/farmId only; no
 *     phone / email / fullName ever lands here, so a leaked
 *     copy of localStorage cannot expose farmer PII to a
 *     third party
 *   * size-bounded — caps at 200 listings + 200 interests
 *     per device so a runaway loop can't blow the 5 MB
 *     localStorage quota
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';

export const STORAGE_KEYS = Object.freeze({
  LISTINGS:  'farroway_market_listings',
  INTERESTS: 'farroway_buyer_interests',
});

export const MARKET_EVENTS = Object.freeze({
  LISTING_CREATED:       'MARKET_LISTING_CREATED',
  LISTING_VIEWED:        'MARKET_LISTING_VIEWED',
  LISTING_SOLD:          'MARKET_LISTING_SOLD',
  LISTING_UPDATED:       'MARKET_LISTING_UPDATED',
  BUYER_INTEREST_SUBMITTED: 'BUYER_INTEREST_SUBMITTED',
});

const MAX_ROWS = 200;

// ─── primitives ────────────────────────────────────────────

function _read(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(key, rows) {
  try {
    if (typeof localStorage === 'undefined') return false;
    // Cap to keep us inside the 5 MB quota. Keep the most
    // RECENT rows (slice from the tail) — older listings can
    // be re-fetched from the server when one exists.
    const safe = Array.isArray(rows) ? rows.slice(-MAX_ROWS) : [];
    localStorage.setItem(key, JSON.stringify(safe));
    return true;
  } catch {
    // Quota exhausted / private mode / etc. Swallow — the
    // calling page already shows the optimistic UI state.
    return false;
  }
}

function _now() {
  try { return new Date().toISOString(); }
  catch { return ''; }
}

function _uid() {
  // Simple time-prefixed id; idempotency is by `id`.
  try {
    return `lst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `lst_${Date.now()}`;
  }
}

// ─── Listings ──────────────────────────────────────────────

/**
 * Returns ALL listings stored on this device, newest first.
 */
export function getListings() {
  const rows = _read(STORAGE_KEYS.LISTINGS);
  // Defensive: drop anything that doesn't look like a listing.
  return rows
    .filter((r) => r && typeof r === 'object' && r.id && r.crop)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/**
 * Active = listings whose status is not "SOLD" and whose
 * readyDate (when present) hasn't slipped more than 30 days
 * past today. Stale listings stay on the device but the
 * marketplace surface filters them out.
 */
export function getActiveListings() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return getListings().filter((l) => {
    if (String(l.status || '').toUpperCase() === 'SOLD') return false;
    if (!l.readyDate) return true;
    const t = Date.parse(l.readyDate);
    if (Number.isNaN(t)) return true;
    return t >= cutoff;
  });
}

/**
 * saveListing(listing) — idempotent. If `listing.id` matches
 * an existing row, it is updated; otherwise a new row is
 * inserted. Returns the stored row (with id, createdAt,
 * updatedAt filled in).
 */
export function saveListing(listing) {
  const safeListing = listing && typeof listing === 'object' ? listing : {};
  const now = _now();
  const id = safeListing.id || _uid();

  const rows = _read(STORAGE_KEYS.LISTINGS);
  const idx  = rows.findIndex((r) => r && r.id === id);

  const stored = {
    id,
    farmerId:    safeListing.farmerId || null,
    farmId:      safeListing.farmId   || null,
    crop:        String(safeListing.crop || '').trim(),
    quantity:    Number(safeListing.quantity) || 0,
    unit:        String(safeListing.unit || 'kg'),
    priceRange:  safeListing.priceRange ?? null,   // free-form string OK
    readyDate:   safeListing.readyDate || null,
    location:    {
      lat:     safeListing.location && Number.isFinite(Number(safeListing.location.lat))
                 ? Number(safeListing.location.lat)  : null,
      lng:     safeListing.location && Number.isFinite(Number(safeListing.location.lng))
                 ? Number(safeListing.location.lng)  : null,
      region:  (safeListing.location && safeListing.location.region)  || '',
      country: (safeListing.location && safeListing.location.country) || '',
    },
    status:      String(safeListing.status || 'ACTIVE').toUpperCase(),
    createdAt:   safeListing.createdAt || (idx >= 0 ? rows[idx].createdAt : now),
    updatedAt:   now,
    synced:      Boolean(safeListing.synced),
  };

  if (idx >= 0) {
    rows[idx] = stored;
  } else {
    rows.push(stored);
  }
  _write(STORAGE_KEYS.LISTINGS, rows);

  try {
    safeTrackEvent(
      idx >= 0 ? MARKET_EVENTS.LISTING_UPDATED : MARKET_EVENTS.LISTING_CREATED,
      {
        listingId: stored.id,
        crop:      stored.crop,
        quantity:  stored.quantity,
        unit:      stored.unit,
        region:    stored.location.region || null,
        country:   stored.location.country || null,
      },
    );
  } catch { /* analytics is fire-and-forget */ }

  return stored;
}

/**
 * updateListing(id, updates) — partial update by id. No-op
 * (returns null) if the listing doesn't exist on this device.
 */
export function updateListing(id, updates) {
  if (!id) return null;
  const rows = _read(STORAGE_KEYS.LISTINGS);
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx < 0) return null;
  const next = { ...rows[idx], ...(updates || {}), updatedAt: _now() };
  rows[idx] = next;
  _write(STORAGE_KEYS.LISTINGS, rows);
  try {
    safeTrackEvent(MARKET_EVENTS.LISTING_UPDATED, {
      listingId: id, status: next.status || null,
    });
  } catch { /* ignore */ }
  return next;
}

/**
 * markListingSold(id) — convenience alias for the most
 * common update. Logs MARKET_LISTING_SOLD.
 */
export function markListingSold(id) {
  const next = updateListing(id, { status: 'SOLD' });
  if (next) {
    try { safeTrackEvent(MARKET_EVENTS.LISTING_SOLD, { listingId: id }); }
    catch { /* ignore */ }
  }
  return next;
}

// ─── Buyer interests ───────────────────────────────────────

export function getBuyerInterests() {
  const rows = _read(STORAGE_KEYS.INTERESTS);
  return rows
    .filter((r) => r && typeof r === 'object' && r.listingId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/**
 * saveBuyerInterest(interest) — appends a buyer-interest
 * record locally and emits BUYER_INTEREST_SUBMITTED. Used by
 * the public Marketplace surface; on backend land, the
 * platform/admin will be the receiver (NEVER the farmer
 * directly — see spec § 6 privacy rule).
 */
export function saveBuyerInterest(interest) {
  const safeInt = interest && typeof interest === 'object' ? interest : {};
  if (!safeInt.listingId) return null;

  const stored = {
    id:        safeInt.id || `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    listingId: String(safeInt.listingId),
    buyerName:  String(safeInt.buyerName  || '').trim(),
    buyerPhone: String(safeInt.buyerPhone || '').trim(),
    buyerEmail: String(safeInt.buyerEmail || '').trim(),
    message:    String(safeInt.message    || '').trim(),
    createdAt:  _now(),
  };

  const rows = _read(STORAGE_KEYS.INTERESTS);
  rows.push(stored);
  _write(STORAGE_KEYS.INTERESTS, rows);

  try {
    safeTrackEvent(MARKET_EVENTS.BUYER_INTEREST_SUBMITTED, {
      interestId: stored.id,
      listingId:  stored.listingId,
      hasPhone:   !!stored.buyerPhone,
      hasEmail:   !!stored.buyerEmail,
    });
  } catch { /* ignore */ }

  return stored;
}

// ─── Aggregates (used by NGO MarketActivity) ───────────────

/**
 * marketSummary() — small read-only aggregate used by the
 * NGO MarketActivity component. Pure: derived from current
 * localStorage state, no I/O.
 */
export function marketSummary() {
  const all     = getListings();
  const active  = all.filter((l) => String(l.status || '').toUpperCase() !== 'SOLD');
  const sold    = all.filter((l) => String(l.status || '').toUpperCase() === 'SOLD');
  const interests = getBuyerInterests();

  // Top crops (active only)
  const cropCounts = new Map();
  for (const l of active) {
    const c = String(l.crop || '').trim().toLowerCase();
    if (!c) continue;
    cropCounts.set(c, (cropCounts.get(c) || 0) + 1);
  }
  const topCrops = Array.from(cropCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([crop, count]) => ({ crop, count }));

  // Regions (active only)
  const regionSet = new Set();
  for (const l of active) {
    const r = String(l.location?.region || '').trim();
    if (r) regionSet.add(r);
  }

  return {
    totalListings:  all.length,
    activeListings: active.length,
    soldListings:   sold.length,
    interestCount:  interests.length,
    topCrops,
    regionsActive:  Array.from(regionSet),
  };
}
