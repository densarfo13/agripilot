/**
 * scanHistory.js — per-farm photo scan history backed by
 * localStorage. Capped + auto-pruned so the storage quota
 * never gets close to the browser's hard limit.
 *
 * Storage key:
 *   farroway:scanHistory:<farmId>  →  Array<ScanEntry>
 *
 * ScanEntry shape:
 *   {
 *     id:                string,   // uuid
 *     farmId:            string,
 *     cropId:            string | null,
 *     imageDataUrl:      string,    // base64 JPEG, ≤ 100 KB
 *     question:          string,    // canonical question id
 *     possibleIssue:     string,
 *     confidence:        'low' | 'medium' | 'high',
 *     recommendedAction: string,
 *     safetyWarning:     string | null,
 *     seekHelp:          string,
 *     language:          string,
 *     createdAt:         string,    // ISO
 *     pendingUpload:     boolean,    // true when offline-saved
 *   }
 *
 * Strict-rule audit
 *   • Pure read/write helpers — no React, no engine logic.
 *   • Every read tolerates corrupt / missing rows.
 *   • Cap at 20 entries per farm; oldest dropped first so the
 *     active farm always shows recent context without bloat.
 */

const PREFIX = 'farroway:scanHistory:';
const MAX_ENTRIES_PER_FARM = 20;

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function key(farmId) { return `${PREFIX}${farmId}`; }

function safeRead(farmId) {
  const ls = safeStorage();
  if (!ls || !farmId) return [];
  try {
    const raw = ls.getItem(key(farmId));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function safeWrite(farmId, list) {
  const ls = safeStorage();
  if (!ls || !farmId) return false;
  try {
    ls.setItem(key(farmId), JSON.stringify(list));
    return true;
  } catch (err) {
    // Quota error — drop the oldest half and retry once.
    if (err && err.name === 'QuotaExceededError' && Array.isArray(list)) {
      try {
        const half = list.slice(Math.floor(list.length / 2));
        ls.setItem(key(farmId), JSON.stringify(half));
        return true;
      } catch { /* give up silently */ }
    }
    return false;
  }
}

function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch { /* swallow */ }
  return 'scan_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

/**
 * appendScan — push a new scan onto the farm's history. Caps
 * the list at MAX_ENTRIES_PER_FARM by dropping from the front
 * (oldest first).
 *
 * Returns the entry that was actually written (carries the
 * generated id + timestamp).
 */
export function appendScan(farmId, partial) {
  if (!farmId) return null;
  const list = safeRead(farmId);
  const entry = {
    id:                partial.id || uuid(),
    farmId,
    cropId:            partial.cropId || null,
    imageDataUrl:      String(partial.imageDataUrl || ''),
    question:          String(partial.question || ''),
    possibleIssue:     String(partial.possibleIssue || ''),
    confidence:        partial.confidence || 'low',
    recommendedAction: String(partial.recommendedAction || ''),
    safetyWarning:     partial.safetyWarning || null,
    seekHelp:          String(partial.seekHelp || ''),
    language:          partial.language || 'en',
    createdAt:         partial.createdAt
      || (() => { try { return new Date().toISOString(); } catch { return ''; } })(),
    pendingUpload:     !!partial.pendingUpload,
  };
  list.push(entry);
  while (list.length > MAX_ENTRIES_PER_FARM) list.shift();
  safeWrite(farmId, list);
  return entry;
}

/**
 * listScans — newest-last by default.
 */
export function listScans(farmId, { reverse = false } = {}) {
  const list = safeRead(farmId);
  return reverse ? list.slice().reverse() : list;
}

/**
 * getScan — lookup a single entry.
 */
export function getScan(farmId, scanId) {
  if (!scanId) return null;
  const list = safeRead(farmId);
  return list.find((e) => e.id === scanId) || null;
}

/**
 * removeScan — remove an entry by id. Returns boolean.
 */
export function removeScan(farmId, scanId) {
  if (!scanId) return false;
  const list = safeRead(farmId);
  const next = list.filter((e) => e.id !== scanId);
  if (next.length === list.length) return false;
  safeWrite(farmId, next);
  return true;
}

/**
 * markScanAsUploaded — flip the pendingUpload flag once the
 * entry has been pushed to the backend (when one exists).
 * Used by the "saved offline; we'll analyze when connection
 * improves" path.
 */
export function markScanAsUploaded(farmId, scanId) {
  if (!scanId) return;
  const list = safeRead(farmId);
  const idx = list.findIndex((e) => e.id === scanId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], pendingUpload: false };
  safeWrite(farmId, list);
}

/**
 * clearScans — admin tool / test helper.
 */
export function clearScans(farmId) {
  const ls = safeStorage();
  if (!ls || !farmId) return;
  try { ls.removeItem(key(farmId)); } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  PREFIX,
  MAX_ENTRIES_PER_FARM,
});
