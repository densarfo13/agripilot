/**
 * buyerPriority.js — opt-in "priority access" preference for buyers.
 *
 * Spec coverage (Marketplace monetization §3)
 *   • Buyer Priority — option for buyers to access listings faster.
 *
 * Storage
 *   farroway_buyer_priority : 'true' | 'false'
 *
 * In pilot the toggle is purely a preference flag — boosted
 * listings already surface ahead via the listingPriority sort,
 * so a priority buyer simply gets the boosted-first ordering
 * without having to wait for a backend gate. Production drop-in:
 * a billing-validated check before flipping this on.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Emits `farroway:priority_changed` for cross-component sync.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

export const PRIORITY_KEY = 'farroway_buyer_priority';
const CHANGE_EVENT = 'farroway:priority_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(PRIORITY_KEY);
  } catch { return null; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PRIORITY_KEY, value ? 'true' : 'false');
  } catch { /* swallow */ }
}

function _emit(on) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const ev = (typeof CustomEvent === 'function')
        ? new CustomEvent(CHANGE_EVENT, { detail: { enabled: !!on } })
        : new Event(CHANGE_EVENT);
      window.dispatchEvent(ev);
    }
  } catch { /* swallow */ }
}

export function isBuyerPriority() {
  return _safeRead() === 'true';
}

export function setBuyerPriority(enabled, { source = 'unknown' } = {}) {
  const next = !!enabled;
  _safeWrite(next);
  try {
    trackEvent('buyer_priority_toggled', { enabled: next, source });
  } catch { /* swallow */ }
  _emit(next);
  return next;
}

export const PRIORITY_CHANGED_EVENT = CHANGE_EVENT;

export default {
  PRIORITY_KEY,
  PRIORITY_CHANGED_EVENT,
  isBuyerPriority,
  setBuyerPriority,
};
