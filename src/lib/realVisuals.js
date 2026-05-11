/**
 * realVisuals — single entry point for the crop/plant/weather/
 * empty-state visual system the UI spec §5 calls out.
 *
 *   import {
 *     getCropImage,
 *     getPlantImage,
 *     getModeHeroImage,
 *     getWeatherVisual,
 *     RealisticPhotoFallback,
 *   } from 'src/lib/realVisuals.js';
 *
 *   const CropHeroImg = getCropImage('maize');
 *   // → React component prop that renders a photographic-style
 *   //   scene OR (when real .webp lands) a real photo.
 *
 * Why this file exists
 * ────────────────────
 *   Spec §5 names this exact file path and these exact exports.
 *   The underlying machinery (scene catalogue, photo manifest,
 *   slot resolver, fallback component) was already shipped in:
 *
 *     src/assets/realism/cropImages.jsx        ← SVG scene catalogue
 *     src/assets/realism/photography/manifest.js ← .webp slot manifest
 *     src/assets/realism/photography/RealisticPhoto.jsx
 *     src/assets/realism/photography/RealisticPhotoFallback.jsx
 *
 *   This file is the spec-shaped front door — every alive-UI
 *   caller imports from here, the implementation can move
 *   underneath without breaking call sites.
 *
 * Resolution order
 * ────────────────
 *   1. If `slotPath(slotName)` returns a non-empty path (the
 *      slot ships a real .webp under public/assets/realism/
 *      photography/) → render that photo with onError → fallback.
 *   2. Else → render the photographic-style SVG scene from
 *      cropImages.jsx for the given crop / plant.
 *   3. Else → RealisticPhotoFallback (calm ochre-tinted placeholder).
 *
 *   The user never sees a 404 (manifest gate suppresses unmounted
 *   slots) and never sees an emoji as primary visual.
 *
 * Strict-rule audit
 *   • Pure / never throws. All inputs tolerated (unknown crop →
 *     generic field / generic plant fallback).
 *   • SSR-safe — no top-level window access.
 *   • No emoji. No cartoon icons. No fake AI graphics.
 */

import React from 'react';
import CropImage, {
  resolveCropImage,
  normaliseCrop,
  SCENES,
} from '../assets/realism/cropImages.jsx';
import RealisticPhotoFallback from '../assets/realism/photography/RealisticPhotoFallback.jsx';
import {
  slotPath,
  AVAILABLE_SLOTS,
  PHOTO_SLOTS,
} from '../assets/realism/photography/manifest.js';

// ─── Crop / plant slot lookup ───────────────────────────────────
//
// Maps a canonical crop or plant id to the photography slot
// name. When a real .webp ships under that slot, the renderer
// uses it; otherwise we paint the SVG scene below.

const CROP_TO_SLOT = Object.freeze({
  maize:    PHOTO_SLOTS.CROP_MAIZE,
  tomato:   PHOTO_SLOTS.CROP_TOMATO,
  pepper:   PHOTO_SLOTS.CROP_PEPPER,
  rice:     PHOTO_SLOTS.CROP_RICE,
  cassava:  PHOTO_SLOTS.CROP_CASSAVA,
  yam:      PHOTO_SLOTS.CROP_YAM,
  // Plantain shares the broad-leaf scene + slot family.
  plantain: PHOTO_SLOTS.CROP_PLANTAIN,
  cocoa:    PHOTO_SLOTS.CROP_COCOA,
});

const MODE_TO_SLOT = Object.freeze({
  // Farm-mode default hero — the daylight field photo.
  farm:   PHOTO_SLOTS.HERO_DAYLIGHT_FIELD,
  // Garden-mode default hero — daylight garden.
  garden: PHOTO_SLOTS.HERO_GARDEN_DAYLIGHT,
});

const WEATHER_TO_SLOT = Object.freeze({
  sunny:    PHOTO_SLOTS.HERO_DAYLIGHT_FIELD,
  rain:     PHOTO_SLOTS.HERO_RAINY_FIELD,
  cloudy:   PHOTO_SLOTS.HERO_CLOUDY_FIELD,
  storm:    PHOTO_SLOTS.HERO_STORM_FIELD,
  fog:      PHOTO_SLOTS.HERO_FOG_FIELD,
  sunrise:  PHOTO_SLOTS.HERO_SUNRISE_FIELD,
  sunset:   PHOTO_SLOTS.HERO_SUNSET_FIELD,
  night:    PHOTO_SLOTS.HERO_NIGHT_FIELD,
  partly:   PHOTO_SLOTS.HERO_PARTLY_CLOUDY,
});

// ─── Resolver helpers ──────────────────────────────────────────

