/**
 * src/runtime/plants/images/PlantImageService.ts — Cloudinary-
 * aware URL transformer + responsive size + production-mode
 * cartoon block.
 *
 *   import {
 *     buildResponsiveSet, optimizeForWidth, blockedInProduction,
 *     PLANT_IMAGE_SERVICE_VERSION, RESPONSIVE_WIDTHS,
 *   } from 'src/runtime/plants/images/PlantImageService';
 *
 *   const set = buildResponsiveSet('/realism/flowers/rose.jpg');
 *   // → { src, srcSet, sizes, blocked }
 *
 * What this is
 * ────────────
 *   Pure URL transformer. Detects Cloudinary URLs and injects
 *   the appropriate `c_fill,w_NNN,q_auto,f_auto` transform
 *   segment for responsive variants. Non-Cloudinary URLs pass
 *   through unchanged (path-served assets work in dev).
 *
 *   "No cartoon illustrations in production" enforcement —
 *   when `process.env.NODE_ENV === 'production'` OR the caller
 *   passes `productionMode: true`, URLs matching cartoon /
 *   illustration / drawing / sketch patterns are blocked and
 *   replaced with an empty-string result the consumer can fall
 *   back from.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch. No persistence.
 *   • String manipulation only — no eval, no dynamic imports.
 */

export const PLANT_IMAGE_SERVICE_VERSION = 'plant-image-service-v1';

/**
 * Responsive width breakpoints — covers thumbnail (mobile list
 * row), card (small grid), hero (profile + cards), 2x (retina).
 */
export const RESPONSIVE_WIDTHS = Object.freeze([96, 192, 384, 768, 1280]);

/**
 * Default sizes attribute — caller can override via
 * buildResponsiveSet({ sizes }).
 */
export const DEFAULT_SIZES =
  '(max-width: 640px) 96vw, (max-width: 1024px) 48vw, 384px';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// Cloudinary URL format:
//   https://res.cloudinary.com/<cloud>/image/upload/<transforms>/<asset>
//   https://res.cloudinary.com/<cloud>/image/upload/v123/<asset>
const CLOUDINARY_HOST_RE = /\bres\.cloudinary\.com\b/i;
const CLOUDINARY_UPLOAD_RE = /(\/image\/upload\/)(?!v\d+\/)(.+)/i;
const CLOUDINARY_VERSIONED_RE = /(\/image\/upload\/v\d+\/)(.+)/i;

const CARTOON_BLOCK_RE = /\b(cartoon|illustration|illustrative|drawing|sketch|clip[-_]?art|vector[-_]?art|comic)\b/i;

function _isProductionMode(opts?: { productionMode?: boolean }): boolean {
  if (_isObj(opts) && typeof opts.productionMode === 'boolean') {
    return opts.productionMode;
  }
  return _safe(() => {
    if (typeof process === 'undefined') return false;
    return process.env && process.env.NODE_ENV === 'production';
  }, false);
}

/**
 * Return true when this URL would be blocked in production mode.
 * Cartoon / illustration / sketch / clip-art / vector-art /
 * comic substrings flag the URL as non-photorealistic.
 */
export function blockedInProduction(url: string,
                                      opts?: { productionMode?: boolean }): boolean {
  return _safe(() => {
    if (!_isProductionMode(opts)) return false;
    const u = _str(url);
    if (!u) return false;
    return CARTOON_BLOCK_RE.test(u);
  }, false);
}

/**
 * Inject Cloudinary transform parameters for the requested
 * width. Non-Cloudinary URLs pass through unchanged. Already-
 * versioned upload paths get the transform inserted BEFORE the
 * version segment.
 */
