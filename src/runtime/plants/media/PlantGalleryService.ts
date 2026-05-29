/**
 * src/runtime/plants/media/PlantGalleryService.ts — Composed
 * gallery view across the registry for the plant profile + scan
 * result surfaces.
 *
 *   import {
 *     composePlantGallery, composeReferenceImagesForScan,
 *     PLANT_GALLERY_VERSION,
 *   } from 'src/runtime/plants/media/PlantGalleryService';
 *
 *   composePlantGallery({
 *     plantId: 'rose',
 *     region:  'us-maryland',
 *     lifecycleStage: 'flowering',
 *   })
 *   // → { hero, gallery, diseases, pests, stages,
 *   //     regionMatched, runtimeVersion }
 *
 * What this is
 * ────────────
 *   Read-only composer. Pulls every PlantMedia entry for a plant,
 *   then splits into:
 *     • hero        — best verified image (region-matched first)
 *     • gallery     — additional plant/flower/fruit/leaf photos
 *     • diseases    — diagnostic disease references
 *     • pests       — diagnostic pest references
 *     • stages      — lifecycle-stage progression photos
 *
 *   Regional intelligence: when `region` is supplied, entries
 *   whose regionTags include that region float to the top of
 *   each bucket. `regionMatched: true` flags when at least one
 *   bucket honoured the region preference.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition over PlantMediaRegistry only.
 *   • No fetch. No PII (region is a code, not GPS).
 *   • All returned arrays are frozen.
 */

import {
  listMediaByPlant, listMediaByType,
  PlantMedia,
} from './PlantMediaRegistry';

export const PLANT_GALLERY_VERSION = 'plant-gallery-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const PLANT_LIKE = new Set([
  'plant', 'flower', 'fruit', 'vegetable',
  'herb', 'houseplant', 'crop', 'tree',
]);

function _sortByRegion(items: ReadonlyArray<PlantMedia>,
                        region: string): { sorted: PlantMedia[]; matched: boolean } {
  if (!region) return { sorted: items.slice(), matched: false };
  const matched: PlantMedia[] = [];
  const rest:    PlantMedia[] = [];
  for (const m of items) {
    const tags = (m.regionTags || []) as ReadonlyArray<string>;
    if (tags.indexOf(region) >= 0) matched.push(m);
    else                            rest.push(m);
  }
  return { sorted: matched.concat(rest), matched: matched.length > 0 };
}

interface GalleryCtx {
  plantId:         string;
  region?:         string;          // e.g. 'us-maryland', 'gh-northern'
  lifecycleStage?: string;          // e.g. 'flowering', 'fruiting'
  maxGallery?:     number;          // default 8
  maxDiagnostic?:  number;          // default 6
}

/**
 * Compose the full gallery for a plant. Returns a frozen
 * envelope with the buckets split + regional preference applied.
 */
export function composePlantGallery(ctx: GalleryCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return _emptyGallery('');
    }
    const plantId = _str(ctx.plantId);
    const region  = _str(ctx.region);
    const stage   = _str(ctx.lifecycleStage);
    if (!plantId) return _emptyGallery('');

    const maxGallery    = Math.max(1, Number(ctx.maxGallery)    || 8);
    const maxDiagnostic = Math.max(1, Number(ctx.maxDiagnostic) || 6);

    const all = listMediaByPlant(plantId);
    const buckets = {
      plantLike: [] as PlantMedia[],
      diseases:  [] as PlantMedia[],
      pests:     [] as PlantMedia[],
      stages:    [] as PlantMedia[],
    };
    for (const m of all) {
      if (m.type === 'disease')      buckets.diseases.push(m);
      else if (m.type === 'pest')    buckets.pests.push(m);
      else if (PLANT_LIKE.has(m.type)) {
        if (stage && m.lifecycleStage === stage) buckets.stages.push(m);
        buckets.plantLike.push(m);
      }
    }

    // Regional sort per bucket.
    const plantSorted = _sortByRegion(buckets.plantLike, region);
    const diseSorted  = _sortByRegion(buckets.diseases,  region);
    const pestSorted  = _sortByRegion(buckets.pests,     region);
    const stageSorted = _sortByRegion(buckets.stages,    region);

    const hero = plantSorted.sorted[0] || null;
    const gallery = plantSorted.sorted.slice(0, maxGallery);

    const regionMatched =
      plantSorted.matched || diseSorted.matched ||
      pestSorted.matched  || stageSorted.matched;

    return Object.freeze({
      runtimeVersion: PLANT_GALLERY_VERSION,
      plantId,
      region,
      lifecycleStage: stage,
      hero:           hero ? Object.freeze(hero) : null,
      gallery:        Object.freeze(gallery),
      diseases:       Object.freeze(diseSorted.sorted.slice(0, maxDiagnostic)),
      pests:          Object.freeze(pestSorted.sorted.slice(0, maxDiagnostic)),
      stages:         Object.freeze(stageSorted.sorted),
      regionMatched,
      counts: Object.freeze({
        gallery:  gallery.length,
        diseases: Math.min(diseSorted.sorted.length, maxDiagnostic),
        pests:    Math.min(pestSorted.sorted.length, maxDiagnostic),
        stages:   stageSorted.sorted.length,
      }),
    });
  }, _emptyGallery(''));
}

