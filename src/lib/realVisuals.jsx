/**
 * realVisuals — single entry point for the realism image system.
 *
 *   import {
 *     resolveHeroImage,
 *     resolveWeatherImage,
 *     resolveScanImage,
 *     resolveCropCloseupImage,
 *     resolveJournalImage,
 *     getCropImage,
 *     getPlantImage,
 *     getModeHeroImage,
 *     getWeatherVisual,
 *     RealisticPhotoFallback,
 *   } from 'src/lib/realVisuals.js';
 *
 * Maps real photographs uploaded to public/assets/realism/ to
 * the right context (Home hero / My Farm closeup / Scan macro /
 * Weather state / Journal documentary).
 *
 * Asset inventory (May 2026 operator upload)
 * ──────────────────────────────────────────
 *   heroes/   environmental scene imagery for Home hero
 *   farm/     crop-specific closeups for My Farm
 *   scan/     scientific macro leaf imagery for Scan results
 *   weather/  adaptive environmental states
 *   journal/  documentary farming moments
 *
 * No more SVG crop graphics, no emoji visuals. When a real
 * photo doesn't match a given context the resolver returns
 * null — the consumer falls back to the calm
 * RealisticPhotoFallback placeholder.
 *
 * Strict-rule audit
 *   • Pure resolvers. No fetches, no React state. SSR-safe.
 *   • Frozen exports.
 *   • All paths are root-relative (Vite serves public/ at /).
 */

import React from 'react';
import RealisticPhotoFallback from '../assets/realism/photography/RealisticPhotoFallback.jsx';
import { normaliseCrop } from '../assets/realism/cropImages.jsx';
import { resolveRegion } from './regions.js';

// ─── Asset paths (exact filenames as uploaded) ──────────────────
// Filenames preserve the operator's upload — some carry a
// `.webp.jpeg` double extension because that's how the export
// pipeline saved them. Browsers serve them correctly regardless;
// MIME type comes from the actual bytes, not the file ext.

const ASSETS = Object.freeze({
  heroes: {
    farmDefault:    '/assets/realism/heroes/africa-farm-atmosphere.jpeg',
    farmSunrise:    '/assets/realism/heroes/afrca-sunrise-farm.webp.jpeg',
    farmIrrigation: '/assets/realism/heroes/africa-irrigation.webp.jpeg',
    riceField:      '/assets/realism/heroes/vietnam-misty-rice.webp.jpeg',
  },
  farm: {
    cassava: '/assets/realism/farm/cassava-leaf.webp.jpeg',
    pepper:  '/assets/realism/farm/pepper-closeup.webp.jpeg',
    tomato:  '/assets/realism/farm/tomato-greenhouse.webp.jpeg',
  },
  scan: {
    healthy: '/assets/realism/scan/healthy-leaf.webp.jpeg',
    disease: '/assets/realism/scan/disease-leaf.webp.jpeg',
    fungal:  '/assets/realism/scan/fungal-leaf.webp.jpeg',
    pest:    '/assets/realism/scan/pest-leaf.webp.jpeg',
  },
  weather: {
    rain:    '/assets/realism/weather/rain-crops.webp.jpeg',
    storm:   '/assets/realism/weather/storm-farm.webp.jpeg',
    drought: '/assets/realism/weather/drought-soil.webp.jpeg',
    misty:   '/assets/realism/weather/misty-morning.webp.jpeg',
  },
  journal: {
    inspection: '/assets/realism/journal/farm-inspection.jpeg',
    greenhouse: '/assets/realism/journal/greenhouse-work.webp.jpeg',
  },
});

// ─── Crop → closeup mapping (My Farm) ──────────────────────────
// When a farmer has a crop on file AND we ship a closeup photo
// for it, the My Farm hero AND the Home hero swap to that
// closeup. Otherwise the Home hero uses an environmental shot.

const CROP_CLOSEUP = Object.freeze({
  cassava: ASSETS.farm.cassava,
  pepper:  ASSETS.farm.pepper,
  tomato:  ASSETS.farm.tomato,
});

// ─── Regional pack heroes ──────────────────────────────────────
// Five regional clusters keyed off resolveRegion(country, crop):
//
//   africa         — uploaded set (sunrise / atmosphere / irrigation)
//   asia           — uploaded set (vietnam misty rice, future expansion)
//   latin-america  — no commissioned shoot yet (May 2026)
//   north-america  — no commissioned shoot yet
//   middle-east    — no commissioned shoot yet
//
// When a regional pack has no commissioned photo for the slot,
// the resolver falls through to the default africa-farm-atmosphere
// shot (the calmest, most universally-readable agricultural
// frame in the upload). Drop new region packs under
//   public/assets/realism/regions/<region>/
// then add the slot path to REGION_HERO_PACK below — no other
// code change needed.

