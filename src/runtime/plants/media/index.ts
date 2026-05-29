/**
 * src/runtime/plants/media/index.ts — Verified Plant Media
 * System barrel + boot-time seed.
 *
 *   import {
 *     verifiedPlantMedia,              // composite runtime probe
 *     installPlantMediaGlobal,         // window pin
 *     PLANT_MEDIA_SYSTEM_VERSION,
 *   } from 'src/runtime/plants/media';
 *
 * What this file owns
 * ───────────────────
 *   • Auto-seeds PlantMediaRegistry from every launch library
 *     (flowers, vegetables, fruits, herbs, houseplants, crops,
 *     diseases, pests). Idempotent — safe to re-import.
 *   • Bridges every verified plant entry into the older
 *     PlantImageRegistry so existing <PlantImage> consumers get
 *     verified hero images "for free".
 *   • Re-exports every public symbol from the 5 engines.
 *   • Pins window.__plantMediaHealth() for QA introspection.
 *
 * Strict-rule audit
 *   • Pure side effect on import: append-only seeds + bridge.
 *   • Never throws (each library import is wrapped in _safe).
 *   • Composition-only — no engine modifies the older registry
 *     beyond its public API.
 */

import {
  registerPlantMediaBulk, bridgeToImageRegistry,
  plantMediaSummary, listMediaByType, PLANT_MEDIA_TYPES,
  PLANT_MEDIA_REGISTRY_VERSION,
} from './PlantMediaRegistry';
import {
  buildMediaUrl, buildMediaUrlForType, buildMediaSet,
  mediaThumbnailUrl, plantMediaServiceInfo,
  PLANT_MEDIA_FOLDERS, PLANT_MEDIA_CLOUD_NAME,
  PLANT_MEDIA_SERVICE_VERSION,
} from './PlantMediaService';
import {
  cacheMedia, getCachedMedia, listCachedKeys, cachedSize,
  subscribeMediaCacheEvents, clearMediaCache,
  plantMediaCacheSnapshot, CACHE_EVENT,
  PLANT_MEDIA_CACHE_VERSION, PLANT_MEDIA_CACHE_MAX,
} from './PlantMediaCache';
import {
  composePlantGallery, composeReferenceImagesForScan,
  PLANT_GALLERY_VERSION,
} from './PlantGalleryService';
import {
  submitForVerification, approveVerification, rejectVerification,
  listPendingVerifications, listAllVerifications,
  plantImageVerificationSnapshot, VERIFICATION_STATUS,
  PLANT_IMAGE_VERIFICATION_VERSION,
} from './PlantImageVerification';

// Libraries — each module is a frozen array of {plantId, slug}.
import { FLOWER_LIBRARY }     from './libraries/flowerLibrary';
import { VEGETABLE_LIBRARY }  from './libraries/vegetableLibrary';
import { FRUIT_LIBRARY }      from './libraries/fruitLibrary';
import { HERB_LIBRARY }       from './libraries/herbLibrary';
import { HOUSEPLANT_LIBRARY } from './libraries/houseplantLibrary';
import { CROP_LIBRARY }       from './libraries/cropLibrary';
import { DISEASE_LIBRARY }    from './libraries/diseaseLibrary';
import { PEST_LIBRARY }       from './libraries/pestLibrary';

export const PLANT_MEDIA_SYSTEM_VERSION = 'plant-media-system-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

// ─── Boot-time seed (idempotent — registry de-dupes by id) ─────
function _seedLibrary(
  library: ReadonlyArray<{ plantId: string; slug: string;
                            attribution?: string }>,
  folder: string,
  type:   string,
) {
  _safe(() => {
    const at = _now();
    const entries = library.map((row) => ({
      id:           'media_' + type + '_' + row.plantId,
      plantId:      row.plantId,
      type:         type as any,
      imageUrl:     buildMediaUrl(folder, row.slug),
      thumbnailUrl: buildMediaUrl(folder, row.slug),
      verified:     true,
      source:       'farroway-curated',
      attribution:  (row as any).attribution,
      createdAt:    at,
    }));
    registerPlantMediaBulk(entries);
    return true;
  }, false);
}