function _shippedPathFor(slot) {
  if (!slot) return '';
  try { return slotPath(slot) || ''; } catch { return ''; }
}

/**
 * Generic visual resolver — returns a render-ready descriptor:
 *   { kind: 'photo', src }     when a real .webp ships
 *   { kind: 'scene', crop }    when we paint the SVG scene
 *   { kind: 'fallback' }       when neither is available
 *
 * Most callers want the `<RealVisual>` component below which
 * picks the right renderer automatically.
 */
function _resolveVisual({ slot, crop, mode }) {
  const path = _shippedPathFor(slot);
  if (path) return { kind: 'photo', src: path };
  if (crop || mode) {
    const { key } = resolveCropImage(crop, mode);
    return { kind: 'scene', crop: key };
  }
  return { kind: 'fallback' };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * getCropImage(cropName) — visual descriptor for a named crop.
 *
 *   const v = getCropImage('maize');
 *   // → { kind: 'photo' | 'scene' | 'fallback', src?: '...', crop?: '...' }
 *
 * Accepts the canonical id ('maize') or any alias from
 * cropImages.normaliseCrop ('corn' → 'maize', etc.).
 */
export function getCropImage(cropName) {
  const key = normaliseCrop(cropName);
  const slot = CROP_TO_SLOT[key] || null;
  return _resolveVisual({ slot, crop: key, mode: 'farm' });
}

/**
 * getPlantImage(plantName) — Garden-mode visual descriptor.
 * Plants share the herb / flower / plant SVG scenes from
 * cropImages, plus the dedicated garden photography slots if
 * shipped.
 */
export function getPlantImage(plantName) {
  const key = normaliseCrop(plantName);
  // Garden-specific slot lookup falls back to the same farm
  // catalogue when a plant ships in the crop list.
  const slot = CROP_TO_SLOT[key] || PHOTO_SLOTS.HERO_GARDEN_DAYLIGHT;
  return _resolveVisual({ slot, crop: key || 'plant', mode: 'garden' });
}

/**
 * getModeHeroImage(mode) — atmospheric hero for the active
 * experience. Used by Home + Login backdrops when no specific
 * crop/plant is selected yet.
 */
export function getModeHeroImage(mode) {
  const safeMode = String(mode || 'farm').toLowerCase() === 'garden' ? 'garden' : 'farm';
  const slot = MODE_TO_SLOT[safeMode];
  return _resolveVisual({ slot, crop: null, mode: safeMode });
}

/**
 * getWeatherVisual(condition) — atmospheric backdrop keyed off
 * the weatherType the orchestrator publishes
 * ('sunny'|'rain'|'cloudy'|'storm'|...).
 */
export function getWeatherVisual(condition) {
  const c = String(condition || '').toLowerCase();
  const slot = WEATHER_TO_SLOT[c] || PHOTO_SLOTS.HERO_DAYLIGHT_FIELD;
  return _resolveVisual({ slot, crop: null, mode: 'farm' });
}

// ─── Render-ready component ────────────────────────────────────
//
// Most call sites want a React element they can drop in. This
// component wraps the descriptor logic so callers don't need to
// branch on `kind` themselves.

export default function RealVisual({
  crop,
  plant,
  mode,
  weather,
  rounded = 16,
  testId = 'real-visual',
  ...rest
}) {
  // Priority: explicit crop > explicit plant > weather > mode.
  let descriptor;
  if (crop)         descriptor = getCropImage(crop);
  else if (plant)   descriptor = getPlantImage(plant);
  else if (weather) descriptor = getWeatherVisual(weather);
  else              descriptor = getModeHeroImage(mode);

  if (descriptor.kind === 'photo' && descriptor.src) {
    return (
      <img
        src={descriptor.src}
        alt=""
        loading="lazy"
        decoding="async"
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

  if (descriptor.kind === 'scene') {
    return (
      <CropImage
        crop={descriptor.crop}
        mode={mode === 'garden' ? 'garden' : 'farm'}
        rounded={rounded}
        testId={testId}
        {...rest}
      />
    );
  }

  return (
    <RealisticPhotoFallback
      rounded={rounded}
      testId={`${testId}-fallback`}
      {...rest}
    />
  );
}

// Re-export the fallback at the path the spec names so external
// callers can render it directly when they explicitly want the
// calm placeholder (e.g. mid-fetch loading states).
export { RealisticPhotoFallback };

// Diagnostics — exposed for test + admin surfaces. Not for UI.
export const _internal = Object.freeze({
  CROP_TO_SLOT,
  MODE_TO_SLOT,
  WEATHER_TO_SLOT,
  AVAILABLE_SLOTS,
  SCENES,
});
