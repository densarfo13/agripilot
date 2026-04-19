/**
 * useMarket.js — thin wrappers over the marketplace-v1 endpoints.
 * Matches the shape of useCropCycles.js so consumers don't need to
 * learn a second API style.
 */

async function handle(res) {
  if (!res.ok) {
    let code = `request_failed_${res.status}`;
    try { code = (await res.json())?.error || code; } catch { /* ignore */ }
    const err = new Error(code);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const JSON_POST = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
};
const JSON_PATCH = { ...JSON_POST, method: 'PATCH' };

// ─── Farmer: listings ────────────────────────────────────
export async function createListing(data) {
  return handle(await fetch('/api/listings', { ...JSON_POST, body: JSON.stringify(data) }));
}

export async function createListingFromHarvest(cycleId, overrides = {}) {
  return handle(await fetch('/api/listings/from-harvest', {
    ...JSON_POST, body: JSON.stringify({ cycleId, overrides }),
  }));
}

export async function listMyListings() {
  return handle(await fetch('/api/farmer/listings', { credentials: 'include' }));
}

export async function updateListing(id, patch) {
  return handle(await fetch(`/api/listings/${encodeURIComponent(id)}`, {
    ...JSON_PATCH, body: JSON.stringify(patch),
  }));
}

export async function markListingSold(id) {
  return handle(await fetch(`/api/listings/${encodeURIComponent(id)}/mark-sold`, JSON_POST));
}

export async function closeListing(id) {
  return handle(await fetch(`/api/listings/${encodeURIComponent(id)}/close`, JSON_POST));
}

// ─── Buyer: search + detail + interest ───────────────────
export async function searchListings(criteria = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(criteria)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  return handle(await fetch(`/api/listings/search?${qs}`, { credentials: 'include' }));
}

export async function getListing(id) {
  return handle(await fetch(`/api/listings/${encodeURIComponent(id)}`, { credentials: 'include' }));
}

export async function expressInterest(listingId, data = {}) {
  return handle(await fetch(`/api/listings/${encodeURIComponent(listingId)}/interested`, {
    ...JSON_POST, body: JSON.stringify(data),
  }));
}

// ─── Interest management ─────────────────────────────────
export async function listMyInterests() {
  return handle(await fetch('/api/farmer/interests', { credentials: 'include' }));
}

/** Buyer's sent-interest feed. Contact on the farmer is populated only
 *  for rows with status === 'accepted'. */
export async function listBuyerInterests() {
  return handle(await fetch('/api/buyer/interests', { credentials: 'include' }));
}
export async function acceptInterest(id, note) {
  return handle(await fetch(`/api/interests/${encodeURIComponent(id)}/accept`, {
    ...JSON_POST, body: JSON.stringify({ note: note || null }),
  }));
}
export async function declineInterest(id, note) {
  return handle(await fetch(`/api/interests/${encodeURIComponent(id)}/decline`, {
    ...JSON_POST, body: JSON.stringify({ note: note || null }),
  }));
}

// ─── Notifications ───────────────────────────────────────
export async function listNotifications() {
  return handle(await fetch('/api/notifications', { credentials: 'include' }));
}
export async function markNotificationRead(id) {
  return handle(await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, JSON_POST));
}
