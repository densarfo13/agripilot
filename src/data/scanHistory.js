/**
 * scanHistory.js — local-first history for the new /scan flow.
 *
 * Storage
 * ───────
 *   localStorage[`farroway_scan_history`] = JSON.stringify(entries[])
 *
 * Sister to (NOT replacement for) the existing scan history at
 * `src/lib/photo/scanHistory.js` (per-farm, dotted-key
 * namespace `farroway:scanHistory:<farmId>`). That stack ships
 * today and powers `/scan-crop`. This module is the spec-aligned
 * shape used by the new /scan route — single flat list, simple
 * shape, future-API-ready.
 *
 * Strict-rule audit
 *   • Never throws — quota / private-mode / corrupt JSON all
 *     degrade silently.
 *   • Bounded local growth (200 entries × ~1KB ≈ 200KB worst case).
 *   • Image data NEVER stored at full resolution; the entry
 *     carries a thumbnail dataURL only when the caller chose to
 *     persist one.
 */

const STORAGE_KEY = 'farroway_scan_history';
const MAX_KEPT = 200;

/**
 * @typedef {object} ScanHistoryEntry
 * @property {string}  id              scan id from the engine
 * @property {string}  [farmId]
 * @property {string}  [cropId]
 * @property {string}  [plantName]
 * @property {string}  [thumbnail]     small dataURL, optional
 * @property {string}  possibleIssue
 * @property {'low'|'medium'|'high'} confidence
 * @property {string[]} recommendedActions
 * @property {string}  experience
 * @property {string}  [language]
 * @property {string}  createdAt       ISO
 * @property {object}  [raw]           full ScanResult, for the detail page
 */

function _readList() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeList(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch { /* quota / private mode — ignore */ }
}

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

/**
 * Persist a finished scan. Returns the stored entry so the caller
 * can navigate to a detail page using its id.
 *
 * @param {object} result      ScanResult from the engine
 * @param {object} [context]   { farmId, cropId, plantName, experience, language, thumbnail }
 * @returns {ScanHistoryEntry}
 */
export function saveScanEntry(result, context = {}) {
  const safeResult = result && typeof result === 'object' ? result : {};
  const entry = {
    id:                  safeResult.scanId || ('scan_' + Date.now().toString(36)),
    farmId:              context.farmId    || null,
    cropId:              context.cropId    || safeResult.meta?.cropId || null,
    plantName:           context.plantName || safeResult.meta?.plant  || null,
    thumbnail:           context.thumbnail || null,
    possibleIssue:       String(safeResult.possibleIssue || ''),
    confidence:          safeResult.confidence === 'low' || safeResult.confidence === 'medium' || safeResult.confidence === 'high'
                            ? safeResult.confidence
                            : 'low',
    recommendedActions:  Array.isArray(safeResult.recommendedActions)
                            ? safeResult.recommendedActions.map(String)
                            : [],
    experience:          context.experience || 'generic',
    language:            context.language   || null,
    createdAt:           _isoNow(),
    raw:                 (() => {
      // Defensive deep-clone so we don't accidentally persist a
      // frozen-but-shared ref the consumer later mutates.
      try { return JSON.parse(JSON.stringify(safeResult)); }
      catch { return null; }
    })(),
  };
  const list = _readList();
  list.push(entry);
  _writeList(list);
  return entry;
}

/** Read-only snapshot of all stored entries. */
export function getScanHistory() {
  return _readList();
}

/**
 * Look up a single entry by id. Returns null when not found —
 * the deep-link `/scan/result/:scanId` page uses this to show a
 * "scan not found" state rather than crashing.
 */
export function getScanEntry(id) {
  if (!id) return null;
  const list = _readList();
  return list.find((e) => e?.id === id) || null;
}

/** Wipe the local history. Server-pushed scans (when wired) live elsewhere. */
export function clearScanHistory() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/** Total entries on this device. */
export function getScanHistoryCount() {
  return _readList().length;
}

export default {
  saveScanEntry,
  getScanHistory,
  getScanEntry,
  getScanHistoryCount,
  clearScanHistory,
};
