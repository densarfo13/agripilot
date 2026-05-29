/**
 * src/runtime/plants/media/PlantMediaService.ts — Cloudinary URL
 * builder + responsive-set helper for the Verified Plant Media
 * System.
 *
 *   import {
 *     buildMediaUrl, buildMediaSet, mediaThumbnailUrl,
 *     PLANT_MEDIA_FOLDERS, PLANT_MEDIA_CLOUD_NAME,
 *     PLANT_MEDIA_SERVICE_VERSION,
 *   } from 'src/runtime/plants/media/PlantMediaService';
 *
 *   buildMediaUrl('flowers', 'rose')
 *     → https://res.cloudinary.com/farroway-media/image/upload/
 *         plants/flowers/rose
 *
 * What this is
 * ────────────
 *   Pure URL builder that composes the older PlantImageService
 *   for actual transform injection. Centralises the folder
 *   convention so library seeds stay terse — they declare
 *   `{ plantId, slug }`, the service builds the canonical URL.
 *
 *   Auto format · auto quality · responsive sizes · lazy-loading
 *   are inherited from PlantImageService when the result is fed
 *   through buildMediaSet().
 *
 *   When the configured Cloudinary cloud has not yet uploaded
 *   the asset, the URL 404s and the 4-tier resolver in
 *   PlantImageRegistry degrades to the placeholder — the
 *   architecture is correct without requiring all photography
 *   uploaded in the same release.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch from this layer; URLs only.
 *   • No PII handled.
 */

import {
  buildResponsiveSet, optimizeForWidth, thumbnailUrl,
  RESPONSIVE_WIDTHS,
} from '../images/PlantImageService';
import type { PlantMedia } from './PlantMediaRegistry';

export const PLANT_MEDIA_SERVICE_VERSION = 'plant-media-service-v1';

/**
 * Cloudinary cloud name. Centralised so admin can switch via a
 * single constant. `farroway-media` is the canonical name; the
 * upload pipeline targets this cloud's `plants/` folder.
 */
export const PLANT_MEDIA_CLOUD_NAME = 'farroway-media';

const CLOUDINARY_BASE =
  'https://res.cloudinary.com/' + PLANT_MEDIA_CLOUD_NAME + '/image/upload';

/**
 * Folder convention from the spec — every media type has a
 * fixed sub-folder under `plants/`. The CI gate checks this
 * mapping stays in lockstep with PLANT_MEDIA_TYPES.
 */
export const PLANT_MEDIA_FOLDERS = Object.freeze({
  plant:      'plants',
  flower:     'flowers',
  fruit:      'fruits',
  vegetable:  'vegetables',
  herb:       'herbs',
  houseplant: 'houseplants',
  crop:       'crops',
  tree:       'trees',
  disease:    'diseases',
  pest:       'pests',
} as const);

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _slugRe = /[^a-z0-9-]+/g;

function _slug(s: string): string {
  return _str(s).toLowerCase().replace(_slugRe, '-').replace(/^-+|-+$/g, '');
}

/**
 * Build the canonical Cloudinary URL for a media asset.
 *   buildMediaUrl('flowers', 'rose')
 *     → https://res.cloudinary.com/farroway-media/image/upload/
 *         plants/flowers/rose
 *
 *   The returned URL is base-only (no transform); pipe it through
 *   buildMediaSet() / mediaThumbnailUrl() to get optimised
 *   variants. Cloudinary picks up `f_auto,q_auto` automatically
 *   once the older PlantImageService injects the transform.
 */
export function buildMediaUrl(folder: string, slug: string): string {
  return _safe(() => {
    const f = _slug(folder);
    const s = _slug(slug);
    if (!f || !s) return '';
    return CLOUDINARY_BASE + '/plants/' + f + '/' + s;
  }, '');
}

/**
 * Build URL from a PlantMedia type + slug (looks up folder).
 *   buildMediaUrlForType('flower', 'rose') →
 *     https://res.cloudinary.com/farroway-media/image/upload/
 *       plants/flowers/rose
 */
export function buildMediaUrlForType(type: string, slug: string): string {
  return _safe(() => {
    const folder = (PLANT_MEDIA_FOLDERS as any)[_str(type)];
    if (!folder) return '';
    return buildMediaUrl(folder, slug);
  }, '');
}

interface MediaSetCtx {
  widths?:         number[];
  sizes?:          string;
  productionMode?: boolean;
  alt?:            string;
}

/**
 * Build the responsive image set for a PlantMedia entry. Composes
 * the older PlantImageService.buildResponsiveSet — every consumer
 * gets `loading: 'lazy'` + `decoding: 'async'` + Cloudinary
 * transforms automatically.
 */
export function buildMediaSet(media: PlantMedia | string, ctx?: MediaSetCtx) {
  return _safe(() => {
    const url = typeof media === 'string'
      ? media
      : _str((media as any) && (media as any).imageUrl);
    return buildResponsiveSet(url, {
      widths: ctx && ctx.widths,
      sizes:  ctx && ctx.sizes,
      productionMode: ctx && ctx.productionMode,
      alt:    ctx && ctx.alt,
    });
  }, Object.freeze({
    src: '', srcSet: '', sizes: '',
    widths: Object.freeze([] as number[]),
    blocked: false,
    loading: 'lazy' as const, decoding: 'async' as const,
  }));
}

/**
 * Convenience — produce the smallest variant (thumbnail) for a
 * given media entry. Useful for cards / list rows / briefing
 * thumbnails where the hero set is overkill.
 */
export function mediaThumbnailUrl(media: PlantMedia | string,
                                    opts?: { width?: number }): string {
  return _safe(() => {
    const url = typeof media === 'string'
      ? media
      : _str((media as any) && (media as any).imageUrl);
    return thumbnailUrl(url, opts);
  }, '');
}

/** Re-exports so callers can import everything from one module. */
export { RESPONSIVE_WIDTHS, optimizeForWidth };

/**
 * Diagnostic — returns the configured cloud + folder map so QA
 * can confirm the deploy is pointing at the right asset bucket.
 */
export function plantMediaServiceInfo() {
  return Object.freeze({
    runtimeVersion: PLANT_MEDIA_SERVICE_VERSION,
    cloud:          PLANT_MEDIA_CLOUD_NAME,
    base:           CLOUDINARY_BASE,
    folders:        PLANT_MEDIA_FOLDERS,
    widths:         RESPONSIVE_WIDTHS,
  });
}
