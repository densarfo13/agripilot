/**
 * pageHeroImages — canonical image map for every main nav page.
 *
 *   import { getPageHeroImage } from '../constants/pageHeroImages.js';
 *
 *   const url = getPageHeroImage('tasks');
 *   //   /assets/realism/heroes/africa-sunrise-farm.jpeg
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
 *   Every value is sourced from `REALISM_ASSETS` so the
 *   check:assets script stays satisfied — there are no raw
 *   `/assets/realism/...` string literals in this file.
 *
 * Strict-rule audit
 *   * Pure data module — no React, no DOM, no storage.
 *   * Frozen so consumers can't mutate the registry at runtime.
 *   * Every value passes through safeImage in the public lookup
 *     helper so a typo can never produce a broken-image icon.
 */

import { REALISM_ASSETS } from '../lib/realVisuals.jsx';
import { safeImage, DEFAULT_FARM_IMAGE } from '../utils/safeImage.js';

// All assets come from REALISM_ASSETS so check:assets stays
// satisfied. Each page key maps to a single canonical photo.
// Where realism has a closer thematic match (scan → close-up
// leaf), we use it.
export const PAGE_HERO_IMAGES = Object.freeze({
  home:     REALISM_ASSETS.heroes.farmDefault,
  tasks:    REALISM_ASSETS.heroes.farmSunrise,
  myFarm:   REALISM_ASSETS.farm.generic2,
  progress: REALISM_ASSETS.journal.inspection,
  scan:     REALISM_ASSETS.scan.healthy,
  funding:  REALISM_ASSETS.heroes.farmDefault,
  sell:     REALISM_ASSETS.journal.moment1,
  journal:  REALISM_ASSETS.journal.greenhouse,
  admin:    REALISM_ASSETS.heroes.farmDefault,
  ngo:      REALISM_ASSETS.heroes.farmSunrise,
  buyer:    REALISM_ASSETS.journal.moment1,
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
