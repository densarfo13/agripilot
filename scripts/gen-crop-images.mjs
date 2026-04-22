/**
 * gen-crop-images.mjs — build-time generator for /public/crops/*.webp
 *
 * Each crop is authored as a rich SVG (dark radial gradient
 * background + layered crop illustration with highlights/shadows).
 * Sharp renders each SVG at 400×400 and emits a compressed WebP
 * (quality 82, smart-subsample). Consistent style, consistent
 * composition, real WebP files, mobile-friendly (~10–25 KB each).
 *
 * Adding a new crop:
 *   1. Add a [key, label, silhouette] entry to CROPS below
 *   2. Run: node scripts/gen-crop-images.mjs
 *   3. Point src/config/cropImages.js at /crops/<key>.webp
 *
 * When the product team commissions real photographic WebPs, drop
 * them straight into /public/crops/ with the same filenames — they
 * override what this generator produced. No catalog change needed.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const WIDTH = 400;
const HEIGHT = 400;

// Shared art shell — dark radial gradient background, inner soft
// vignette, crop illustration centered. Every SVG shares the same
// defs so hand-off between crops stays visually consistent.
function svg(label, silhouette) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%"  stop-color="#1F4432"/>
      <stop offset="55%" stop-color="#12263A"/>
      <stop offset="100%" stop-color="#081423"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
      <stop offset="70%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
    </radialGradient>
    <linearGradient id="leafLight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#E6FFA1"/>
      <stop offset="40%" stop-color="#9EE663"/>
      <stop offset="100%" stop-color="#2E7D32"/>
    </linearGradient>
    <linearGradient id="leafDeep" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#6ABF43"/>
      <stop offset="100%" stop-color="#163E1E"/>
    </linearGradient>
    <linearGradient id="tuber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#E8C49A"/>
      <stop offset="50%" stop-color="#B87E4F"/>
      <stop offset="100%" stop-color="#5B3A20"/>
    </linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#FFE29A"/>
      <stop offset="45%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#9A5A00"/>
    </linearGradient>
    <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#FFB4B4"/>
      <stop offset="50%" stop-color="#E53935"/>
      <stop offset="100%" stop-color="#7E1112"/>
    </linearGradient>
    <linearGradient id="cocoaHue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#E9B075"/>
      <stop offset="45%" stop-color="#B45309"/>
      <stop offset="100%" stop-color="#4A2008"/>
    </linearGradient>
    <linearGradient id="stalk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#CBE67A"/>
      <stop offset="100%" stop-color="#3A6A1E"/>
    </linearGradient>
    <linearGradient id="pepperSheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="45%" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="0.6"/>
    </filter>
  </defs>
  <rect width="240" height="240" fill="url(#bg)"/>
  <rect width="240" height="240" fill="url(#vignette)"/>
  <g filter="url(#soft)">
    ${silhouette}
  </g>
</svg>
`;
}

// Richer per-crop compositions. Each uses layered paths with real
// gradients + subtle highlights + a contact shadow, so when rendered
// to WebP they read as polished crop thumbnails — same visual
// vocabulary across the whole set.
const CROPS = [
  ['cassava', 'Cassava', `
    <!-- Leaves -->
    <g>
      <path d="M80 85 Q 60 55 35 55 Q 45 85 78 95 Z" fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2" stroke-linejoin="round"/>
      <path d="M80 85 Q 68 60 48 60 Q 56 82 80 92 Z" fill="url(#leafLight)" stroke="#0a2015" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M160 85 Q 180 55 205 55 Q 195 85 162 95 Z" fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2" stroke-linejoin="round"/>
      <path d="M160 85 Q 172 60 192 60 Q 184 82 160 92 Z" fill="url(#leafLight)" stroke="#0a2015" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M120 80 Q 108 40 115 15 Q 132 38 126 80 Z" fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2" stroke-linejoin="round"/>
      <path d="M120 80 Q 114 50 118 28 Q 128 50 123 80 Z" fill="url(#leafLight)" stroke="#0a2015" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
    <!-- Tuber cluster -->
    <g transform="translate(0,6)">
      <ellipse cx="120" cy="200" rx="58" ry="14" fill="#000" opacity="0.35"/>
      <path d="M85 130 Q 75 115 90 108 Q 120 115 115 145 Q 110 195 95 200 Q 78 195 78 170 Q 78 150 85 130 Z" fill="url(#tuber)" stroke="#2E1708" stroke-width="2" stroke-linejoin="round"/>
      <path d="M130 120 Q 160 118 165 140 Q 170 175 145 195 Q 125 200 118 175 Q 115 140 130 120 Z" fill="url(#tuber)" stroke="#2E1708" stroke-width="2" stroke-linejoin="round"/>
      <path d="M95 145 Q 100 170 92 190" fill="none" stroke="#5B3A20" stroke-width="1.5" opacity="0.6"/>
      <path d="M150 140 Q 148 170 138 190" fill="none" stroke="#5B3A20" stroke-width="1.5" opacity="0.6"/>
      <path d="M93 125 Q 97 130 106 126" fill="none" stroke="#fff" stroke-width="2" opacity="0.35"/>
      <path d="M140 130 Q 148 132 156 128" fill="none" stroke="#fff" stroke-width="2" opacity="0.35"/>
    </g>`],

  ['maize', 'Maize', `
    <!-- Husks -->
    <g>
      <path d="M95 90 Q 70 65 50 90 Q 65 110 95 115 Z" fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2"/>
      <path d="M95 90 Q 78 75 65 90 Q 78 105 95 108 Z" fill="url(#leafLight)" stroke="#0a2015" stroke-width="1.2"/>
      <path d="M145 90 Q 170 65 190 90 Q 175 110 145 115 Z" fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2"/>
      <path d="M145 90 Q 162 75 175 90 Q 162 105 145 108 Z" fill="url(#leafLight)" stroke="#0a2015" stroke-width="1.2"/>
    </g>
    <!-- Contact shadow -->
    <ellipse cx="120" cy="222" rx="40" ry="6" fill="#000" opacity="0.4"/>
    <!-- Cob -->
    <path d="M120 75 L 152 105 L 150 205 Q 140 218 120 218 Q 100 218 90 205 L 88 105 Z"
          fill="url(#orange)" stroke="#4A2A05" stroke-width="2" stroke-linejoin="round"/>
    <!-- Kernels (4 rows x 4 cols) — staggered gives a more realistic grain look -->
    <g stroke="#7A3E05" stroke-width="0.8">
      <circle cx="104" cy="125" r="5" fill="#FFD27A"/>
      <circle cx="118" cy="122" r="5" fill="#F59E0B"/>
      <circle cx="132" cy="125" r="5" fill="#FFD27A"/>
      <circle cx="111" cy="145" r="5" fill="#F59E0B"/>
      <circle cx="125" cy="142" r="5" fill="#FFD27A"/>
      <circle cx="139" cy="145" r="5" fill="#F59E0B"/>
      <circle cx="104" cy="165" r="5" fill="#FFD27A"/>
      <circle cx="118" cy="162" r="5" fill="#F59E0B"/>
      <circle cx="132" cy="165" r="5" fill="#FFD27A"/>
      <circle cx="111" cy="185" r="5" fill="#F59E0B"/>
      <circle cx="125" cy="182" r="5" fill="#FFD27A"/>
      <circle cx="139" cy="185" r="5" fill="#F59E0B"/>
      <circle cx="104" cy="205" r="5" fill="#FFD27A"/>
      <circle cx="118" cy="202" r="5" fill="#F59E0B"/>
      <circle cx="132" cy="205" r="5" fill="#FFD27A"/>
    </g>
    <!-- Cob sheen -->
    <path d="M105 110 Q 115 155 100 200" fill="none" stroke="#fff" stroke-width="8" opacity="0.15"/>`],

  ['rice', 'Rice', `
    <ellipse cx="120" cy="225" rx="55" ry="5" fill="#000" opacity="0.4"/>
    <!-- Stalk bundle -->
    <g fill="none" stroke-linecap="round">
      <path d="M120 220 L 120 90" stroke="#3A6A1E" stroke-width="4"/>
      <path d="M105 210 L 110 110" stroke="#3A6A1E" stroke-width="3"/>
      <path d="M135 212 L 132 115" stroke="#3A6A1E" stroke-width="3"/>
      <!-- Arching grain heads -->
      <path d="M120 90 Q 70 75 45 115" stroke="url(#stalk)" stroke-width="4"/>
      <path d="M120 90 Q 170 75 195 115" stroke="url(#stalk)" stroke-width="4"/>
      <path d="M110 110 Q 85 100 60 135" stroke="url(#stalk)" stroke-width="3"/>
      <path d="M132 115 Q 155 105 180 140" stroke="url(#stalk)" stroke-width="3"/>
      <path d="M120 100 Q 115 85 125 65" stroke="url(#stalk)" stroke-width="3"/>
    </g>
    <!-- Grain clusters at the tip of each arc -->
    <g fill="url(#orange)" stroke="#4A2A05" stroke-width="0.9">
      <ellipse cx="45"  cy="115" rx="6" ry="4" transform="rotate(-30 45 115)"/>
      <ellipse cx="55"  cy="105" rx="5" ry="3.5" transform="rotate(-30 55 105)"/>
      <ellipse cx="195" cy="115" rx="6" ry="4" transform="rotate(30 195 115)"/>
      <ellipse cx="185" cy="105" rx="5" ry="3.5" transform="rotate(30 185 105)"/>
      <ellipse cx="60"  cy="135" rx="6" ry="4" transform="rotate(-30 60 135)"/>
      <ellipse cx="72"  cy="125" rx="5" ry="3.5" transform="rotate(-30 72 125)"/>
      <ellipse cx="180" cy="140" rx="6" ry="4" transform="rotate(30 180 140)"/>
      <ellipse cx="168" cy="130" rx="5" ry="3.5" transform="rotate(30 168 130)"/>
      <ellipse cx="125" cy="65"  rx="5" ry="3.5" transform="rotate(10 125 65)"/>
      <ellipse cx="118" cy="78"  rx="5" ry="3.5" transform="rotate(-10 118 78)"/>
    </g>`],

  ['tomato', 'Tomato', `
    <ellipse cx="120" cy="218" rx="55" ry="8" fill="#000" opacity="0.45"/>
    <!-- Fruit -->
    <circle cx="120" cy="145" r="65" fill="url(#red)" stroke="#5B0E0E" stroke-width="2.5"/>
    <!-- Sheen -->
    <ellipse cx="95" cy="115" rx="16" ry="22" fill="#FFF" opacity="0.45" transform="rotate(-20 95 115)"/>
    <ellipse cx="145" cy="175" rx="9" ry="13" fill="#FFF" opacity="0.15"/>
    <!-- Fruit seam -->
    <path d="M55 150 Q 120 180 185 150" fill="none" stroke="#7E1112" stroke-width="1.2" opacity="0.5"/>
    <!-- Star calyx -->
    <g stroke="#153E1D" stroke-width="1.5" stroke-linejoin="round">
      <path d="M120 82 L 100 60 L 88 78 L 72 70 L 82 90 L 62 96 L 86 104 L 74 118 L 98 110 L 104 128 L 120 108 L 136 128 L 142 110 L 166 118 L 154 104 L 178 96 L 158 90 L 168 70 L 152 78 L 140 60 Z"
            fill="url(#leafLight)"/>
    </g>
    <!-- Stem -->
    <rect x="117" y="55" width="6" height="20" rx="3" fill="#3A6A1E" stroke="#0a2015" stroke-width="1.5"/>`],

  ['onion', 'Onion', `
    <ellipse cx="120" cy="222" rx="55" ry="6" fill="#000" opacity="0.45"/>
    <!-- Green tops -->
    <g stroke="#0a2015" stroke-width="1.5" fill="none" stroke-linecap="round">
      <path d="M120 80 Q 100 40 85 12" stroke="url(#stalk)" stroke-width="6"/>
      <path d="M120 80 Q 120 40 120 8" stroke="url(#stalk)" stroke-width="6"/>
      <path d="M120 80 Q 140 40 155 12" stroke="url(#stalk)" stroke-width="6"/>
    </g>
    <!-- Bulb -->
    <path d="M72 130 Q 78 90 120 88 Q 162 90 168 130 Q 172 198 120 215 Q 68 198 72 130 Z"
          fill="url(#orange)" stroke="#5B3A08" stroke-width="2.5"/>
    <!-- Layered skin lines -->
    <g fill="none" stroke="#8B5A0A" stroke-width="1.3" opacity="0.55">
      <path d="M92 102 Q 104 170 100 208"/>
      <path d="M108 95 Q 118 170 115 213"/>
      <path d="M132 95 Q 124 170 126 213"/>
      <path d="M148 102 Q 138 170 140 208"/>
    </g>
    <!-- Sheen -->
    <ellipse cx="100" cy="125" rx="10" ry="30" fill="#FFF" opacity="0.28" transform="rotate(-10 100 125)"/>
    <!-- Root tuft -->
    <g stroke="#fff" stroke-width="1.3" opacity="0.7">
      <line x1="114" y1="212" x2="110" y2="222"/>
      <line x1="120" y1="214" x2="120" y2="226"/>
      <line x1="126" y1="212" x2="130" y2="222"/>
    </g>`],

  ['pepper', 'Pepper', `
    <ellipse cx="130" cy="220" rx="40" ry="6" fill="#000" opacity="0.4"/>
    <!-- Stem + cap -->
    <path d="M95 58 Q 110 48 128 50 Q 145 52 152 68 Q 142 78 130 74" fill="url(#leafLight)" stroke="#0a2015" stroke-width="2"/>
    <path d="M128 50 L 128 38" stroke="#153E1D" stroke-width="4" stroke-linecap="round"/>
    <!-- Body -->
    <path d="M120 75 Q 72 90 78 160 Q 88 220 138 215 Q 180 200 175 155 Q 170 95 130 72 Z"
          fill="url(#red)" stroke="#5B0E0E" stroke-width="2.5"/>
    <!-- Sheen -->
    <path d="M100 90 Q 95 150 108 200" fill="none" stroke="url(#pepperSheen)" stroke-width="18"/>
    <path d="M155 110 Q 165 145 155 185" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.25"/>`],

  ['okra', 'Okra', `
    <ellipse cx="125" cy="222" rx="24" ry="5" fill="#000" opacity="0.45"/>
    <path d="M104 50 Q 120 40 138 50 L 132 72 L 110 72 Z" fill="url(#leafLight)" stroke="#0a2015" stroke-width="2"/>
    <path d="M112 72 Q 138 112 142 160 Q 138 200 118 218 Q 104 215 100 180 Q 100 128 118 72 Z"
          fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2"/>
    <!-- Ribs -->
    <g fill="none" stroke="#0a2015" stroke-width="1.4" opacity="0.5">
      <path d="M118 82 Q 112 145 120 210"/>
      <path d="M108 92 Q 102 150 112 205"/>
      <path d="M130 90 Q 136 150 128 208"/>
    </g>
    <path d="M115 90 Q 108 140 118 195" fill="none" stroke="#E6FFA1" stroke-width="1.3" opacity="0.55"/>`],

  ['potato', 'Potato', `
    <ellipse cx="120" cy="220" rx="64" ry="8" fill="#000" opacity="0.45"/>
    <!-- Sprout leaves -->
    <g stroke="#0a2015" stroke-width="1.5">
      <path d="M92 82 Q 78 70 92 55 Q 102 58 100 75 Z" fill="url(#leafLight)"/>
      <path d="M116 65 Q 116 45 128 42 Q 138 52 130 72 Z" fill="url(#leafLight)"/>
    </g>
    <!-- Body -->
    <ellipse cx="120" cy="145" rx="72" ry="58" fill="url(#tuber)" stroke="#2E1708" stroke-width="2.5"/>
    <!-- Eyes -->
    <g fill="#5B3A20">
      <circle cx="92" cy="125" r="4"/>
      <circle cx="125" cy="115" r="4"/>
      <circle cx="152" cy="140" r="4"/>
      <circle cx="100" cy="170" r="4"/>
      <circle cx="140" cy="175" r="4"/>
      <circle cx="170" cy="160" r="3.5"/>
    </g>
    <!-- Highlight -->
    <ellipse cx="95" cy="125" rx="28" ry="10" fill="#FFF" opacity="0.2" transform="rotate(-18 95 125)"/>`],

  ['sweet-potato', 'Sweet potato', `
    <ellipse cx="120" cy="222" rx="70" ry="8" fill="#000" opacity="0.4"/>
    <!-- Leaves -->
    <g stroke="#0a2015" stroke-width="1.5">
      <path d="M70 92 Q 55 60 90 50 Q 102 78 82 98 Z" fill="url(#leafLight)"/>
      <path d="M108 58 Q 124 28 148 50 Q 134 78 115 78 Z" fill="url(#leafDeep)"/>
      <path d="M108 58 Q 124 35 140 50 Q 130 70 115 73 Z" fill="url(#leafLight)"/>
    </g>
    <!-- Sweet potato body -->
    <path d="M48 160 Q 38 120 85 110 Q 130 95 175 115 Q 210 130 200 170 Q 180 210 140 218 Q 90 218 60 200 Q 42 185 48 160 Z"
          fill="url(#cocoaHue)" stroke="#4A2008" stroke-width="2.5"/>
    <!-- Sheen lines -->
    <path d="M75 138 Q 125 155 180 148" fill="none" stroke="#F4B27A" stroke-width="2" opacity="0.55"/>
    <path d="M65 175 Q 120 190 175 178" fill="none" stroke="#F4B27A" stroke-width="2" opacity="0.55"/>
    <ellipse cx="95" cy="138" rx="28" ry="7" fill="#FFF" opacity="0.18" transform="rotate(-7 95 138)"/>`],

  ['yam', 'Yam', `
    <ellipse cx="120" cy="222" rx="46" ry="6" fill="#000" opacity="0.45"/>
    <!-- Leafy crown -->
    <g stroke="#0a2015" stroke-width="1.5">
      <path d="M90 70 Q 70 40 105 38 Q 112 58 95 76 Z" fill="url(#leafLight)"/>
      <path d="M150 70 Q 170 40 135 38 Q 128 58 145 76 Z" fill="url(#leafLight)"/>
      <path d="M120 55 Q 108 24 120 18 Q 132 24 120 55 Z" fill="url(#leafDeep)"/>
    </g>
    <!-- Elongated tuber -->
    <path d="M88 90 Q 96 75 120 75 Q 148 78 156 95 Q 164 130 152 170 Q 140 210 120 218 Q 100 210 88 170 Q 80 128 88 90 Z"
          fill="url(#tuber)" stroke="#2E1708" stroke-width="2.5"/>
    <!-- Bark texture -->
    <g fill="none" stroke="#5B3A20" stroke-width="1" opacity="0.55">
      <path d="M96 100 Q 100 160 100 200"/>
      <path d="M120 95 Q 118 160 120 210"/>
      <path d="M146 105 Q 142 160 142 195"/>
      <path d="M92 130 Q 150 125 150 128"/>
      <path d="M90 170 Q 150 168 150 172"/>
    </g>
    <ellipse cx="108" cy="110" rx="12" ry="45" fill="#FFF" opacity="0.15" transform="rotate(-5 108 110)"/>`],

  ['plantain', 'Plantain', `
    <ellipse cx="130" cy="220" rx="60" ry="6" fill="#000" opacity="0.4"/>
    <!-- Bunch silhouette — three plantains stacked -->
    <path d="M55 185 Q 65 80 155 55 Q 185 52 200 70 Q 190 90 160 90 Q 95 110 90 180 Q 85 210 70 210 Q 52 210 55 185 Z"
          fill="url(#leafDeep)" stroke="#0a2015" stroke-width="2.5"/>
    <path d="M65 190 Q 78 90 165 65 Q 185 68 182 78 Q 165 82 145 95 Q 95 115 95 185 Q 93 205 82 205 Q 65 205 65 190 Z"
          fill="url(#leafLight)"/>
    <path d="M70 195 Q 90 125 150 95" fill="none" stroke="#0a2015" stroke-width="1.5" opacity="0.55"/>
    <!-- Stem tip -->
    <path d="M170 53 L 180 40 L 195 58 Z" fill="#3A6A1E" stroke="#0a2015" stroke-width="1.5"/>`],

  ['cocoa', 'Cocoa', `
    <ellipse cx="120" cy="222" rx="40" ry="6" fill="#000" opacity="0.45"/>
    <!-- Stem + small leaf -->
    <path d="M120 58 L 120 38 L 105 28 M120 38 L 138 26" fill="none" stroke="#3A6A1E" stroke-width="4.5" stroke-linecap="round"/>
    <!-- Pod body with ridges -->
    <path d="M88 75 Q 100 55 120 62 Q 142 55 152 78 Q 172 130 156 185 Q 140 218 120 218 Q 100 218 84 185 Q 68 130 88 75 Z"
          fill="url(#cocoaHue)" stroke="#3B1C07" stroke-width="2.5"/>
    <g stroke="#3B1C07" stroke-width="2" opacity="0.65" fill="none">
      <path d="M102 85 Q 108 140 102 195"/>
      <path d="M120 80 Q 120 140 120 210"/>
      <path d="M138 85 Q 132 140 138 195"/>
    </g>
    <!-- Highlight -->
    <ellipse cx="102" cy="120" rx="11" ry="50" fill="#FFF" opacity="0.18" transform="rotate(-6 102 120)"/>`],

  ['mango', 'Mango', `
    <ellipse cx="120" cy="222" rx="55" ry="7" fill="#000" opacity="0.4"/>
    <!-- Leaf -->
    <path d="M120 75 L 108 55 Q 84 42 60 55 Q 78 78 115 80 Z"
          fill="url(#leafDeep)" stroke="#0a2015" stroke-width="1.8"/>
    <!-- Fruit -->
    <path d="M120 75 Q 188 80 200 145 Q 185 210 120 215 Q 65 210 60 148 Q 68 92 120 75 Z"
          fill="url(#orange)" stroke="#6E3E04" stroke-width="2.5"/>
    <!-- Red blush -->
    <path d="M95 90 Q 120 98 150 90 Q 130 120 100 115 Z" fill="#E53935" opacity="0.55"/>
    <!-- Highlight -->
    <ellipse cx="150" cy="110" rx="18" ry="26" fill="#FFF" opacity="0.4" transform="rotate(20 150 110)"/>`],

  ['groundnut', 'Groundnut', `
    <ellipse cx="120" cy="218" rx="60" ry="8" fill="#000" opacity="0.45"/>
    <!-- Two small leaves -->
    <g stroke="#0a2015" stroke-width="1.5">
      <path d="M112 85 Q 100 65 84 68 Q 84 82 104 94 Z" fill="url(#leafLight)"/>
      <path d="M128 85 Q 140 65 156 68 Q 156 82 136 94 Z" fill="url(#leafLight)"/>
    </g>
    <!-- Double-lobed peanut shape -->
    <path d="M74 142 Q 62 108 96 100 Q 120 102 120 126 Q 120 102 144 100 Q 178 108 166 142 Q 180 185 150 200 Q 122 190 120 168 Q 118 190 90 200 Q 60 185 74 142 Z"
          fill="url(#tuber)" stroke="#2E1708" stroke-width="2.5"/>
    <!-- Shell crinkle -->
    <g fill="none" stroke="#5B3A20" stroke-width="1.3" opacity="0.55">
      <circle cx="100" cy="130" r="3"/>
      <circle cx="140" cy="130" r="3"/>
      <circle cx="100" cy="168" r="3"/>
      <circle cx="140" cy="168" r="3"/>
      <path d="M80 130 L 75 135"/>
      <path d="M165 130 L 170 135"/>
      <path d="M80 170 L 75 175"/>
      <path d="M165 170 L 170 175"/>
    </g>
    <ellipse cx="92" cy="118" rx="9" ry="20" fill="#FFF" opacity="0.2" transform="rotate(-8 92 118)"/>`],

  ['banana', 'Banana', `
    <ellipse cx="125" cy="220" rx="58" ry="6" fill="#000" opacity="0.4"/>
    <path d="M55 185 Q 70 80 150 55 Q 180 50 195 70 Q 190 90 160 92 Q 95 115 92 185 Q 88 210 72 210 Q 52 210 55 185 Z"
          fill="url(#orange)" stroke="#6E3E04" stroke-width="2.5"/>
    <path d="M68 190 Q 85 110 155 80" fill="none" stroke="#6E3E04" stroke-width="1.4" opacity="0.5"/>
    <path d="M75 190 Q 95 120 170 90" fill="none" stroke="#FDE68A" stroke-width="3" opacity="0.6"/>
    <path d="M165 55 L 178 42 L 195 62 Z" fill="#3A6A1E" stroke="#0a2015" stroke-width="1.5"/>`],

  ['fallback-crop', 'Crop', `
    <ellipse cx="120" cy="222" rx="45" ry="6" fill="#000" opacity="0.4"/>
    <!-- Generic sprout — shown only when a crop has no mapping -->
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M120 200 V 120" stroke="#2E7D32" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M120 120 Q 90 100 62 112 Q 80 140 120 130 Z" fill="url(#leafDeep)"/>
      <path d="M120 120 Q 150 100 178 112 Q 160 140 120 130 Z" fill="url(#leafLight)"/>
      <path d="M120 120 Q 108 85 122 58 Q 136 85 124 120 Z" fill="url(#leafDeep)"/>
    </g>
    <!-- Soil mound -->
    <path d="M70 210 Q 120 195 170 210" fill="#4A2008" stroke="#0a2015" stroke-width="1.5"/>`],
];

const outDir = path.join(process.cwd(), 'public', 'crops');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let wrote = 0;
for (const [key, label, silhouette] of CROPS) {
  const svgBuf = Buffer.from(svg(label, silhouette), 'utf8');
  const webpPath = path.join(outDir, `${key}.webp`);
  await sharp(svgBuf, { density: 300 })
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .webp({ quality: 82, smartSubsample: true, effort: 5 })
    .toFile(webpPath);
  const stats = fs.statSync(webpPath);
  console.log(`✓ ${key}.webp — ${Math.round(stats.size / 1024)} KB`);
  wrote += 1;
}
console.log(`\nGenerated ${wrote} WebP crop images in ${outDir}`);