const REGION_HERO_PACK = Object.freeze({
  africa: [
    ASSETS.heroes.farmDefault,
    ASSETS.heroes.farmSunrise,
    ASSETS.heroes.farmIrrigation,
  ],
  asia: [
    ASSETS.heroes.riceField,
  ],
  // The three packs below are intentionally empty arrays. The
  // resolver picks them up automatically when assets land at
  // /assets/realism/regions/<region>/. Until then,
  // resolveHeroImage falls through to the africa-default frame.
  'latin-america': [],
  'north-america': [],
  'middle-east':   [],
});

// Pick a stable photo from a regional pack. We hash the crop +
// hour so a given farmer sees a consistent shot per session
// (no flickering) but different farmers see different photos.
function _pickFromPack(pack, seed) {
  if (!Array.isArray(pack) || pack.length === 0) return null;
  if (pack.length === 1) return pack[0];
  const s = String(seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return pack[s % pack.length];
}

// Legacy back-compat — kept as a single-entry lookup for any
// caller that still imports REGION_HERO directly. New code
// should use the pack-aware resolver below.
const REGION_HERO = Object.freeze({
  asia:    ASSETS.heroes.riceField,
  africa:  ASSETS.heroes.farmDefault,
});

// ─── Weather state → backdrop ─────────────────────────────────

const WEATHER_TO_IMAGE = Object.freeze({
  rain:    ASSETS.weather.rain,
  storm:   ASSETS.weather.storm,
  drought: ASSETS.weather.drought,
  heat:    ASSETS.weather.drought,
  dry:     ASSETS.weather.drought,
  fog:     ASSETS.weather.misty,
  misty:   ASSETS.weather.misty,
  cloudy:  ASSETS.weather.misty,
  // For sunny / clear / partly the hero photo set carries the
  // better light — fall back to the environmental sunrise hero.
  sunny:   ASSETS.heroes.farmSunrise,
  clear:   ASSETS.heroes.farmSunrise,
  partly:  ASSETS.heroes.farmSunrise,
  sunrise: ASSETS.heroes.farmSunrise,
});

// ─── Scan finding → macro image ────────────────────────────────
// Maps the existing scan-history `category` value (or a more
// specific severity tag) to the right scientific macro photo.

const SCAN_TO_IMAGE = Object.freeze({
  healthy:           ASSETS.scan.healthy,
  no_issue_detected: ASSETS.scan.healthy,
  disease:           ASSETS.scan.disease,
  fungal:            ASSETS.scan.fungal,
  fungus:            ASSETS.scan.fungal,
  pest:              ASSETS.scan.pest,
  insect:            ASSETS.scan.pest,
  // Generic concern → disease (most representative)
  concern:           ASSETS.scan.disease,
  critical:          ASSETS.scan.disease,
  needs_review:      ASSETS.scan.disease,
});

// ─── Public resolvers ──────────────────────────────────────────

/**
 * Home hero — environmental imagery keyed on:
 *   1. Active crop → closeup if we ship one (ownership wins)
 *   2. Weather state → adaptive environmental shot
 *   3. Regional pack (country/crop → cluster) → pack photo
 *   4. Time-of-day fallback (hour 5-8 → sunrise)
 *   5. Final fallback → africa-farm-atmosphere
 *
 * `country` is preferred over `region`. When country resolves
 * to a regional cluster we serve a photo from that cluster's
 * pack; if the cluster has no commissioned assets yet, the
 * resolver falls through to the global default.
 */
export function resolveHeroImage({
  mode = 'farm',
  crop = null,
  weatherType = null,
  region = null,
  country = null,
  hour = null,
} = {}) {
  const cropKey = crop ? normaliseCrop(crop) : null;

  // Garden mode has no dedicated hero asset shipped yet. Reuse
  // the calmer farm-default photo for now; greenhouse journal
  // shot reads as garden-adjacent on My Grow.
  if (String(mode || 'farm').toLowerCase() === 'garden') {
    return ASSETS.journal.greenhouse;
  }

  // 1. Crop closeup wins when available — most personal.
  if (cropKey && CROP_CLOSEUP[cropKey]) return CROP_CLOSEUP[cropKey];

  // 2. Weather state — drought/rain/storm imagery is more
  //    evocative than a generic farm shot when the day's
  //    conditions are noteworthy.
  const w = weatherType ? String(weatherType).toLowerCase() : null;
  if (w === 'rain' || w === 'storm') return WEATHER_TO_IMAGE[w];
  if (w === 'drought' || w === 'heat' || w === 'dry') return ASSETS.weather.drought;
  if (w === 'fog' || w === 'misty' || w === 'cloudy') return ASSETS.weather.misty;

  // 3. Regional pack — country → cluster → pack array. The pack
  //    rotates by a stable hash of (crop, hour) so the same
  //    farmer sees a consistent photo per session but different
  //    farmers see different shots. Empty packs fall through.
  const cluster = resolveRegion({ country, crop: cropKey })
                  || (region ? String(region).toLowerCase() : null);
  if (cluster && REGION_HERO_PACK[cluster] && REGION_HERO_PACK[cluster].length > 0) {
    const seed = `${cropKey || 'crop'}-${cluster}`;
    const fromPack = _pickFromPack(REGION_HERO_PACK[cluster], seed);
    if (fromPack) return fromPack;
  }
  // Back-compat: callers that still pass the legacy single-key
  // region prop get the single-photo lookup.
  if (region && REGION_HERO[String(region).toLowerCase()]) {
    return REGION_HERO[String(region).toLowerCase()];
  }

  // 4. Time-of-day — sunrise hero in the 5-8 hour band.
  const h = Number.isFinite(hour) ? hour : null;
  if (h != null && h >= 5 && h < 8) return ASSETS.heroes.farmSunrise;

  // 5. Final fallback — africa-farm-atmosphere (the calmest, most
  //    universally-readable frame in the upload).
  return ASSETS.heroes.farmDefault;
}

/**
 * Weather card backdrop — pure mapping from weatherType to image.
 * Returns null when no real image fits so the existing
 * DynamicWeatherBackdrop CSS atmosphere can stand in.
 */
export function resolveWeatherImage(weatherType) {
  if (!weatherType || typeof weatherType !== 'string') return null;
  return WEATHER_TO_IMAGE[weatherType.toLowerCase()] || null;
}

/**
 * Scan macro image — keyed off the scan category / severity.
 * Used by the scan result card to show a representative leaf
 * photo (healthy / disease / fungal / pest).
 */
export function resolveScanImage(categoryOrSeverity) {
  if (!categoryOrSeverity || typeof categoryOrSeverity !== 'string') return null;
  return SCAN_TO_IMAGE[categoryOrSeverity.toLowerCase()] || null;
}

/**
 * Crop closeup — used by My Farm to show the active crop's
 * field-level macro. Returns null when we don't ship one for
 * the crop; caller falls back to the hero photo.
 */
export function resolveCropCloseupImage(crop) {
  if (!crop || typeof crop !== 'string') return null;
  const key = normaliseCrop(crop);
  return CROP_CLOSEUP[key] || null;
}

/**
 * Journal documentary moment — keyed off optional context
 * ('greenhouse' → the greenhouse-work shot, else farm
 * inspection). Garden mode reuses the greenhouse shot.
 */
export function resolveJournalImage(context = '') {
  const c = String(context || '').toLowerCase();
  if (c.includes('greenhouse') || c.includes('garden') || c === 'garden') {
    return ASSETS.journal.greenhouse;
  }
  return ASSETS.journal.inspection;
}

// ─── Spec §5 surface-named helpers (back-compat) ───────────────

export function getCropImage(cropName) {
  const closeup = resolveCropCloseupImage(cropName);
  if (closeup) return { kind: 'photo', src: closeup };
  const hero = resolveHeroImage({ mode: 'farm', crop: cropName });
  return { kind: 'photo', src: hero };
}

export function getPlantImage(plantName) {
  const closeup = resolveCropCloseupImage(plantName);
  if (closeup) return { kind: 'photo', src: closeup };
  return { kind: 'photo', src: resolveHeroImage({ mode: 'garden', crop: plantName }) };
}

export function getModeHeroImage(mode) {
  return { kind: 'photo', src: resolveHeroImage({ mode }) };
}

export function getWeatherVisual(condition) {
  const path = resolveWeatherImage(condition);
  if (path) return { kind: 'photo', src: path };
  return { kind: 'photo', src: ASSETS.heroes.farmDefault };
}

// ─── Render-ready component ────────────────────────────────────

export default function RealVisual({
  src,
  alt = '',
  rounded = 16,
  testId = 'real-visual',
  fallback = null,
  ...rest
}) {
  const [errored, setErrored] = React.useState(false);
  if (errored || !src) {
    return fallback || (
      <RealisticPhotoFallback rounded={rounded} testId={`${testId}-fallback`} {...rest} />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: rounded,
        display: 'block',
      }}
      data-testid={testId}
      data-kind="photo"
      {...rest}
    />
  );
}

export { RealisticPhotoFallback };

// Diagnostics — exposed for admin + test surfaces.
export const _internal = Object.freeze({
  ASSETS,
  CROP_CLOSEUP,
  WEATHER_TO_IMAGE,
  SCAN_TO_IMAGE,
  REGION_HERO,
});
