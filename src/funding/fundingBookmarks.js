/**
 * fundingBookmarks.js — local-first "remind me later" store for
 * Funding Hub opportunities.
 *
 * Storage
 *   farroway_funding_bookmarks : Array<{
 *     cardId:   string,
 *     title?:   string,    // last-seen title for offline fallback
 *     category?:string,
 *     savedAt:  ISO timestamp,
 *   }>
 *   Capped at 50 entries — older bookmarks roll off so the key
 *   never balloons.
 *
 * Position
 *   The existing `src/funding/fundingApplicationStore.js` tracks
 *   farmer interest + status (INTERESTED / APPLIED / CONTACTED).
 *   That store is for engagement-with-intent. Bookmarks are
 *   passive saves ("remind me later") — separate concept,
 *   separate key, no migration between them.
 *
 * Strict-rule audit
 *   • Never throws.
 *   • Works offline.
 *   • Idempotent: bookmarking the same cardId twice updates the
 *     savedAt without duplicating.
 *   • Emits `farroway:funding_bookmarks_changed` so UI surfaces
 *     can refresh without prop drilling.
 */

export const BOOKMARKS_KEY = 'farroway_funding_bookmarks';
const MAX_ENTRIES = 50;
const CHANGE_EVENT = 'farroway:funding_bookmarks_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(entries) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = entries.length > MAX_ENTRIES
      ? entries.slice(entries.length - MAX_ENTRIES)
      : entries;
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(trimmed));
  } catch { /* swallow */ }
}

function _emitChange() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

/**
 * bookmarkOpportunity — saves a card for later. Idempotent on cardId.
 *
 * @param {object} card  must carry `id`; `title` + `category` snapshotted.
 * @returns {{ cardId: string, savedAt: string } | null}
 */
export function bookmarkOpportunity(card) {
  const id = String(card?.id || '').trim();
  if (!id) return null;

  const entry = {
    cardId:   id,
    title:    card.title    ? String(card.title)    : '',
    category: card.category ? String(card.category) : '',
    savedAt:  new Date().toISOString(),
  };

  const existing = _safeRead();
  const next = existing.filter((e) => e && e.cardId !== id);
  next.push(entry);
  _safeWrite(next);
  _emitChange();
  return entry;
}

export function unbookmarkOpportunity(cardId) {
  const id = String(cardId || '').trim();
  if (!id) return false;
  const existing = _safeRead();
  const next = existing.filter((e) => e && e.cardId !== id);
  if (next.length === existing.length) return false;
  _safeWrite(next);
  _emitChange();
  return true;
}

export function isBookmarked(cardId) {
  const id = String(cardId || '').trim();
  if (!id) return false;
  return _safeRead().some((e) => e && e.cardId === id);
}

/** Newest-first list for any "Saved" panel. */
export function getBookmarks() {
  return _safeRead()
    .slice()
    .sort((a, b) => Date.parse(b?.savedAt || 0) - Date.parse(a?.savedAt || 0));
}

export const FUNDING_BOOKMARKS_CHANGED = CHANGE_EVENT;

export default {
  BOOKMARKS_KEY,
  FUNDING_BOOKMARKS_CHANGED,
  bookmarkOpportunity,
  unbookmarkOpportunity,
  isBookmarked,
  getBookmarks,
};