export function optimizeForWidth(url: string, width: number,
                                   opts?: {
                                     quality?: 'auto' | number;
                                     format?: 'auto' | 'jpg' | 'webp';
                                     crop?: 'fill' | 'fit' | 'scale';
                                   }): string {
  return _safe(() => {
    const u = _str(url);
    const w = _num(width);
    if (!u || w == null || w <= 0) return u;
    if (!CLOUDINARY_HOST_RE.test(u)) return u; // non-Cloudinary passthrough
    const quality = _isObj(opts) && opts.quality != null
      ? (typeof opts.quality === 'number' ? 'q_' + opts.quality : 'q_auto')
      : 'q_auto';
    const format = _isObj(opts) && opts.format
      ? 'f_' + opts.format : 'f_auto';
    const crop = _isObj(opts) && opts.crop
      ? 'c_' + opts.crop : 'c_fill';
    const transform = [crop, 'w_' + w, quality, format].join(',');
    // Insert transform right after `/image/upload/`
    if (CLOUDINARY_VERSIONED_RE.test(u)) {
      return u.replace(CLOUDINARY_VERSIONED_RE,
        '/image/upload/' + transform + '/$1$2'.replace('$1$2', 'v$1$2'))
        .replace('/v$1', '/').replace('/upload/' + transform + '//', '/upload/' + transform + '/');
    }
    return u.replace(CLOUDINARY_UPLOAD_RE, '$1' + transform + '/$2');
  }, _str(url));
}

interface ResponsiveCtx {
  sizes?:          string;
  widths?:         number[];
  productionMode?: boolean;
  alt?:            string;
}

/**
 * Build a responsive image set:
 *   {
 *     src,                 — base URL (largest width or original)
 *     srcSet,              — comma-separated `url WIDTHw` pairs
 *     sizes,               — sizes attribute (defaultable)
 *     widths,              — widths used
 *     blocked,             — true when productionMode blocked this URL
 *     loading,             — always 'lazy'
 *     decoding,            — 'async'
 *   }
 */
export function buildResponsiveSet(url: string, ctx?: ResponsiveCtx) {
  return _safe(() => {
    const u = _str(url);
    const c = _isObj(ctx) ? ctx : {} as ResponsiveCtx;
    if (!u) {
      return Object.freeze({
        runtimeVersion: PLANT_IMAGE_SERVICE_VERSION,
        src: '', srcSet: '', sizes: '',
        widths: Object.freeze([] as number[]),
        blocked: false,
        loading: 'lazy' as const, decoding: 'async' as const,
      });
    }
    if (blockedInProduction(u, { productionMode: c.productionMode })) {
      return Object.freeze({
        runtimeVersion: PLANT_IMAGE_SERVICE_VERSION,
        src: '', srcSet: '', sizes: '',
        widths: Object.freeze([] as number[]),
        blocked: true,
        loading: 'lazy' as const, decoding: 'async' as const,
      });
    }
    const widths = (Array.isArray(c.widths) && c.widths.length > 0
      ? c.widths : RESPONSIVE_WIDTHS).slice();
    const pairs: string[] = [];
    for (const w of widths) {
      const optimized = optimizeForWidth(u, w);
      if (!optimized) continue;
      pairs.push(optimized + ' ' + w + 'w');
    }
    const largest = widths[widths.length - 1];
    return Object.freeze({
      runtimeVersion: PLANT_IMAGE_SERVICE_VERSION,
      src:     optimizeForWidth(u, largest),
      srcSet:  pairs.join(', '),
      sizes:   _str(c.sizes) || DEFAULT_SIZES,
      widths:  Object.freeze(widths.slice()),
      blocked: false,
      loading: 'lazy' as const,
      decoding: 'async' as const,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_IMAGE_SERVICE_VERSION,
    src: '', srcSet: '', sizes: '',
    widths: Object.freeze([] as number[]),
    blocked: false,
    loading: 'lazy' as const, decoding: 'async' as const,
  }));
}

/**
 * Pure helper — call from any UI to get a thumbnail-sized URL.
 * Defaults to the smallest responsive width.
 */
export function thumbnailUrl(url: string,
                               opts?: { width?: number }) {
  return _safe(() => {
    const w = _isObj(opts) && _num(opts.width) != null
      ? (opts.width as number)
      : RESPONSIVE_WIDTHS[0];
    return optimizeForWidth(_str(url), w);
  }, _str(url));
}
