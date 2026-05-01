/**
 * recurringOrders.js — local-first store for recurring buyer
 * subscriptions ("send me the same crop every week").
 *
 * Spec coverage (Marketplace revenue scale §2)
 *   • Allow buyers to request weekly supply.
 *
 * Storage
 *   farroway_recurring_orders : Array<{
 *     id:        string,
 *     buyerId:   string,
 *     buyerName: string,
 *     crop:      string,
 *     frequency: 'weekly' | 'biweekly' | 'monthly',
 *     region:    string | null,
 *     country:   string | null,
 *     status:    'active' | 'paused' | 'cancelled',
 *     createdAt: ISO,
 *     updatedAt: ISO,
 *   }>
 *   Capped at 50 entries per device.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent on (buyerId, crop, frequency): a re-save updates
 *     the existing record's timestamps rather than duplicating.
 *   • Emits `farroway:recurring_changed`.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

export const RECURRING_KEY = 'farroway_recurring_orders';
const MAX_ENTRIES = 50;
const CHANGE_EVENT = 'farroway:recurring_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(RECURRING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(rows) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = rows.length > MAX_ENTRIES
      ? rows.slice(rows.length - MAX_ENTRIES)
      : rows;
    localStorage.setItem(RECURRING_KEY, JSON.stringify(trimmed));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _norm(s) { return String(s || '').trim().toLowerCase(); }

/**
 * saveRecurringOrder({ buyerId, buyerName, crop, frequency,
 *   region, country }) → record | null
 */
export function saveRecurringOrder(input = {}) {
  const buyerId = String(input.buyerId || '').trim();
  const crop    = _norm(input.crop);
  const frequency = String(input.frequency || 'weekly');
  if (!buyerId || !crop) return null;

  const rows = _safeRead();
  const idx = rows.findIndex((r) => r
    && r.buyerId === buyerId
    && _norm(r.crop) === crop
    && r.frequency === frequency
  );

  const now = new Date().toISOString();
  let stored;
  if (idx >= 0) {
    stored = {
      ...rows[idx],
      status:    'active',
      region:    input.region   || rows[idx].region   || null,
      country:   input.country  || rows[idx].country  || null,
      buyerName: input.buyerName || rows[idx].buyerName || '',
      updatedAt: now,
    };
    rows[idx] = stored;
  } else {
    stored = {
      id:        `ro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      buyerId,
      buyerName: String(input.buyerName || '').trim(),
      crop,
      frequency,
      region:    input.region  || null,
      country:   input.country || null,
      status:    'active',
      createdAt: now,
      updatedAt: now,
    };
    rows.push(stored);
  }
  _safeWrite(rows);

  try {
    trackEvent('recurring_order_saved', {
      orderId:   stored.id,
      buyerId:   stored.buyerId,
      crop:      stored.crop,
      frequency: stored.frequency,
      isNew:     idx < 0,
    });
  } catch { /* swallow */ }

  _emit();
  return stored;
}

export function cancelRecurringOrder(orderId, { buyerId } = {}) {
  const id = String(orderId || '').trim();
  if (!id) return null;
  const rows = _safeRead();
  const idx = rows.findIndex((r) => r && r.id === id
    && (!buyerId || r.buyerId === buyerId));
  if (idx < 0) return null;
  const next = { ...rows[idx], status: 'cancelled', updatedAt: new Date().toISOString() };
  rows[idx] = next;
  _safeWrite(rows);
  try { trackEvent('recurring_order_cancelled', { orderId: id, crop: next.crop }); }
  catch { /* swallow */ }
  _emit();
  return next;
}

export function getRecurringOrdersForBuyer(buyerId, { activeOnly = true } = {}) {
  const id = String(buyerId || '').trim();
  if (!id) return [];
  return _safeRead()
    .filter((r) => r && r.buyerId === id)
    .filter((r) => activeOnly ? r.status === 'active' : true)
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
}

export function isCropOnRecurring(buyerId, crop) {
  const id = String(buyerId || '').trim();
  const c = _norm(crop);
  if (!id || !c) return false;
  return _safeRead().some((r) =>
    r && r.buyerId === id && _norm(r.crop) === c && r.status === 'active');
}

export const RECURRING_CHANGED_EVENT = CHANGE_EVENT;

export default {
  RECURRING_KEY,
  RECURRING_CHANGED_EVENT,
  saveRecurringOrder,
  cancelRecurringOrder,
  getRecurringOrdersForBuyer,
  isCropOnRecurring,
};
