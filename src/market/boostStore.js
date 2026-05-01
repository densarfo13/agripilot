/**
 * boostStore.js — local-first store for "boosted" listings.
 *
 * Spec coverage (Marketplace monetization §1)
 *   • Boost listing — optional paid feature, highlights the
 *     listing, shows a "Boosted" badge.
 *
 * Storage
 *   farroway_boosted_listings : Array<{
 *     listingId: string,
 *     boostedAt: ISO,
 *     expiresAt: ISO,         // boostedAt + 24h
 *   }>
 *   Capped at 100 entries.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent on `listingId`: a re-boost extends the window
 *     by writing a fresh `expiresAt`.
 *   • Auto-prunes expired entries on read.
 *   • Emits `farroway:boost_changed` so subscribed surfaces
 *     refresh in real time.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

export const BOOST_KEY = 'farroway_boosted_listings';
const MAX_ENTRIES = 100;
const BOOST_WINDOW_MS = 24 * 60 * 60_000;       // 24 hours
const CHANGE_EVENT = 'farroway:boost_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(BOOST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = value.length > MAX_ENTRIES
      ? value.slice(value.length - MAX_ENTRIES)
      : value;
    localStorage.setItem(BOOST_KEY, JSON.stringify(trimmed));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _now() { return new Date().toISOString(); }
function _later(ms) { return new Date(Date.now() + ms).toISOString(); }

function _activeOnly(rows, now = Date.now()) {
  return (rows || []).filter((r) => {
    if (!r || !r.listingId || !r.expiresAt) return false;
    const t = Date.parse(r.expiresAt);
    return Number.isFinite(t) && t > now;
  });
}

/**
 * boostListing(listingId, opts?) — stamps a 24h boost on the
 * listing. Returns the stored record.
 *
 *   opts.source — analytics tag passed through to `boost_click`.
 */
export function boostListing(listingId, { source = 'farmer_panel' } = {}) {
  const id = String(listingId || '').trim();
  if (!id) return null;

  const existing = _activeOnly(_safeRead());
  const filtered = existing.filter((r) => r.listingId !== id);

  const stored = {
    listingId: id,
    boostedAt: _now(),
    expiresAt: _later(BOOST_WINDOW_MS),
  };
  filtered.push(stored);
  _safeWrite(filtered);

  try { trackEvent('boost_click', { listingId: id, source }); }
  catch { /* swallow */ }

  _emit();
  return stored;
}

/** True when the listing has an active (non-expired) boost. */
export function isBoosted(listingId) {
  const id = String(listingId || '').trim();
  if (!id) return false;
  const active = _activeOnly(_safeRead());
  return active.some((r) => r.listingId === id);
}

/** Returns the set of currently boosted listing ids. */
export function getBoostedListingIds() {
  const active = _activeOnly(_safeRead());
  return new Set(active.map((r) => r.listingId));
}

/** Test / admin helper. */
export function _resetBoosts() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BOOST_KEY);
    }
  } catch { /* swallow */ }
  _emit();
}

export const BOOST_CHANGED_EVENT = CHANGE_EVENT;

export default {
  BOOST_KEY,
  BOOST_CHANGED_EVENT,
  boostListing,
  isBoosted,
  getBoostedListingIds,
};
