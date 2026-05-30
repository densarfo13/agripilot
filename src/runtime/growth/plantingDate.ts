/**
 * src/runtime/growth/plantingDate.ts — Wave-30 gap-fix #3.
 * Lightweight read/write surface for per-plant planting dates so
 * the CropStageEngine has a non-keyword signal to fall back on.
 *
 *   import { recordPlantingDate, getWeeksSincePlanting }
 *     from 'src/runtime/growth/plantingDate';
 *
 *   recordPlantingDate('maize-northfield', '2026-03-15');
 *   const weeks = getWeeksSincePlanting('maize-northfield'); // → 11
 *
 * Storage: `localStorage["farroway.plantingDates"]` — a frozen
 * map of `{ [plantKey]: isoDate }`. plantKey is a caller-supplied
 * opaque string (typically `${plantId}` or `${farmId}:${plantId}`).
 *
 * Strict-rule audit
 *   • SSR-safe via typeof checks.
 *   • Never throws — every public function wraps in try/catch.
 *   • No PII (caller composes the key from already-anonymous ids).
 *   • Single-writer for the storage key.
 */

const STORAGE_KEY = 'farroway.plantingDates';
const MAX_ENTRIES = 200;

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasLocal(): boolean {
  return _safe(() =>
    typeof localStorage !== 'undefined' && !!localStorage, false);
}

function _read(): Record<string, string> {
  return _safe(() => {
    if (!_hasLocal()) return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  }, {});
}

function _write(map: Record<string, string>): boolean {
  return _safe(() => {
    if (!_hasLocal()) return false;
    // FIFO trim — drop oldest entries if we exceed the cap.
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      const trimmed = entries.slice(entries.length - MAX_ENTRIES);
      map = Object.fromEntries(trimmed);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  }, false);
}

/**
 * recordPlantingDate — stamp a planting date for a plant key.
 * Pass either `'YYYY-MM-DD'` or a full ISO string; both are
 * stored verbatim. Caller is responsible for picking the key.
 *
 * Returns true when the write succeeded.
 */
export function recordPlantingDate(plantKey: string,
                                   isoDate: string): boolean {
  return _safe(() => {
    if (typeof plantKey !== 'string' || !plantKey) return false;
    if (typeof isoDate  !== 'string' || !isoDate)  return false;
    const map = _read();
    map[plantKey] = isoDate;
    return _write(map);
  }, false);
}

/** Read the stored planting date for a key, or null if absent. */
export function getPlantingDate(plantKey: string): string | null {
  return _safe(() => {
    if (typeof plantKey !== 'string' || !plantKey) return null;
    const map = _read();
    return typeof map[plantKey] === 'string' ? map[plantKey] : null;
  }, null);
}

/**
 * getWeeksSincePlanting — pure derivation. Returns null when no
 * date is stored or when the stored date is malformed. Caller
 * (typically ScanPage) passes the result into the growth runtime's
 * plant-context `weeksSincePlanting` field; the engine then uses
 * its per-crop weeks-based fallback when the lifecycle stage
 * keyword signal is silent.
 */
export function getWeeksSincePlanting(
  plantKey: string,
  now: Date = new Date(),
): number | null {
  return _safe(() => {
    const stored = getPlantingDate(plantKey);
    if (!stored) return null;
    const planted = Date.parse(stored);
    if (!Number.isFinite(planted)) return null;
    const diffMs = now.getTime() - planted;
    if (diffMs < 0) return 0;
    const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    return Number.isFinite(weeks) ? weeks : null;
  }, null);
}

/** Clear a single entry (admin / "I made a mistake" path). */
export function clearPlantingDate(plantKey: string): boolean {
  return _safe(() => {
    if (typeof plantKey !== 'string' || !plantKey) return false;
    const map = _read();
    if (!(plantKey in map)) return false;
    delete map[plantKey];
    return _write(map);
  }, false);
}

export const PLANTING_DATE_VERSION = 'planting-date-v1';