function _emptyGallery(plantId: string) {
  return Object.freeze({
    runtimeVersion: PLANT_GALLERY_VERSION,
    plantId,
    region: '',
    lifecycleStage: '',
    hero:    null as null,
    gallery: Object.freeze([] as PlantMedia[]),
    diseases:Object.freeze([] as PlantMedia[]),
    pests:   Object.freeze([] as PlantMedia[]),
    stages:  Object.freeze([] as PlantMedia[]),
    regionMatched: false,
    counts: Object.freeze({ gallery: 0, diseases: 0, pests: 0, stages: 0 }),
  });
}

interface ScanReferenceCtx {
  plantId:     string;
  region?:     string;
  diseaseIds?: ReadonlyArray<string>;  // matched disease detections
  pestIds?:    ReadonlyArray<string>;  // matched pest detections
  maxRef?:     number;                  // default 6
}

/**
 * Build the reference images bundle for a scan result page. The
 * scan card already shows the user's own photo; this composer
 * returns the side-by-side reference set so the user can
 * confirm the identification visually.
 *
 *   composeReferenceImagesForScan({
 *     plantId: 'rose', region: 'us-maryland',
 *     diseaseIds: ['leaf-spot'],
 *   })
 *   // → { plantReferences, diseaseReferences, pestReferences,
 *   //     hero, regionMatched, runtimeVersion }
 */
export function composeReferenceImagesForScan(ctx: ScanReferenceCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _emptyScanReference('');
    const plantId = _str(ctx.plantId);
    const region  = _str(ctx.region);
    if (!plantId) return _emptyScanReference('');

    const maxRef = Math.max(1, Number(ctx.maxRef) || 6);
    const all = listMediaByPlant(plantId);

    const plantLike  = all.filter((m) => PLANT_LIKE.has(m.type));
    const plantSort  = _sortByRegion(plantLike, region);

    // Per-diagnostic disease references — match either the
    // per-plant disease entries OR the global disease library.
    const diseaseRefs: PlantMedia[] = [];
    const diseaseIds = (ctx.diseaseIds || []) as ReadonlyArray<string>;
    for (const did of diseaseIds) {
      const slug = _str(did);
      if (!slug) continue;
      const fromPlant = all.filter((m) =>
        m.type === 'disease' && m.plantId === slug);
      const fromLibrary = listMediaByType('disease')
        .filter((m) => m.plantId === slug);
      for (const m of fromPlant.concat(fromLibrary)) {
        if (diseaseRefs.indexOf(m) < 0) diseaseRefs.push(m);
      }
    }
    const diseaseSort = _sortByRegion(diseaseRefs, region);

    const pestRefs: PlantMedia[] = [];
    const pestIds = (ctx.pestIds || []) as ReadonlyArray<string>;
    for (const pid of pestIds) {
      const slug = _str(pid);
      if (!slug) continue;
      const fromLibrary = listMediaByType('pest')
        .filter((m) => m.plantId === slug);
      for (const m of fromLibrary) {
        if (pestRefs.indexOf(m) < 0) pestRefs.push(m);
      }
    }
    const pestSort = _sortByRegion(pestRefs, region);

    return Object.freeze({
      runtimeVersion: PLANT_GALLERY_VERSION,
      plantId,
      region,
      hero:              plantSort.sorted[0] || null,
      plantReferences:   Object.freeze(plantSort.sorted.slice(0, maxRef)),
      diseaseReferences: Object.freeze(diseaseSort.sorted.slice(0, maxRef)),
      pestReferences:    Object.freeze(pestSort.sorted.slice(0, maxRef)),
      regionMatched:
        plantSort.matched || diseaseSort.matched || pestSort.matched,
    });
  }, _emptyScanReference(''));
}

function _emptyScanReference(plantId: string) {
  return Object.freeze({
    runtimeVersion: PLANT_GALLERY_VERSION,
    plantId, region: '',
    hero: null as null,
    plantReferences:   Object.freeze([] as PlantMedia[]),
    diseaseReferences: Object.freeze([] as PlantMedia[]),
    pestReferences:    Object.freeze([] as PlantMedia[]),
    regionMatched: false,
  });
}
