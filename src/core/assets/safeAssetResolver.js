/**
 * safeAssetResolver.js — resolve an image path to a guaranteed-
 * renderable URL, with a fallback chain so a missing/typo'd asset
 * never produces the broken-image "?" icon.
 *
 *   import { resolveAsset, resolveImageWithFallback,
 *            DEFAULT_IMAGE_FALLBACKS }
 *     from 'src/core/assets/safeAssetResolver.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small pure registry of preferred-vs-fallback paths the UI
 *   can hand to <img onerror>. It does NOT call `fetch` to verify
 *   the file exists (that would block the render); it provides a
 *   tested fallback chain so a 404 silently falls through to the
 *   next path.
 *
 *   The existing `check:assets` / `check:production-assets` gates
 *   already block CI on missing manifest entries — this module is
 *   the RUNTIME safety net for everything else.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';
import { REALISM_ASSETS } from '../../lib/realVisuals.jsx';

/** A small generic image we know is always present. */
export const LAST_RESORT_IMAGE = '/icons/farroway-mark.svg';

// Pull realism heroes through the canonical registry so the
// check:assets gate stays happy (no rogue literals under src/).
const _HERO_FARM_SUNRISE = REALISM_ASSETS && REALISM_ASSETS.heroes
  && REALISM_ASSETS.heroes.farmSunrise
    ? REALISM_ASSETS.heroes.farmSunrise
    : '/icons/farroway-mark.jpg';

/**
 * Canonical fallback chains for known-finicky assets.
 * Order: most preferred → most generic. The last entry should
 * always be a guaranteed-present asset.
 */
export const DEFAULT_IMAGE_FALLBACKS = Object.freeze({
  'africa-sunrise-farm':
    Object.freeze([
      _HERO_FARM_SUNRISE,
      '/icons/farroway-mark.jpg',
      LAST_RESORT_IMAGE,
    ]),
  'logo-premium':
    Object.freeze([
      '/icons/logo-premium.jpg',
      '/icons/logo-premium-512.jpg',
      LAST_RESORT_IMAGE,
    ]),
  'logo-premium-192':
    Object.freeze([
      '/icons/logo-premium-192.jpg',
      '/icons/logo-premium.jpg',
      LAST_RESORT_IMAGE,
    ]),
});

function _normalize(p) {
  if (!p || typeof p !== 'string') return '';
  return p.startsWith('/') ? p : `/${p}`;
}

/**
 * Resolve a "key or path" to a concrete URL — returns the first
 * candidate. The caller wires `onError` to call `resolveAsset(key,
 * { failedSoFar: [previousUrl, ...] })` to advance the chain.
 *
 * @param {string} keyOrPath  either a known fallback key
 *                            (`'logo-premium-192'`) or a raw path
 * @param {object} [opts]
 * @param {string[]} [opts.failedSoFar]  urls that already errored
 * @returns {string}  next URL to try (or the last-resort image)
 */
export function resolveAsset(keyOrPath, opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const failed = new Set((Array.isArray(o.failedSoFar) ? o.failedSoFar : []).map(_normalize));
    const chain = DEFAULT_IMAGE_FALLBACKS[keyOrPath]
      ? DEFAULT_IMAGE_FALLBACKS[keyOrPath].slice()
      : [_normalize(keyOrPath), LAST_RESORT_IMAGE];

    for (const candidate of chain) {
      const url = _normalize(candidate);
      if (url && !failed.has(url)) return url;
    }
    return LAST_RESORT_IMAGE;
  } catch {
    return LAST_RESORT_IMAGE;
  }
}

/**
 * Build a small descriptor an `<img>` component can use directly:
 *   { src, onError }   where onError advances the chain.
 *
 * @param {string} keyOrPath
 * @returns {{ initialSrc:string, nextOnError:(currentUrl:string,
 *             failedSoFar?:string[]) => string }}
 */
export function resolveImageWithFallback(keyOrPath) {
  const initial = resolveAsset(keyOrPath);
  return {
    initialSrc: initial,
    nextOnError: (currentUrl, failedSoFar) => {
      const list = Array.isArray(failedSoFar) ? failedSoFar.slice() : [];
      if (currentUrl) list.push(currentUrl);
      // Tally the miss so the dashboard can spot bad-path regressions.
      try { recordObservation(OBSERVABILITY.ASSET_FALLBACK); } catch { /* ignore */ }
      return resolveAsset(keyOrPath, { failedSoFar: list });
    },
  };
}

const _module = {
  DEFAULT_IMAGE_FALLBACKS, LAST_RESORT_IMAGE,
  resolveAsset, resolveImageWithFallback,
};
export default _module;
