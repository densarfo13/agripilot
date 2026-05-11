/**
 * cropImages — atmospheric crop-tinted backdrops.
 *
 *   import CropImage, { resolveCropImage, normaliseCrop, SCENES }
 *     from 'src/assets/realism/cropImages.jsx';
 *
 *   <CropImage crop="maize" mode="farm" />
 *
 * v3 IMMERSIVE COMPANION — atmospheric backdrops only
 * ────────────────────────────────────────────────────
 * The previous version painted literal SVG stalks / fruits /
 * leaves per crop. Operator feedback ("no fake SVG farming
 * visuals, no fake illustrations") removed those compositions —
 * what remains is a layered atmospheric backdrop tuned by crop
 * palette + film-grain noise for photographic depth-of-field
 * feel. Reads as an out-of-focus crop scene, not a cartoon.
 *
 * Each crop entry exposes a colour palette (sky/soil/grain/leaves)
 * that drives:
 *   1. A vertical sky→horizon→soil gradient
 *   2. A warm/cool radial glow keyed to the crop's natural light
 *   3. A subtle horizon haze stripe
 *   4. An overlaid SVG film-grain noise filter for texture
 *
 * No specific shapes. No emoji. No cartoon icons. When real .webp
 * files commission (see manifest.js AVAILABLE_SLOTS), the
 * resolver in realVisuals.js swaps them in automatically — this
 * file only fires as the fallback.
 *
 * Strict-rule audit
 *   • Pure presentational. SSR-safe. Frozen exports.
 *   • No emoji. No cartoon shapes. No primary-colour neon.
 *   • Single SVG with two paint layers (gradient + grain) —
 *     no per-crop composition tree.
 */

import React from 'react';

const CROP_ALIASES = Object.freeze({
  corn:       'maize',
  maize:      'maize',
  popcorn:    'maize',
  tomato:     'tomato',
  tomatoes:   'tomato',
  pepper:     'pepper',
  peppers:    'pepper',
  chilli:     'pepper',
  chili:      'pepper',
  rice:       'rice',
  paddy:      'rice',
  cassava:    'cassava',
  manioc:     'cassava',
  yam:        'yam',
  cocoyam:    'yam',
  lettuce:    'lettuce',
  salad:      'lettuce',
  spinach:    'lettuce',
  kale:       'lettuce',
  basil:      'herb',
  herb:       'herb',
  herbs:      'herb',
  mint:       'herb',
  flower:     'flower',
  flowers:    'flower',
  rose:       'flower',
  tulip:      'flower',
});

export function normaliseCrop(input) {
  if (!input || typeof input !== 'string') return '';
  return CROP_ALIASES[input.trim().toLowerCase()] || input.trim().toLowerCase();
}

// Palettes derived from real field-photo references. The "warmth"
// number tunes the radial glow position (lower = ground glow,
// higher = sky glow) so each crop reads as its natural lighting
// environment.
const SCENES = Object.freeze({
  maize: {
    label: 'Maize field',
    sky:    ['#1B2A1F', '#3D2E1A', '#1A1410'],
    accent: 'rgba(212,163,95,0.28)',   // amber wheat glow
    accentPos: '50% 75%',
  },
  tomato: {
    label: 'Tomato vine',
    sky:    ['#1A2520', '#3A2018', '#1D1410'],
    accent: 'rgba(198,90,75,0.22)',    // terracotta fruit warmth
    accentPos: '50% 70%',
  },
  pepper: {
    label: 'Pepper bed',
    sky:    ['#1A241F', '#3C1F1A', '#1F1310'],
    accent: 'rgba(178,63,48,0.20)',    // deep red ground glow
    accentPos: '50% 75%',
  },
  rice: {
    label: 'Rice paddy',
    sky:    ['#162028', '#2E2818', '#161616'],
    accent: 'rgba(212,184,96,0.20)',   // golden paddy reflection
    accentPos: '50% 80%',
  },
  cassava: {
    label: 'Cassava grove',
    sky:    ['#162018', '#2A1F12', '#181210'],
    accent: 'rgba(110,139,97,0.22)',   // deep olive grove
    accentPos: '50% 70%',
  },
  yam: {
    label: 'Yam plot',
    sky:    ['#172016', '#2F1F15', '#1A1310'],
    accent: 'rgba(143,171,115,0.20)',  // muted green-tuber
    accentPos: '50% 75%',
  },
  lettuce: {
    label: 'Lettuce row',
    sky:    ['#172420', '#2E2A1C', '#181614'],
    accent: 'rgba(168,194,131,0.20)',  // dewy green
    accentPos: '50% 80%',
  },
  herb: {
    label: 'Herb cluster',
    sky:    ['#192520', '#2C2418', '#1A1612'],
    accent: 'rgba(143,171,115,0.18)',  // small green warmth
    accentPos: '50% 78%',
  },
  flower: {
    label: 'Bloom',
    sky:    ['#1F1E26', '#3A1F22', '#1E1410'],
    accent: 'rgba(200,116,143,0.22)',  // soft petal pink
    accentPos: '50% 72%',
  },
  crop: {
    label: 'Field horizon',
    sky:    ['#162028', '#2E2818', '#1A1A18'],
    accent: 'rgba(200,148,77,0.20)',   // generic farm warmth
    accentPos: '50% 78%',
  },
  plant: {
    label: 'Garden ambient',
    sky:    ['#172320', '#2C2218', '#1A1612'],
    accent: 'rgba(168,194,131,0.18)',  // gentle indoor green
    accentPos: '50% 75%',
  },
});

