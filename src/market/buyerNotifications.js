/**
 * buyerNotifications.js — fans out "new listing" alerts to buyers
 * who have expressed interest in the same crop in the recent past.
 *
 * Spec coverage (Marketplace scale §1)
 *   • Buyers see alerts when a fresh listing matches their
 *     interest history.
 *
 * Storage
 *   farroway_buyer_listing_alerts : Array<{
 *     id:        string,
 *     buyerId:   string,
 *     listingId: string,
 *     crop:      string,
 *     region:    string | null,
 *     country:   string | null,
 *     read:      boolean,
 *     createdAt: ISO,
 *   }>
 *   Capped at 200 entries per device.
 *
 * Strict-rule audit
 *   • Pure local-first writes; never throws.
 *   • Lazy-loaded by marketStore.saveListing so the module
 *     import graph stays acyclic.
 *   • Idempotent on (buyerId, listingId): the same listing
 *     never produces two alerts for the same buyer.
 *   • Emits `farroway:buyer_alert_changed` window event so
 *     subscribed surfaces refresh in real time.
 */

export const BUYER_ALERTS_KEY = 'farroway_buyer_listing_alerts';
const MAX_ENTRIES = 200;
const LOOKBACK_MS = 90 * 86_400_000;            // 90 days
const CHANGE_EVENT = 'farroway:buyer_alert_changed';

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = value.length > MAX_ENTRIES
      ? value.slice(value.length - MAX_ENTRIES)
      : value;
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _norm(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Find the distinct (buyerId, lastInterestCrop) pairs that have
 * shown interest in the listing's crop within the last 90 days.
 *
 * Reads `farroway_buyer_interests` directly to keep this module
 * free of an import cycle with marketStore (the marketStore is
 * the caller, via saveListing). Same storage key, same shape.
 */
function _matchingBuyers(listing) {
  if (!listing || !listing.crop) return [];
  let interests = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('farroway_buyer_interests');
      if (raw) {
        const parsed = JSON.parse(raw);
        interests = Array.isArray(parsed) ? parsed : [];
      }
    }
  } catch { interests = []; }
  if (!Array.isArray(interests) || interests.length === 0) return [];

  const wantCrop = _norm(listing.crop);
  const now = Date.now();
  const seen = new Set();
  const matches = [];

  for (const i of interests) {
    if (!i || !i.buyerId) continue;
    const t = Date.parse(i.createdAt || '');
    if (Number.isFinite(t) && (now - t) > LOOKBACK_MS) continue;
    const interestCrop = _norm(i.crop);
    if (!interestCrop) continue;
    if (interestCrop !== wantCrop) continue;
    // Don't notify the buyer if they themselves are the listing
    // owner (sample-data race / pilot multi-role devices).
    if (listing.farmerId && i.buyerId === listing.farmerId) continue;
    if (seen.has(i.buyerId)) continue;
    seen.add(i.buyerId);
    matches.push({ buyerId: i.buyerId });
  }
  return matches;
}

/**
 * fanoutNewListingAlerts(listing) — write a buyer-alert record
 * per matching buyer. Called from marketStore.saveListing when a
 * new listing is created. Sync but cheap — every step touches
 * localStorage only.
 */
export function fanoutNewListingAlerts(listing) {
  if (!listing || !listing.id || !listing.crop) return [];
  const matches = _matchingBuyers(listing);
  if (matches.length === 0) return [];

  const existing = _safeRead(BUYER_ALERTS_KEY);
  const indexedKey = (a) => `${a.buyerId}::${a.listingId}`;
  const present = new Set(existing.map(indexedKey));

  const toAdd = [];
  const now = new Date().toISOString();
  for (const m of matches) {
    const candidate = {
      id:        `bal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      buyerId:   m.buyerId,
      listingId: listing.id,
      crop:      listing.crop,
      region:    listing.location?.region || null,
      country:   listing.location?.country || null,
      read:      false,
      createdAt: now,
    };
    if (!present.has(indexedKey(candidate))) {
      toAdd.push(candidate);
      present.add(indexedKey(candidate));
    }
  }
  if (toAdd.length === 0) return [];

  _safeWrite(BUYER_ALERTS_KEY, existing.concat(toAdd));
  _emit();
  return toAdd;
}

/** Newest-first list of alerts for the given buyer. */
export function getBuyerAlerts(buyerId, { unreadOnly = false } = {}) {
  const id = String(buyerId || '').trim();
  if (!id) return [];
  return _safeRead(BUYER_ALERTS_KEY)
    .filter((a) => a && a.buyerId === id)
    .filter((a) => unreadOnly ? !a.read : true)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

export function markAlertRead(alertId) {
  const all = _safeRead(BUYER_ALERTS_KEY);
  const idx = all.findIndex((a) => a && a.id === alertId);
  if (idx < 0) return false;
  if (all[idx].read) return true;
  all[idx] = { ...all[idx], read: true, readAt: new Date().toISOString() };
  _safeWrite(BUYER_ALERTS_KEY, all);
  _emit();
  return true;
}

export function markAllAlertsRead(buyerId) {
  const id = String(buyerId || '').trim();
  if (!id) return 0;
  const all = _safeRead(BUYER_ALERTS_KEY);
  let changed = 0;
  const next = all.map((a) => {
    if (a && a.buyerId === id && !a.read) {
      changed += 1;
      return { ...a, read: true, readAt: new Date().toISOString() };
    }
    return a;
  });
  if (changed > 0) {
    _safeWrite(BUYER_ALERTS_KEY, next);
    _emit();
  }
  return changed;
}

export const BUYER_ALERT_CHANGED_EVENT = CHANGE_EVENT;

export default {
  BUYER_ALERTS_KEY,
  BUYER_ALERT_CHANGED_EVENT,
  fanoutNewListingAlerts,
  getBuyerAlerts,
  markAlertRead,
  markAllAlertsRead,
};
