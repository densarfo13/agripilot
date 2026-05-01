/**
 * buyerIdentity.js — local-first buyer ID for the simple /buy
 * marketplace.
 *
 * Why this exists
 *   Most farmers in pilot are also occasional buyers. We don't
 *   want to force them through a second auth flow before they can
 *   tap "I'm interested". This module:
 *     • Returns the auth user's `sub` when logged in.
 *     • Otherwise generates and persists a stable
 *       `farroway_buyer_id` so a buyer's "I'm interested" tap
 *       maps back to the same identity across sessions on this
 *       device.
 *
 * Storage
 *   farroway_buyer_id : `bid_<base36 timestamp>_<rand>`
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • No PII in the buyer ID itself — it is an opaque token.
 */

export const BUYER_ID_KEY = 'farroway_buyer_id';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(BUYER_ID_KEY);
  } catch { return null; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(BUYER_ID_KEY, String(value || ''));
  } catch { /* swallow */ }
}

function _generate() {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bid_${ts}_${rand}`;
}

/**
 * Returns the buyer ID. Prefers the auth user's `sub` if supplied;
 * else returns the persisted local ID, generating one on first use.
 */
export function getBuyerId(authUser = null) {
  if (authUser && authUser.sub) return String(authUser.sub);
  const existing = _safeRead();
  if (existing && String(existing).trim()) return existing;
  const fresh = _generate();
  _safeWrite(fresh);
  return fresh;
}

export default { BUYER_ID_KEY, getBuyerId };