// Auto-seed on import. SSR-safe (no DOM access).
_seedLibrary(FLOWER_LIBRARY,     'flowers',     'flower');
_seedLibrary(VEGETABLE_LIBRARY,  'vegetables',  'vegetable');
_seedLibrary(FRUIT_LIBRARY,      'fruits',      'fruit');
_seedLibrary(HERB_LIBRARY,       'herbs',       'herb');
_seedLibrary(HOUSEPLANT_LIBRARY, 'houseplants', 'houseplant');
_seedLibrary(CROP_LIBRARY,       'crops',       'crop');
_seedLibrary(DISEASE_LIBRARY,    'diseases',    'disease');
_seedLibrary(PEST_LIBRARY,       'pests',       'pest');

// Bridge: every verified plant-typed entry mirrors into the older
// PlantImageRegistry so existing <PlantImage> calls light up.
_safe(() => bridgeToImageRegistry(), 0);

/**
 * Composite runtime probe — returns the snapshot every diagnostic
 * surface uses. Pure read-only over the seeded registry.
 */
export function verifiedPlantMedia() {
  return _safe(() => {
    const summary = plantMediaSummary();
    const cache   = plantMediaCacheSnapshot();
    const verify  = plantImageVerificationSnapshot();
    const service = plantMediaServiceInfo();
    return Object.freeze({
      runtimeVersion: PLANT_MEDIA_SYSTEM_VERSION,
      generatedAt:    _now(),
      summary,
      cache,
      verification:   verify,
      service,
      versions: Object.freeze({
        registry:     PLANT_MEDIA_REGISTRY_VERSION,
        service:      PLANT_MEDIA_SERVICE_VERSION,
        cache:        PLANT_MEDIA_CACHE_VERSION,
        gallery:      PLANT_GALLERY_VERSION,
        verification: PLANT_IMAGE_VERIFICATION_VERSION,
      }),
      deferred: Object.freeze({
        cloudinaryUpload:
          'launch libraries declare the canonical plants/<folder>/<slug> '
          + 'URL convention; admins upload the actual JPGs into the '
          + 'farroway-media Cloudinary cloud. Missing assets degrade '
          + 'to placeholder via the 4-tier resolver (no crash).',
        moderationPersistence:
          'user-uploaded verification queue is in-memory only; the '
          + 'wave-5 server writer owns the durable moderation table.',
        offlineCacheStorage:
          'memory LRU emits cache:add/evict envelopes — the existing '
          + 'OfflineRuntime subscribes and decides whether to mirror '
          + 'URLs into the offline queue (wave-5 single-writer).',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_MEDIA_SYSTEM_VERSION,
    summary: null, cache: null, verification: null, service: null,
  }));
}

/**
 * Pin __plantMediaHealth() onto window for QA. Returns the same
 * envelope as verifiedPlantMedia() but logs to console for the
 * production introspection workflow.
 */
export function installPlantMediaGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__plantMediaHealth !== 'function') {
      w.__plantMediaHealth = function () {
        const out = verifiedPlantMedia();
        try { console.log('[Farroway · Plant Media health]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Registry
  registerPlantMediaBulk, bridgeToImageRegistry,
  plantMediaSummary, listMediaByType, PLANT_MEDIA_TYPES,
  PLANT_MEDIA_REGISTRY_VERSION,
  // Service
  buildMediaUrl, buildMediaUrlForType, buildMediaSet,
  mediaThumbnailUrl, plantMediaServiceInfo,
  PLANT_MEDIA_FOLDERS, PLANT_MEDIA_CLOUD_NAME,
  PLANT_MEDIA_SERVICE_VERSION,
  // Cache
  cacheMedia, getCachedMedia, listCachedKeys, cachedSize,
  subscribeMediaCacheEvents, clearMediaCache,
  plantMediaCacheSnapshot, CACHE_EVENT,
  PLANT_MEDIA_CACHE_VERSION, PLANT_MEDIA_CACHE_MAX,
  // Gallery
  composePlantGallery, composeReferenceImagesForScan,
  PLANT_GALLERY_VERSION,
  // Verification
  submitForVerification, approveVerification, rejectVerification,
  listPendingVerifications, listAllVerifications,
  plantImageVerificationSnapshot, VERIFICATION_STATUS,
  PLANT_IMAGE_VERIFICATION_VERSION,
};

export {
  registerPlantMedia, getPlantMedia, listPlantMedia, listMediaByPlant,
} from './PlantMediaRegistry';
export type { PlantMedia, PlantMediaType } from './PlantMediaRegistry';
