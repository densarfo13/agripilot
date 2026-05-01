/**
 * referralStore.js — local-first referral codes + invite tracking.
 *
 * Spec coverage (User growth §2, §4)
 *   • Invite friends
 *   • Reward usage (via `markReferralRewarded` once the invitee
 *     completes their first task — caller decides the trigger)
 *   • Tracking: invites, shares, new users
 *
 * Storage
 *   farroway_referral_code   : string (this device's stable code)
 *   farroway_referral_invites: Array<{
 *     id:            string,
 *     code:          string,
 *     channel:       'web_share' | 'copy' | 'sms' | 'manual',
 *     invitedAt:     ISO,
 *     redeemedAt?:   ISO,
 *     rewardedAt?:   ISO,
 *   }>
 *   farroway_referral_incoming: { code, capturedAt } | null
 *     (set once when a fresh install lands with `?ref=CODE`).
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent code generation — once written, the same code is
 *     returned on every read.
 *   • Capped 50 invites per device.
 *   • Emits `farroway:referral_changed` so subscribed surfaces
 *     refresh on cross-tab + same-tab changes.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

export const REFERRAL_CODE_KEY     = 'farroway_referral_code';
export const REFERRAL_INVITES_KEY  = 'farroway_referral_invites';
export const REFERRAL_INCOMING_KEY = 'farroway_referral_incoming';
const MAX_INVITES = 50;
const CHANGE_EVENT = 'farroway:referral_changed';

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value == null ? '' : String(value));
  } catch { /* swallow */ }
}

function _safeReadJsonArray(key) {
  try {
    const raw = _safeRead(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWriteJson(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* swallow */ }
}

function _emit() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _generateCode() {
  // Short, readable, lower-case alphanumeric. We avoid 0/o/1/l so
  // a printed code reads cleanly. Length 6 → ~31 bits of entropy,
  // plenty for a per-device code.
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return code;
}

/**
 * getMyReferralCode() — returns this device's stable referral
 * code, generating one on first use.
 */
export function getMyReferralCode() {
  const existing = _safeRead(REFERRAL_CODE_KEY);
  if (existing && String(existing).trim()) return existing;
  const fresh = _generateCode();
  _safeWrite(REFERRAL_CODE_KEY, fresh);
  return fresh;
}

/**
 * Build a share-friendly invite URL.
 *
 *   buildInviteUrl({ origin? }) → 'https://farroway.app/?ref=abc123'
 *
 * Origin defaults to the current location's origin so a pilot
 * running on a custom domain still produces correct links.
 */
export function buildInviteUrl({ origin } = {}) {
  const code = getMyReferralCode();
  const base = (() => {
    if (origin) return String(origin);
    try {
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin;
      }
    } catch { /* swallow */ }
    return 'https://farroway.app';
  })();
  return `${base.replace(/\/+$/, '')}/?ref=${encodeURIComponent(code)}`;
}

/**
 * recordInvite({ channel, target? }) — log an outbound invite.
 * Returns the stored record. Idempotent on (channel, minute) so
 * a double-tap doesn't write twice.
 */
export function recordInvite({ channel = 'manual', target = null } = {}) {
  const code = getMyReferralCode();
  const now = new Date().toISOString();
  const rows = _safeReadJsonArray(REFERRAL_INVITES_KEY);

  const oneMinAgo = Date.now() - 60_000;
  const dupe = rows.find((r) =>
    r && r.code === code
    && r.channel === channel
    && Date.parse(r.invitedAt || 0) > oneMinAgo);
  if (dupe) return dupe;

  const stored = {
    id:        `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    channel,
    target:    target ? String(target) : null,
    invitedAt: now,
  };
  rows.push(stored);
  if (rows.length > MAX_INVITES) {
    rows.splice(0, rows.length - MAX_INVITES);
  }
  _safeWriteJson(REFERRAL_INVITES_KEY, rows);

  try { trackEvent('invite_sent', { channel, code }); }
  catch { /* swallow */ }

  _emit();
  return stored;
}

export function getOutgoingInvites() {
  return _safeReadJsonArray(REFERRAL_INVITES_KEY)
    .slice()
    .sort((a, b) => Date.parse(b?.invitedAt || 0) - Date.parse(a?.invitedAt || 0));
}

/** Mark a specific invite as rewarded (caller decides the trigger). */
export function markReferralRewarded(inviteId) {
  const id = String(inviteId || '').trim();
  if (!id) return null;
  const rows = _safeReadJsonArray(REFERRAL_INVITES_KEY);
  const idx = rows.findIndex((r) => r && r.id === id);
  if (idx < 0) return null;
  if (rows[idx].rewardedAt) return rows[idx];        // idempotent
  rows[idx] = { ...rows[idx], rewardedAt: new Date().toISOString() };
  _safeWriteJson(REFERRAL_INVITES_KEY, rows);
  try { trackEvent('invite_rewarded', { inviteId: id, code: rows[idx].code }); }
  catch { /* swallow */ }
  _emit();
  return rows[idx];
}

/**
 * captureIncomingReferralFromURL() — one-shot read of `?ref=CODE`
 * from window.location. If found and not yet captured on this
 * device, records the incoming referral + fires `signup_via_invite`,
 * then strips the param from the URL so a refresh doesn't re-fire.
 *
 * Idempotent across mounts via the `farroway_referral_incoming`
 * stamp.
 */
export function captureIncomingReferralFromURL() {
  if (typeof window === 'undefined' || !window.location) return null;
  let url;
  try { url = new URL(window.location.href); }
  catch { return null; }
  const code = String(url.searchParams.get('ref') || '').trim().toLowerCase();
  if (!code) return null;

  const existingRaw = _safeRead(REFERRAL_INCOMING_KEY);
  if (existingRaw) {
    // Already captured — strip the param if it's still on the URL
    // and bail.
    try {
      url.searchParams.delete('ref');
      if (typeof window.history?.replaceState === 'function') {
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch { /* swallow */ }
    return null;
  }

  const stored = { code, capturedAt: new Date().toISOString() };
  _safeWriteJson(REFERRAL_INCOMING_KEY, stored);

  try { trackEvent('signup_via_invite', { code }); }
  catch { /* swallow */ }

  // Strip ?ref=CODE so a refresh doesn't double-fire.
  try {
    url.searchParams.delete('ref');
    if (typeof window.history?.replaceState === 'function') {
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch { /* swallow */ }

  _emit();
  return stored;
}

export function getIncomingReferral() {
  try {
    const raw = _safeRead(REFERRAL_INCOMING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

export const REFERRAL_CHANGED_EVENT = CHANGE_EVENT;

export default {
  REFERRAL_CODE_KEY,
  REFERRAL_INVITES_KEY,
  REFERRAL_INCOMING_KEY,
  REFERRAL_CHANGED_EVENT,
  getMyReferralCode,
  buildInviteUrl,
  recordInvite,
  getOutgoingInvites,
  markReferralRewarded,
  captureIncomingReferralFromURL,
  getIncomingReferral,
};