export function resolveCropImage(crop, mode = 'farm') {
  const key = normaliseCrop(crop);
  if (SCENES[key]) return { key, scene: SCENES[key] };
  const fallback = String(mode || 'farm').toLowerCase() === 'garden' ? 'plant' : 'crop';
  return { key: fallback, scene: SCENES[fallback] };
}

// Stable noise pattern — a small repeated SVG turbulence filter.
// Generated once at module load, reused across every render so the
// browser caches the pattern instead of recomputing per card.
const NOISE_FILTER_ID = 'cropImageGrainFilter';
const NOISE_PATTERN_ID = 'cropImageGrainPattern';

/**
 * CropImage — atmospheric crop-tinted backdrop. No literal crop
 * shapes; the colour palette + radial glow + grain texture do the
 * work. Pairs with a real .webp swap when commissioned (see
 * manifest.js + realVisuals.js).
 */
export default function CropImage({
  crop,
  mode = 'farm',
  rounded = 16,
  testId = 'crop-image',
  style,
}) {
  const { key, scene } = resolveCropImage(crop, mode);
  const skyGradId = `crop-sky-${key}`;
  const accentGradId = `crop-accent-${key}`;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '2 / 1',
        borderRadius: rounded,
        overflow: 'hidden',
        ...style,
      }}
      data-testid={testId}
      data-crop={key}
      aria-label={scene.label}
      role="img"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 160"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block', position: 'absolute', inset: 0 }}
      >
        <defs>
          {/* Sky → horizon → soil vertical gradient — three stops
              keyed off the crop palette. */}
          <linearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={scene.sky[0]} />
            <stop offset="55%"  stopColor={scene.sky[1]} />
            <stop offset="100%" stopColor={scene.sky[2]} />
          </linearGradient>

          {/* Accent radial — the crop's natural lighting glow.
              Positioned per scene.accentPos so e.g. paddy glow
              sits low (reflection on water) vs herb glow sits
              mid-height. */}
          <radialGradient
            id={accentGradId}
            cx={scene.accentPos.split(' ')[0]}
            cy={scene.accentPos.split(' ')[1]}
            r="70%"
          >
            <stop offset="0%"   stopColor={scene.accent} />
            <stop offset="60%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          {/* Film-grain noise via SVG turbulence. baseFrequency
              tuned so the grain is photographic, not TV static.
              Composited as multiplied luminance over the base
              layers. */}
          <filter id={NOISE_FILTER_ID}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0.10 0"
            />
          </filter>
        </defs>

        {/* Base atmospheric stack */}
        <rect x="0" y="0" width="320" height="160" fill={`url(#${skyGradId})`} />
        <rect x="0" y="0" width="320" height="160" fill={`url(#${accentGradId})`} />

        {/* Subtle horizon haze — single soft band */}
        <rect x="0" y="78" width="320" height="14" fill="#FFFFFF" opacity="0.05" />

        {/* Film-grain noise overlay */}
        <rect
          x="0" y="0" width="320" height="160"
          fill="#FFFFFF"
          filter={`url(#${NOISE_FILTER_ID})`}
          opacity="0.65"
        />

        {/* Bottom vignette so caller captions read on any palette */}
        <rect
          x="0" y="80" width="320" height="80"
          fill="url(#cropImageVignette)"
          opacity="0.7"
        />
        <defs>
          <linearGradient id="cropImageVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export { SCENES };
