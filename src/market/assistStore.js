/**
 * assistStore.js — local-first "Get help closing deal" requests.
 *
 * Spec coverage (Marketplace monetization §2)
 *   • Assisted Deal — button to request help; allow request.
 *
 * Storage
 *   farroway_assist_requests : Array<{
 *     id:        string,
 *     listingId: string,
 *     farmerId:  string | null,
 *     buyerName: string | null,
 *     message:   string,
 *     status:    'pending' | 'in_progress' | 'closed',
 *     createdAt: ISO,
 *   }>
 *   Capped at 100 entries.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Pilot operators read this key directly; production drop-in
 *     is a `POST /api/market/assist` once the backend lands.
 *   • Emits `farroway:assist_changed`.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

export const ASSIST_KEY = 'farroway_assist_requests';
const MAX_ENTRIES = 100;
const CHANGE_EVENT = 'farroway:assist_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ASSIST_KEY);
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
    localStorage.setItem(ASSIST_KEY, JSON.stringify(trimmed));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

/**
 * requestAssist({ listingId, farmerId?, buyerName?, message? })
 *   → stored record, or null on bad input.
 *
 * Idempotent on (listingId, farmerId) within a 1-minute window —
 * a double-tap doesn't create two pending records.
 */
export function requestAssist({ listingId, farmerId = null, buyerName = null, message = '' } = {}) {
  const lid = String(listingId || '').trim();
  if (!lid) return null;
  const fid = farmerId ? String(farmerId).trim() : null;
  const text = String(message || '').trim();

  const rows = _safeRead();
  const oneMinAgo = Date.now() - 60_000;
  const dupe = rows.find((r) =>
    r && r.listingId === lid
    && (r.farmerId || null) === fid
    && Date.parse(r.createdAt || 0) > oneMinAgo
    && r.status === 'pending'
  );
  if (dupe) return dupe;

  const stored = {
    id:        `asr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    listingId: lid,
    farmerId:  fid,
    buyerName: buyerName ? String(buyerName).trim() : null,
    message:   text,
    status:    'pending',
    createdAt: new Date().toISOString(),
  };
  rows.push(stored);
  _safeWrite(rows);

  try {
    trackEvent('assist_request', {
      requestId: stored.id,
      listingId: stored.listingId,
      farmerId:  stored.farmerId,
      hasMessage: !!stored.message,
    });
  } catch { /* swallow */ }

  _emit();
  return stored;
}

/** Returns all assist requests, newest first. */
export function getAssistRequests() {
  return _safeRead()
    .slice()
    .sort((a, b) => Date.parse(b?.createdAt || 0) - Date.parse(a?.createdAt || 0));
}

export const ASSIST_CHANGED_EVENT = CHANGE_EVENT;

export default {
  ASSIST_KEY,
  ASSIST_CHANGED_EVENT,
  requestAssist,
  getAssistRequests,
};
