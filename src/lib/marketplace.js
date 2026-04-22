/**
 * marketplace.js — client API wrapper for the marketplace surface.
 *
 * Wraps `/api/marketplace/*` endpoints so UI components speak a
 * single idiom ({listings, createListing, requestListing, ...})
 * instead of sprinkling fetch() calls.
 *
 *   listMarketplaceListings({ crop, region, status, limit })
 *     → GET /api/marketplace/listings
 *   createMarketplaceListing({ crop, quantity, price?, location?, region? })
 *     → POST /api/marketplace/list          (farmer or admin)
 *   requestMarketplaceListing({ listingId, buyerName?, buyerId? })
 *     → POST /api/marketplace/request        (buyer or admin)
 *   listMarketplaceRequests({ status, buyerId, crop, limit })
 *     → GET /api/marketplace/requests
 *   acceptMarketplaceRequest(requestId, listingId?)
 *     → PATCH /api/marketplace/requests/:id/status (farmer/admin)
 *   declineMarketplaceRequest(requestId)
 *     → PATCH /api/marketplace/requests/:id/status (farmer/admin)
 *   updateMarketplaceListingStatus(listingId, status)
 *     → PATCH /api/marketplace/listings/:id/status (farmer/admin)
 *
 * All functions return parsed JSON on 2xx or throw an Error with
 * .status + .code when the server reports a failure. Consumers
 * should try/catch and surface the .code to the UI.
 */

const JSON_POST  = { method: 'POST',  headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
const JSON_PATCH = { ...JSON_POST, method: 'PATCH' };

async function handle(res) {
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok || (body && body.success === false)) {
    const code = (body && (body.error || body.reason)) || `request_failed_${res.status}`;
    const err = new Error(code);
    err.code = code;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  // Server returns { success, data } — unwrap for callers.
  return body && body.data !== undefined ? body.data : body;
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

// ─── Listings (buyer view) ────────────────────────────────────
export async function listMarketplaceListings(filters = {}) {
  const qs = buildQuery({
    status: filters.status || 'active',   // active | requested | completed | all
    crop:   filters.crop   || '',
    region: filters.region || '',
    limit:  filters.limit  || '',
  });
  const res = await fetch(`/api/marketplace/listings${qs ? `?${qs}` : ''}`,
    { credentials: 'include' });
  return handle(res);
}

// ─── Listings (farmer side) ───────────────────────────────────
export async function createMarketplaceListing({ crop, quantity, price, location, region, farmId } = {}) {
  const body = { crop, quantity };
  if (price    != null) body.price    = Number(price);
  if (location)         body.location = location;
  if (region)           body.region   = region;
  if (farmId)           body.farmId   = farmId;
  const res = await fetch('/api/marketplace/list',
    { ...JSON_POST, body: JSON.stringify(body) });
  return handle(res);
}

export async function updateMarketplaceListingStatus(listingId, status) {
  const res = await fetch(
    `/api/marketplace/listings/${encodeURIComponent(listingId)}/status`,
    { ...JSON_PATCH, body: JSON.stringify({ status }) });
  return handle(res);
}

// ─── Requests (buyer) ─────────────────────────────────────────
export async function requestMarketplaceListing({ listingId, buyerName, buyerId, crop, quantity } = {}) {
  const body = { listingId };
  if (buyerName) body.buyerName = buyerName;
  if (buyerId)   body.buyerId   = buyerId;
  if (crop)      body.crop      = crop;
  if (quantity)  body.quantity  = quantity;
  const res = await fetch('/api/marketplace/request',
    { ...JSON_POST, body: JSON.stringify(body) });
  return handle(res);
}

export async function listMarketplaceRequests(filters = {}) {
  const qs = buildQuery({
    status:  filters.status  || 'pending', // pending | accepted | declined | all
    buyerId: filters.buyerId || '',
    crop:    filters.crop    || '',
    limit:   filters.limit   || '',
  });
  const res = await fetch(`/api/marketplace/requests${qs ? `?${qs}` : ''}`,
    { credentials: 'include' });
  return handle(res);
}

// ─── Farmer inbox: requests placed against my listings ───────
export async function listIncomingRequestsForFarmer(filters = {}) {
  const qs = buildQuery({
    status: filters.status || 'pending', // pending | accepted | declined | all
    limit:  filters.limit  || '',
  });
  const res = await fetch(`/api/marketplace/requests/incoming${qs ? `?${qs}` : ''}`,
    { credentials: 'include' });
  return handle(res);
}

// ─── Buyer inbox: my requests ────────────────────────────────
export async function listMyBuyerRequests(buyerId, filters = {}) {
  if (!buyerId) throw new Error('buyerId_required');
  return listMarketplaceRequests({ ...filters, buyerId });
}

// ─── Requests (farmer — accept / decline) ─────────────────────
export async function acceptMarketplaceRequest(requestId, listingId = null) {
  const body = { status: 'accepted' };
  if (listingId) body.listingId = listingId;
  const res = await fetch(
    `/api/marketplace/requests/${encodeURIComponent(requestId)}/status`,
    { ...JSON_PATCH, body: JSON.stringify(body) });
  return handle(res);
}

export async function declineMarketplaceRequest(requestId) {
  const res = await fetch(
    `/api/marketplace/requests/${encodeURIComponent(requestId)}/status`,
    { ...JSON_PATCH, body: JSON.stringify({ status: 'declined' }) });
  return handle(res);
}

// ─── Convenience helpers (match spec statuses) ────────────────
export async function markListingCompleted(listingId) {
  return updateMarketplaceListingStatus(listingId, 'completed');
}
export async function cancelListing(listingId) {
  return updateMarketplaceListingStatus(listingId, 'cancelled');
}

/**
 * Marketplace status constants — export for UI switch statements so
 * magic strings don't proliferate. Backed by the server's spec
 * statuses (active/requested/completed for listings, pending/
 * accepted/declined for requests).
 */
export const LISTING_STATUS = Object.freeze({
  ACTIVE:    'active',
  REQUESTED: 'requested',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});
export const REQUEST_STATUS = Object.freeze({
  PENDING:  'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});
