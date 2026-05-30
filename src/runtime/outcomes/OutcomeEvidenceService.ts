/**
 * src/runtime/outcomes/OutcomeEvidenceService.ts — Photo evidence
 * adapter for the Outcome Engine.
 *
 *   import {
 *     resolveBeforePhoto, resolveAfterPhoto,
 *     OUTCOME_EVIDENCE_VERSION,
 *   } from 'src/runtime/outcomes/OutcomeEvidenceService';
 *
 * What this is
 * ────────────
 *   A thin COMPOSITION layer over the existing plant-image cache
 *   surfaces. The Outcome Engine never uploads or persists image
 *   bytes; it stores a URL or cache key that can later be resolved
 *   by the regular image pipeline.
 *
 *   We look in this priority order for an existing photo reference:
 *     1. window.__plantImageCache       (if some other runtime
 *                                         already pinned a cache)
 *     2. localStorage 'farroway_plant_images'  (canonical UI cache)
 *     3. localStorage 'farroway_recent_scans'  (scan thumbnails)
 *     4. localStorage 'farroway_managed_plants' (per-plant photo)
 *
 *   For BEFORE photo we prefer the photo associated with the most
 *   recent diagnostic scanId. For AFTER we prefer the photo on the
 *   follow-up scanId (typically scanIds[scanIds.length - 1]).
 *
 * Strict-rule audit
 *   • Composition only — does not introduce a new uploader.
 *   • SSR-safe. Every storage / window access wrapped.
 *   • Pure runtime. Never throws.
 *   • Returns URL/keys only — NEVER bytes, NEVER PII.
 */

export const OUTCOME_EVIDENCE_VERSION = 'farroway-outcome-evidence-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str = (v: unknown): string =>
  typeof v === 'string' ? v : '';

function _read(key: string): string | null {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }, null);
}

function _parseArr(key: string): any[] {
  return _safe(() => {
    const raw = _read(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }, []);
}

function _parseObj(key: string): Record<string, any> {
  return _safe(() => {
    const raw = _read(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return _isObj(parsed) ? parsed : {};
  }, {});
}

/**
 * Look in any pinned in-memory plant-image cache first. Some other
 * runtime may have already organised photos by (plantId, scanId).
 */
function _windowCacheLookup(scanId: string, plantId: string): string | null {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    const cache = w.__plantImageCache;
    if (!_isObj(cache)) return null;
    // Common shapes:  cache[scanId]  /  cache.byScan[scanId]
    //                 cache.byPlant[plantId][scanId]
    const direct = (cache as any)[scanId];
    if (typeof direct === 'string' && direct) return direct;
    const byScan = (cache as any).byScan;
    if (_isObj(byScan)) {
      const hit = byScan[scanId];
      if (typeof hit === 'string' && hit) return hit;
    }
    const byPlant = (cache as any).byPlant;
    if (_isObj(byPlant) && _isObj(byPlant[plantId])) {
      const hit = (byPlant[plantId] as any)[scanId];
      if (typeof hit === 'string' && hit) return hit;
    }
    return null;
  }, null);
}

/**
 * `farroway_plant_images` shape (canonical UI cache) — an array of
 * { scanId, plantId, url } rows OR a map keyed by scanId.
 */
function _plantImagesLookup(scanId: string, plantId: string): string | null {
  return _safe(() => {
    // Try array shape first.
    const arr = _parseArr('farroway_plant_images');
    for (const row of arr) {
      if (!_isObj(row)) continue;
      if (_str(row.scanId) === scanId
       || (_str(row.plantId) === plantId && _str(row.scanId) === scanId)) {
        const url = _str(row.url) || _str(row.imageUrl) || _str(row.uri);
        if (url) return url;
      }
    }
    // Try object/map shape.
    const obj = _parseObj('farroway_plant_images');
    if (obj && _str((obj as any)[scanId])) {
      return _str((obj as any)[scanId]);
    }
    if (obj && _isObj((obj as any)[scanId])) {
      const row = (obj as any)[scanId];
      const url = _str(row.url) || _str(row.imageUrl) || _str(row.uri);
      if (url) return url;
    }
    return null;
  }, null);
}

/**
 * `farroway_recent_scans` — scans usually carry a thumbnail URL or
 * dataKey field. We fall back to whichever URL-like field is present.
 */
function _recentScansLookup(scanId: string): string | null {
  return _safe(() => {
    const arr = _parseArr('farroway_recent_scans');
    for (const row of arr) {
      if (!_isObj(row)) continue;
      if (_str(row.scanId) !== scanId && _str(row.id) !== scanId) continue;
      const url = _str(row.imageUrl)
               || _str(row.thumbnailUrl)
               || _str(row.url)
               || _str(row.photoKey)
               || _str(row.dataKey);
      if (url) return url;
    }
    return null;
  }, null);
}

/**
 * `farroway_managed_plants` — per-plant default photo. Used only as
 * a last-resort fallback for the BEFORE photo when no scan-keyed
 * image is available.
 */
function _managedPlantLookup(plantId: string): string | null {
  return _safe(() => {
    const arr = _parseArr('farroway_managed_plants');
    for (const row of arr) {
      if (!_isObj(row)) continue;
      if (_str(row.id) !== plantId && _str(row.plantId) !== plantId) continue;
      const url = _str(row.imageUrl)
               || _str(row.photoUrl)
               || _str(row.thumbnail);
      if (url) return url;
    }
    return null;
  }, null);
}

/**
 * Compose all evidence sources into a single resolver.
 * Returns a URL/cache key or null. NEVER bytes.
 */
function _resolve(scanId: string, plantId: string,
                  allowPlantFallback: boolean): string | null {
  return _safe(() => {
    const sid = _str(scanId);
    const pid = _str(plantId);
    if (!sid && !pid) return null;
    if (sid) {
      const win = _windowCacheLookup(sid, pid);
      if (win) return win;
      const pl = _plantImagesLookup(sid, pid);
      if (pl) return pl;
      const rs = _recentScansLookup(sid);
      if (rs) return rs;
    }
    if (allowPlantFallback && pid) {
      const mp = _managedPlantLookup(pid);
      if (mp) return mp;
    }
    return null;
  }, null);
}

/**
 * resolveBeforePhoto — Given the plant and the diagnostic scan id
 * (typically scanIds[0]), return a URL/cache key for the BEFORE
 * photo, or null. Plant-default fallback is allowed so the timeline
 * never shows an empty slot when the user lacks a per-scan image.
 */
export function resolveBeforePhoto(plantId: string,
                                   diagnosticScanId: string): string | null {
  return _resolve(diagnosticScanId, plantId, /* allowPlantFallback */ true);
}

/**
 * resolveAfterPhoto — Given the plant and the follow-up scan id
 * (typically scanIds[scanIds.length - 1]), return a URL/cache key
 * for the AFTER photo, or null. Plant-default fallback is NOT
 * allowed here — the AFTER photo is meaningful only when an actual
 * follow-up scan exists.
 */
export function resolveAfterPhoto(plantId: string,
                                  followUpScanId: string): string | null {
  return _resolve(followUpScanId, plantId, /* allowPlantFallback */ false);
}
