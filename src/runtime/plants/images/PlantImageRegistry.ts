/**
 * src/runtime/plants/images/PlantImageRegistry.ts — plant image
 * resolver with the 4-tier fallback hierarchy.
 *
 *   import {
 *     resolvePlantImage, registerVerifiedImage,
 *     PLANT_IMAGE_REGISTRY_VERSION, IMAGE_SOURCE,
 *   } from 'src/runtime/plants/images/PlantImageRegistry';
 *
 *   resolvePlantImage({ plantId, scanImage, plantLibraryImage })
 *
 * Fallback hierarchy (Phase spec):
 *   1. Verified Farroway image (registered via registerVerifiedImage)
 *   2. Plant library image      (caller-supplied, e.g. from PLANT_DB)
 *   3. Scan image               (caller-supplied scan thumbnail / URL)
 *   4. Placeholder              (a tiny inline SVG — no network)
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch. No localStorage writes.
 *   • Verified registry is module-state; intentionally a single
 *     mutable map for the in-app caller. Persistence is the
 *     caller's responsibility (wave-5 single-writer).
 *   • No PII handled.
 */

export const PLANT_IMAGE_REGISTRY_VERSION = 'plant-image-registry-v1';

export const IMAGE_SOURCE = Object.freeze({
  VERIFIED:     'verified',
  PLANT_LIBRARY: 'plant_library',
  SCAN:         'scan',
  PLACEHOLDER:  'placeholder',
});

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Inline placeholder — 1x1 transparent SVG. Safe for any
 * sandbox; never triggers a network request when no image is
 * available. Sized via CSS at the consumer.
 */
export const PLACEHOLDER_DATA_URI =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" '
  + 'viewBox="0 0 24 24" fill="none" stroke="%2394A3B8" '
  + 'stroke-width="1.5"><path d="M12 2a10 10 0 0 0 0 20"/>'
  + '<circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>'
  + '<path d="M9 16c1 .5 2 .5 3 .5s2 0 3-.5"/></svg>';

interface VerifiedEntry {
  imageUrl:      string;
  thumbnailUrl:  string;
  galleryImages: string[];
  registeredAt:  string;
}

const _verifiedById: Record<string, VerifiedEntry> = Object.create(null);

/**
 * Register a Farroway-verified image set for a plant id. The
 * content-team pipeline calls this at app boot (or via a hook
 * once an admin uploads images). Returns the new entry.
 */
export function registerVerifiedImage(plantId: string,
                                       entry: {
                                         imageUrl?: string;
                                         thumbnailUrl?: string;
                                         galleryImages?: string[];
                                       }) {
  return _safe(() => {
    const id = _str(plantId);
    if (!id || !_isObj(entry)) return null;
    const imageUrl     = _str(entry.imageUrl);
    if (!imageUrl) return null;
    const next: VerifiedEntry = {
      imageUrl,
      thumbnailUrl:  _str(entry.thumbnailUrl) || imageUrl,
      galleryImages: _arr(entry.galleryImages).map(_str)
                       .filter((u) => u.length > 0),
      registeredAt:  _safe(() => new Date().toISOString(), ''),
    };
    _verifiedById[id] = next;
    return Object.freeze({ plantId: id, ...next,
      galleryImages: Object.freeze(next.galleryImages.slice()) });
  }, null);
}

export function clearVerifiedImage(plantId: string) {
  return _safe(() => {
    const id = _str(plantId);
    if (id && _verifiedById[id]) { delete _verifiedById[id]; return true; }
    return false;
  }, false);
}

interface ResolveCtx {
  plantId?:           string;
  plantLibraryImage?: string;       // e.g. plant.image from PLANT_DB
  scanImage?:         string;       // caller-supplied scan thumbnail
  scanGallery?:       string[];     // additional scan-captured photos
}

/**
 * Returns the resolved image envelope:
 *   {
 *     imageUrl, thumbnailUrl, galleryImages[],
 *     source: 'verified' | 'plant_library' | 'scan' | 'placeholder',
 *     plantId,
 *   }
 *
 * Always returns a usable envelope — falls through to the
 * placeholder rather than null.
 */
export function resolvePlantImage(ctx: ResolveCtx) {
  return _safe(() => {
    const c    = _isObj(ctx) ? ctx : {} as ResolveCtx;
    const id   = _str(c.plantId);
    // 1. Verified Farroway image
    if (id && _verifiedById[id]) {
      const v = _verifiedById[id];
      return Object.freeze({
        runtimeVersion: PLANT_IMAGE_REGISTRY_VERSION,
        plantId: id,
        imageUrl:      v.imageUrl,
        thumbnailUrl:  v.thumbnailUrl,
        galleryImages: Object.freeze(v.galleryImages.slice()),
        source:        IMAGE_SOURCE.VERIFIED,
      });
    }
    // 2. Plant library image
    const lib = _str(c.plantLibraryImage);
    if (lib) {
      return Object.freeze({
        runtimeVersion: PLANT_IMAGE_REGISTRY_VERSION,
        plantId: id,
        imageUrl:      lib,
        thumbnailUrl:  lib,
        galleryImages: Object.freeze([]),
        source:        IMAGE_SOURCE.PLANT_LIBRARY,
      });
    }
    // 3. Scan image
    const scan = _str(c.scanImage);
    if (scan) {
      const gal = _arr(c.scanGallery).map(_str).filter((u) => !!u);
      return Object.freeze({
        runtimeVersion: PLANT_IMAGE_REGISTRY_VERSION,
        plantId: id,
        imageUrl:      scan,
        thumbnailUrl:  scan,
        galleryImages: Object.freeze(gal),
        source:        IMAGE_SOURCE.SCAN,
      });
    }
    // 4. Placeholder
    return Object.freeze({
      runtimeVersion: PLANT_IMAGE_REGISTRY_VERSION,
      plantId: id,
      imageUrl:      PLACEHOLDER_DATA_URI,
      thumbnailUrl:  PLACEHOLDER_DATA_URI,
      galleryImages: Object.freeze([]),
      source:        IMAGE_SOURCE.PLACEHOLDER,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_IMAGE_REGISTRY_VERSION,
    plantId: '',
    imageUrl:      PLACEHOLDER_DATA_URI,
    thumbnailUrl:  PLACEHOLDER_DATA_URI,
    galleryImages: Object.freeze([]),
    source:        IMAGE_SOURCE.PLACEHOLDER,
  }));
}

export function listVerifiedPlants() {
  return _safe(() => {
    return Object.freeze(Object.keys(_verifiedById).map((id) =>
      Object.freeze({
        plantId: id, ..._verifiedById[id],
        galleryImages: Object.freeze(_verifiedById[id].galleryImages.slice()),
      })
    ));
  }, Object.freeze([]));
}

/**
 * Test-only — wipe the verified-image map between specs.
 */
export function _resetVerifiedRegistry() {
  for (const k of Object.keys(_verifiedById)) delete _verifiedById[k];
}
