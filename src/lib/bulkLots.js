/**
 * bulkLots.js — client wrapper for the marketplace bulk-lot
 * aggregation endpoints.
 *
 *   listBulkLots({ crop?, country?, region?, windowDays?,
 *                  pickupDays?, minContrib? })
 *     → GET /api/marketplace/bulk-lots
 *     → Array<{ lotId, crop, country, region, location,
 *                totalQuantity, contributors, pickupWindow,
 *                status, priceSignal }>
 *
 *   requestBulkLot(lotId, { buyerName?, buyerId?, message? })
 *     → POST /api/marketplace/bulk-lots/:lotId/request
 *     → { request, lotId, contributors, totalQuantity }
 */

const JSON_POST = {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
};

async function handle(res) {
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok || (body && body.success === false)) {
    const code = (body && (body.error || body.reason)) || `request_failed_${res.status}`;
    const err = new Error(code);
    err.code = code;
    err.status = res.status;
    throw err;
  }
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

export async function listBulkLots(filters = {}) {
  const qs = buildQuery({
    crop:        filters.crop    || '',
    country:     filters.country || '',
    region:      filters.region  || '',
    windowDays:  filters.windowDays || '',
    pickupDays:  filters.pickupDays || '',
    minContrib:  filters.minContrib || '',
  });
  const res = await fetch(`/api/marketplace/bulk-lots${qs ? `?${qs}` : ''}`,
    { credentials: 'include' });
  return handle(res);
}

export async function requestBulkLot(lotId, { buyerName, buyerId, message } = {}) {
  if (!lotId) throw Object.assign(new Error('missing_lot_id'), { code: 'missing_lot_id' });
  const body = {};
  if (buyerName) body.buyerName = buyerName;
  if (buyerId)   body.buyerId   = buyerId;
  if (message)   body.message   = message;
  const res = await fetch(
    `/api/marketplace/bulk-lots/${encodeURIComponent(lotId)}/request`,
    { ...JSON_POST, body: JSON.stringify(body) });
  return handle(res);
}

export function formatPickupWindow(lot) {
  if (!lot || !lot.pickupWindow) return '';
  try {
    const s = new Date(lot.pickupWindow.start);
    const e = new Date(lot.pickupWindow.end);
    const opts = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
  } catch { return ''; }
}
