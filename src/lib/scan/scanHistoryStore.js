/**
 * scanHistoryStore.js — local-first scan history for the
 * FEATURE_SCAN_USEFULNESS layer.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_scan_history_v1
 *
 * SHAPE (per entry)
 * ─────
 *   {
 *     id:          string   — scan id (from result.scanId or generated)
 *     category:    string   — one of the five safe categories
 *     noticed:     string   — "what we noticed" text
 *     createdAt:   string   — ISO datetime
 *     experience:  string   — 'farm' | 'backyard' | 'generic'
 *     taskAdded:   boolean  — true if the follow-up task was persisted
 *   }
 *
 * PURPOSE
 * ───────
 * Separate from the older `farroway_scan_history` (data/scanHistory.js)
 * which is per-farm and heavier. This slot is flat, fast, and keyed
 * only on the scan id — no farmId, no full result blob. History rows
 * link to the existing /scan/result/:scanId deep-link which reads from
 * the older store when a full result is needed.
 *
 * RULES
 * ─────
 *   • Never throws — corrupt JSON → safe empty list.
 *   • Bounded: max 50 entries; oldest dropped first.
 *   • No network. No React imports.
 *   • SSR-safe (localStorage guard).
 */

export const SCAN_HISTORY_KEY = 'farroway_scan_history_v1';
const MAX_KEPT = 50;

// ─── Private helpers ─────────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    // Keep only the most recent MAX_KEPT entries.
    const trimmed = list.length > MAX_KEPT ? list.slice(list.length - MAX_KEPT) : list;
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* quota / private mode — non-fatal */ }
}

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'scan_' + crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'scan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Persist a lightweight scan entry. Returns the stored entry.
 * Idempotent within the same scanId — a second call with the same id
 * is a no-op (returns the existing entry).
 *
 * @param {object} result       — ScanResult from the engine (at minimum: category, possibleIssue)
 * @param {object} [ctx]        — { experience, noticed }
 * @returns {{ id, category, noticed, createdAt, experience, taskAdded }}
 */
export function saveScanUseful(result, ctx = {}) {
  const safeResult = (result && typeof result === 'object') ? result : {};
  const id = String(safeResult.scanId || ctx.id || _makeId());

  // Idempotency: if this scanId already in history, return it.
  const list = _read();
  const existing = list.find((e) => e && e.id === id);
  if (existing) return existing;

  const entry = {
    id,
    category:   String(safeResult.category  || 'needs_review'),
    noticed:    String(ctx.noticed           || safeResult.possibleIssue || 'Needs closer inspection'),
    createdAt:  _isoNow(),
    experience: String(ctx.experience        || 'generic'),
    taskAdded:  false,
  };

  list.push(entry);
  _write(list);
  return entry;
}

/**
 * Mark a stored entry's task as added. Returns true when found.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function markTaskAdded(id) {
  if (!id) return false;
  const list = _read();
  const idx = list.findIndex((e) => e && e.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], taskAdded: true };
  _write(list);
  return true;
}

/**
 * All stored entries, newest-first. Never throws.
 *
 * @returns {Array<{ id, category, noticed, createdAt, experience, taskAdded }>}
 */
export function getScanUsefulHistory() {
  return _read().slice().reverse();
}

/**
 * Look up a single entry by id. Returns null when not found.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getScanUsefulEntry(id) {
  if (!id) return null;
  return _read().find((e) => e && e.id === id) || null;
}

/**
 * Total entry count on this device.
 *
 * @returns {number}
 */
export function getScanUsefulHistoryCount() {
  return _read().length;
}

/**
 * Remove all entries (sign-out / debug).
 */
export function clearScanUsefulHistory() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SCAN_HISTORY_KEY);
    }
  } catch { /* ignore */ }
}
