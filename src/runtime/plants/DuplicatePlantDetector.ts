/**
 * DuplicatePlantDetector.ts — sprint #215 §1.
 *
 * Before creating a plant from a scan, checks whether the same plant
 * likely already exists on this farm (same crop / same day / same
 * scan / same image). Returns a similarity score + the existing match
 * so the UI can offer "View Existing Plant" (default) vs "Create
 * Anyway". Read-only over the plant list the app already holds; no new
 * store, no fabrication.
 *
 * Pure. Never throws. Pins window.__duplicatePlantHealth().
 */

export const DUPLICATE_PLANT_DETECTOR_VERSION = 'duplicate-plant-detector-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.9;

// Tiny deterministic string hash (djb2) — used to compare image refs
// when no real perceptual hash is available. NOT a content hash; only
// detects the EXACT same stored image ref, which is the common dup.
function _hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function _dayOf(iso: string): string { return _str(iso).slice(0, 10); }

/** Similarity 0..1 between a candidate scan and an existing plant. */
function _similarity(cand: any, plant: any): number {
  let score = 0;
  const cCrop = _str(cand.crop || cand.plantName || cand.cropName);
  const pCrop = _str(plant.crop || plant.plantName || plant.cropName);
  if (cCrop && cCrop === pCrop) score += 0.5;                 // same crop
  if (_str(cand.farmId) && _str(cand.farmId) === _str(plant.farmId)) score += 0.1;
  const cImg = _str(cand.imageUrl); const pImg = _str(plant.imageUrl);
  if (cImg && pImg && _hash(cImg) === _hash(pImg)) score += 0.3; // same image
  if (_str(cand.scanId) && _str(cand.scanId) === _str(plant.scanId)) score += 0.3;
  const cDay = _dayOf(cand.createdAt); const pDay = _dayOf(plant.createdAt);
  if (cCrop && cCrop === pCrop && cDay && cDay === pDay) score += 0.2; // same crop same day
  return Math.min(1, score);
}

export function detectDuplicatePlant(input: {
  candidate?: any;
  existingPlants?: ReadonlyArray<any>;
} = {}): Readonly<{
  runtimeVersion: string;
  isDuplicate: boolean;
  similarity: number;
  existingPlantId: string | null;
  defaultAction: 'view_existing' | 'create';
}> {
  return _safe(() => {
    const cand = input.candidate || {};
    let best = 0; let bestId: string | null = null;
    for (const p of _arr(input.existingPlants)) {
      const s = _similarity(cand, p);
      if (s > best) { best = s; bestId = _str(p.id || p.plantId) || null; }
    }
    const isDuplicate = best >= DUPLICATE_SIMILARITY_THRESHOLD;
    return Object.freeze({
      runtimeVersion: DUPLICATE_PLANT_DETECTOR_VERSION,
      isDuplicate,
      similarity: Math.round(best * 100) / 100,
      existingPlantId: isDuplicate ? bestId : null,
      defaultAction: isDuplicate ? 'view_existing' as const : 'create' as const,
    });
  }, Object.freeze({
    runtimeVersion: DUPLICATE_PLANT_DETECTOR_VERSION,
    isDuplicate: false, similarity: 0, existingPlantId: null,
    defaultAction: 'create' as const,
  }));
}

export function buildDuplicatePlantHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  duplicatePlantDetectorReady: true; thresholdPct: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: DUPLICATE_PLANT_DETECTOR_VERSION,
    duplicatePlantDetectorReady: true as const,
    thresholdPct: Math.round(DUPLICATE_SIMILARITY_THRESHOLD * 100),
  });
}

let _installed = false;
export function installDuplicatePlantHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__duplicatePlantHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildDuplicatePlantHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  detectDuplicatePlant, buildDuplicatePlantHealth, installDuplicatePlantHealthGlobal,
});
export default detectDuplicatePlant;
