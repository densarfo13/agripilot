/**
 * listingDraftStore.js — local-first save for listing drafts.
 *
 * PURPOSE
 * ───────
 * When the farmer starts creating a produce listing without internet,
 * the form data is saved here immediately. On reconnect the UI can
 * offer to submit the draft. The store is also useful online — it
 * acts as an auto-save buffer so a navigation accident doesn't lose
 * the farmer's progress.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_listing_drafts_v1
 *
 * DRAFT SHAPE
 * ───────────
 *   {
 *     savedAt:      number   — ms-epoch of last save
 *     crop:         string?  — canonical crop id (use normalizeCropId())
 *     quantity:     string?
 *     unit:         string?
 *     pricePerUnit: string?
 *     location:     string?
 *     notes:        string?
 *     farmId:       string?
 *     [key]:        any      — any additional field the form adds
 *   }
 *
 * API is intentionally simple — one draft slot. A farmer working on
 * one listing at a time is the overwhelming common case; multi-draft
 * support can extend this later without changing the storage key.
 *
 * RULES
 * ─────
 *   • Never throws — all reads/writes guarded with try/catch.
 *   • saveListingDraft() merges into the existing draft (partial update
 *     is safe — only supplied fields are overwritten).
 *   • Dispatches 'farroway:listingDraftChanged' on every write so UI
 *     can react without polling.
 *   • Works in SSR (localStorage guard).
 */

export const DRAFT_KEY = 'farroway_listing_drafts_v1';
const CHANGE_EVENT = 'farroway:listingDraftChanged';

function _broadcast() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch { /* ignore */ }
}

/**
 * Save (or merge) listing draft data.
 *
 * Merges `data` into the existing draft so callers can do partial
 * field-by-field saves without reading first. The `savedAt` timestamp
 * is always updated to Date.now().
 *
 * @param {Record<string, unknown>} data
 * @returns {Record<string, unknown>|null} the persisted draft, or null on failure
 */
export function saveListingDraft(data) {
  if (!data || typeof data !== 'object') return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    const existing = getListingDraft() || {};
    const next = {
      ...existing,
      ...data,
      savedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    _broadcast();
    return next;
  } catch {
    return null;
  }
}

/**
 * Read the current listing draft. Returns null if nothing is saved
 * or on parse error.
 *
 * @returns {Record<string, unknown>|null}
 */
export function getListingDraft() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Remove the listing draft from storage.
 * Call after a successful server submission.
 */
export function clearListingDraft() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(DRAFT_KEY);
    _broadcast();
  } catch { /* ignore */ }
}

/**
 * True if there is an unsaved draft waiting to be submitted.
 */
export function hasListingDraft() {
  return getListingDraft() !== null;
}
