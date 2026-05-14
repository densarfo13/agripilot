/**
 * produceIntelMemory — last-known-good produce intelligence per crop.
 *
 *   saveProduceIntel(crop, intel, meta?)
 *   readProduceIntel(crop)            → envelope | null
 *   readLatestProduceIntel()          → { crop, intel, savedAt } | null
 *   clearProduceIntel()
 *
 * Why this exists
 *   ProduceIntelligenceEngine is pure — it produces an envelope from
 *   inputs and returns. The Sell screen, listing badge, and harvest
 *   prompt all need access to "what did the most recent produce scan
 *   say?" without re-running the engine or threading props through
 *   five layers.
 *
 *   We persist a tiny per-crop slot (latest envelope only — no
 *   history). Total footprint is ~1 KB per crop. The per-active-farm
 *   memory engine already keeps the longer journal; this slot is
 *   the QUICK-READ for Sell-flow autofill.
 *
 * Strict-rule audit
 *   • Pure / synchronous reads / SSR-safe.
 *   • Never throws — JSON parse failure → null.
 *   • Bounded — max 8 crops persisted (oldest dropped first).
 *   • No React, no network.
 */

const STORAGE_KEY = 'farroway.produce_intel.v1';
const MAX_CROPS   = 8;

function _safeLower(v) {
  return typeof v === 'string' ? v.toLowerCase().trim() : '';
}

function _safeReadAll() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

function _safeWriteAll(map) {
  try {
    if (typeof localStorage === 'undefined') return;
    // Bound the slot count — drop the oldest entries if we exceed the cap.
    const entries = Object.entries(map);
    if (entries.length > MAX_CROPS) {
      entries.sort((a, b) => (b[1] && b[1].savedAt || 0) - (a[1] && a[1].savedAt || 0));
      const trimmed = Object.fromEntries(entries.slice(0, MAX_CROPS));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* swallow */ }
}

/**
 * Persist the latest envelope for a given crop. Caller passes the
 * envelope produced by computeProduceIntelligence — we store it as
 * a plain object (the frozen envelope serializes cleanly).
 */
export function saveProduceIntel(crop, intel, meta) {
  try {
    const key = _safeLower(crop);
    if (!key || !intel || typeof intel !== 'object') return;
    const map = _safeReadAll();
    map[key] = {
      intel,
      savedAt: Date.now(),
      meta: (meta && typeof meta === 'object') ? meta : null,
    };
    _safeWriteAll(map);
  } catch { /* swallow */ }
}

/**
 * Read the latest envelope for a given crop. Returns null when
 * nothing has been stored for that crop yet.
 */
export function readProduceIntel(crop) {
  try {
    const key = _safeLower(crop);
    if (!key) return null;
    const map = _safeReadAll();
    const slot = map[key];
    if (!slot || !slot.intel) return null;
    return slot.intel;
  } catch { return null; }
}

/**
 * Read the most-recently-saved envelope across ALL crops. Useful for
 * surfaces that don't know which crop the farmer just scanned.
 */
export function readLatestProduceIntel() {
  try {
    const map = _safeReadAll();
    const entries = Object.entries(map);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b[1] && b[1].savedAt || 0) - (a[1] && a[1].savedAt || 0));
    const [crop, slot] = entries[0];
    if (!slot || !slot.intel) return null;
    return { crop, intel: slot.intel, savedAt: slot.savedAt };
  } catch { return null; }
}

export function clearProduceIntel() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* swallow */ }
}

const _module = {
  saveProduceIntel,
  readProduceIntel,
  readLatestProduceIntel,
  clearProduceIntel,
};
export default _module;
