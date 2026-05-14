/**
 * pageHeroImages — canonical image map for every main nav page.
 *
 *   import { getPageHeroImage } from '../constants/pageHeroImages.js';
 *
 *   const url = getPageHeroImage('tasks');
 *   //   /assets/realism/heroes/afrca-sunrise-farm.jpeg
 *
 * Why this exists
 *   Visual Header Consistency Fix — Tasks, Sell, SoilScan, and a
 *   couple of secondary pages used to point at flat SVG
 *   illustrations under `/images/page-hero/*.svg`, which read as
 *   "dashboard art" rather than realistic farm imagery. The
 *   image map below routes each page key to a real photo from
 *   the realism asset library so every hero looks like the
 *   Home / Funding / Sell tier even on devices that previously
 *   rendered the SVG flat.
 *
 *   The mapping is keyed by short page identifiers — NOT route
 *   paths — so a future rename of `/today` to `/tasks` etc.
 *   does not require touching this map.
 *
 * Strict-rule audit
 *   * Pure data module — no React, no DOM, no storage.
 *   * Frozen so consumers can't mutate the registry at runtime.
 *   * Every value passes through safeImage in the public lookup
 *     helper so a typo can never produce a broken-image icon.
 */

import { safeImage, DEFAULT_FARM_IMAGE } from '../utils/safeImage.js';

// All assets live in /public/assets/realism — they're real
// jpegs commissioned for the realism library. Each page key
// maps to a single canonical photo. Where realism has a
// closer thematic match (scan → close-up leaf), we use it.
export const PAGE_HERO_IMAGES = Object.freeze({
  home:     '/assets/realism/heroes/africa-farm-atmosphere.jpeg',
  tasks:    '/assets/realism/heroes/afrca-sunrise-farm.jpeg',
  myFarm:   '/assets/realism/farm/IMG_5985.jpeg',
  progress: '/assets/realism/journal/farm-inspection.jpeg',
  scan:     '/assets/realism/scan/healthy-leaf.jpeg',
  funding:  '/assets/realism/heroes/africa-farm-atmosphere.jpeg',
  sell:     '/assets/realism/journal/IMG_5990.jpeg',
  journal:  '/assets/realism/journal/greenhouse-work.jpeg',
  admin:    '/assets/realism/heroes/africa-farm-atmosphere.jpeg',
  ngo:      '/assets/realism/heroes/afrca-sunrise-farm.jpeg',
  buyer:    '/assets/realism/journal/IMG_5990.jpeg',
});

/**
 * Look up the canonical hero image for a page key. Returns the
 * default farm photo when the key is unknown or the mapped value
 * fails the render-safety check.
 *
 * @param {string} pageKey
 * @returns {string}  always a render-safe URL
 */
export function getPageHeroImage(pageKey) {
  if (typeof pageKey !== 'string' || !pageKey.trim()) {
    return DEFAULT_FARM_IMAGE;
  }
  const value = PAGE_HERO_IMAGES[pageKey.trim()];
  return safeImage(value, DEFAULT_FARM_IMAGE);
}

const _module = {
  PAGE_HERO_IMAGES,
  getPageHeroImage,
  DEFAULT_FARM_IMAGE,
};
export default _module;
