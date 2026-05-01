/**
 * ngoMode.js — local-first NGO mode toggle.
 *
 * NGO mode is *orthogonal* to user tier. It surfaces a bundle of
 * organisation-facing affordances that already exist in the
 * codebase (FundingAdmin, NgoImpactPage, multi-user reporting)
 * via a single user-toggleable preference. Role-based access for
 * those routes still flows through the existing auth layer — this
 * toggle does not grant access; it only decides whether to *show*
 * the entry points to a user who already has rights.
 *
 * Storage
 *   farroway_ngo_mode : 'true' | 'false'  (defaults to 'false')
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Emits `farroway:ngo_mode_changed` for cross-component sync.
 */

export const NGO_MODE_KEY = 'farroway_ngo_mode';
const CHANGE_EVENT = 'farroway:ngo_mode_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(NGO_MODE_KEY);
  } catch { return null; }
}

function _safeWrite(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(NGO_MODE_KEY, value ? 'true' : 'false');
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

export function isNgoMode() {
  const raw = _safeRead();
  return raw === 'true';
}

export function setNgoMode(on) {
  const next = !!on;
  _safeWrite(next);
  _emit(next);
  return next;
}

export function toggleNgoMode() {
  return setNgoMode(!isNgoMode());
}

export const NGO_MODE_CHANGED_EVENT = CHANGE_EVENT;

export default {
  NGO_MODE_KEY,
  NGO_MODE_CHANGED_EVENT,
  isNgoMode,
  setNgoMode,
  toggleNgoMode,
};
