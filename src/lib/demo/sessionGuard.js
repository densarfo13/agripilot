/**
 * sessionGuard.js — soft-recovery wrapper for session-expiry
 * handling during demo flow.
 *
 *   handleApiError(error, { onSoftExpire, onHardError }) →
 *     • when the error looks like "session expired" AND we're in
 *       demo mode, calls `onSoftExpire` (which should silently try
 *       a renewal or re-seed local data) — NEVER shows a red banner
 *     • otherwise falls through to `onHardError`
 *
 * This is a pure dispatcher — the actual renewal / seeding lives
 * in the call-site so we don't couple to any particular auth
 * strategy. Outside demo mode, sessions expire as usual.
 */

import { isDemoMode } from '../../config/demoMode.js';

const SESSION_EXPIRY_SIGNALS = [
  'session expired',
  'session has expired',
  'unauthorized',
  'not authenticated',
  'token expired',
];

function looksLikeSessionExpiry(err) {
  if (!err) return false;
  const msg = String(err.message || err.error || err).toLowerCase();
  if (err.status === 401 || err.statusCode === 401) return true;
  for (const needle of SESSION_EXPIRY_SIGNALS) {
    if (msg.includes(needle)) return true;
  }
  return false;
}

export function handleApiError(error, {
  onSoftExpire = () => {},
  onHardError  = () => {},
} = {}) {
  if (looksLikeSessionExpiry(error) && isDemoMode()) {
    try { onSoftExpire(error); } catch { /* never throw */ }
    return { handled: 'soft_expire' };
  }
  try { onHardError(error); } catch { /* never throw */ }
  return { handled: looksLikeSessionExpiry(error) ? 'hard_expire' : 'hard_error' };
}

export const _internal = Object.freeze({ looksLikeSessionExpiry, SESSION_EXPIRY_SIGNALS });
