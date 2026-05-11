/**
 * cropImages — photographic-style SVG illustrations per crop / plant.
 *
 *   import { CropImage, resolveCropImage } from
 *     'src/assets/realism/cropImages.jsx';
 *
 *   <CropImage crop="maize" mode="farm" />
 *
 * Why inline SVG and not real photos
 * ──────────────────────────────────
 *   The production photo shoot the realism/photography manifest
 *   anticipates is not commissioned yet (see manifest.js). Until
 *   real .webp files land under /assets/realism/photography/,
 *   these hand-crafted illustrations stand in. They are NOT
 *   cartoony — they use muted, photo-derived palettes (sage olive
 *   greens, warm amber wheat, terracotta soil, hazy horizon sky)
 *   so the card reads as "a real farm scene" rather than a
 *   placeholder graphic.
 *
 *   When a real photo ships, drop it under public/assets/realism/
 *   photography/<slot>.webp and update slotPath() in
 *   src/assets/realism/photography/manifest.js. The Home hero
 *   will start using the real image automatically; this file
 *   only fires as the fallback.
 *
 * Crop palette derived from typical field-photo references:
 *   maize/corn     — amber wheat foreground, olive stalks, soft sky
 *   tomato         — terracotta fruit, sage vine, warm soil
 *   pepper         — vibrant red/green pods, dusty soil
 *   rice           — golden paddy, water reflection, soft horizon
 *   cassava        — broad green leaves, brown earth
 *   yam            — green tuber leaves, ochre soil
 *   lettuce        — layered green leaves, dewy highlights
 *   herb           — small green cluster, terracotta pot
 *   flower         — petal bloom, garden green
 *   general crop   — green field with horizon (farm fallback)
 *   plant          — generic potted plant (garden fallback)
 *
 * Strict-rule audit
 *   • Pure presentational. No data fetches, no React state.
 *   • No emoji. No cartoon shapes. No bright primary colors.
 *   • SSR-safe. Inline SVG renders identically server + client.
 *   • Frozen exports so a future caller can't mutate the palette.
 */

import React from 'react';

// ─── Crop name normalisation ─────────────────────────────────────
// Accepts the canonical crop id (maize, tomato, ...) plus the
// common aliases the existing crop selectors surface (corn,
// chilli, jollof rice, cocoyam, salad, basil-style herbs).

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

// ─── Per-crop scene definitions ──────────────────────────────────
// Each scene supplies the gradient stops (sky → horizon → soil)
// and the foreground composition. The CropImage component picks
// the matching scene; everything else (frame, overlay, sizing) is
// shared so the cards look consistent across crops.

const SCENES = Object.freeze({
  maize: {
    label: 'Maize field',
    sky:    ['#C8DBE8', '#F0DCAE'],
    soil:   '#8B5E3C',
    leaves: ['#7A9B5E', '#6E8B61', '#5C7A4F'],
    grain:  '#D4A35F',
    composition: 'stalks',
  },
  tomato: {
    label: 'Tomato vine',
    sky:    ['#D5E4EE', '#F5D3B5'],
    soil:   '#A26A3E',
    leaves: ['#6E8B61', '#5C7A4F', '#7A9B5E'],
    grain:  '#C65A4B',
    composition: 'fruits',
  },
  pepper: {
    label: 'Pepper bed',
    sky:    ['#CFE0EC', '#EFC7A5'],
    soil:   '#8E5C36',
    leaves: ['#5C7A4F', '#6E8B61'],
    grain:  '#B23F30',
    composition: 'pods',
  },
  rice: {
    label: 'Rice paddy',
    sky:    ['#BFD6E5', '#F4D89A'],
    soil:   '#6B7F8C',
    leaves: ['#A8B96F', '#94A857'],
    grain:  '#D4B860',
    composition: 'paddy',
  },
  cassava: {
    label: 'Cassava grove',
    sky:    ['#C8DBE8', '#E8D2A8'],
    soil:   '#8E5C36',
    leaves: ['#5C7A4F', '#6E8B61', '#809B70'],
    grain:  null,
    composition: 'broadLeaf',
  },
  yam: {
    label: 'Yam plot',
    sky:    ['#C8DBE8', '#E8D2A8'],
    soil:   '#A26A3E',
    leaves: ['#6E8B61', '#5C7A4F'],
    grain:  null,
    composition: 'broadLeaf',
  },
  lettuce: {
    label: 'Lettuce row',
    sky:    ['#D5E4EE', '#E8DDB8'],
    soil:   '#7A5439',
    leaves: ['#94B872', '#A8C283', '#7AA262'],
    grain:  null,
    composition: 'lowLeaf',
  },
  herb: {
    label: 'Herb cluster',
    sky:    ['#E2EAEF', '#F0E5C8'],
    soil:   '#9C6B45',
    leaves: ['#6E8B61', '#5C7A4F'],
    grain:  null,
    composition: 'potted',
  },
  flower: {
    label: 'Bloom',
    sky:    ['#E8DCEC', '#F5C5AE'],
    soil:   '#7A5439',
    leaves: ['#5C7A4F', '#6E8B61'],
    grain:  '#C8748F',
    composition: 'bloom',
  },
  crop: {
    label: 'Field',
    sky:    ['#C8DBE8', '#E8D8B8'],
    soil:   '#8B5E3C',
    leaves: ['#6E8B61', '#5C7A4F'],
    grain:  '#D4A35F',
    composition: 'horizon',
  },
  plant: {
    label: 'Houseplant',
    sky:    ['#EFE7D5', '#E0D2B6'],
    soil:   '#A26A3E',
    leaves: ['#6E8B61', '#5C7A4F'],
    grain:  null,
    composition: 'potted',
  },
});

/**
 * Resolve a scene config for a given crop/plant id. Falls back to
 * the generic 'crop' (farm mode) or 'plant' (garden mode) scene
 * when the id is unknown.
 */
export function resolveCropImage(crop, mode = 'farm') {
  const key = normaliseCrop(crop);
  if (SCENES[key]) return { key, scene: SCENES[key] };
  const fallback = String(mode || 'farm').toLowerCase() === 'garden' ? 'plant' : 'crop';
  return { key: fallback, scene: SCENES[fallback] };
}

// ─── Composition renderers ───────────────────────────────────────
// Each composition draws a different foreground scene over the
// shared sky → horizon gradient. They paint at viewBox 0 0 320 160
// (2:1 aspect, mobile-safe). The CropImage wrapper sets
// preserveAspectRatio="xMidYMid slice" so the scene fills its
// container while keeping the focal point centred.

function _Stalks({ scene }) {
  const [a, b, c] = scene.leaves;
  return (
    <g>
      {/* Far row of stalks (palette c — receded green) */}
      <g fill={c} opacity="0.85">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={`far-${i}`}
            d={`M${20 + i * 55} 110 q-4 -22 0 -42 q4 -8 8 -8 q4 0 8 8 q4 22 0 42 z`}
          />
        ))}
      </g>
      {/* Mid row of stalks (palette b) */}
      <g fill={b}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={`mid-${i}`}
            d={`M${10 + i * 55} 130 q-6 -30 0 -56 q4 -10 10 -10 q6 0 10 10 q6 26 0 56 z`}
          />
        ))}
      </g>
      {/* Foreground row of grain heads */}
      <g fill={scene.grain || a}>
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={`grain-${i}`} cx={40 + i * 60} cy={78} rx={6} ry={14} />
        ))}
      </g>
    </g>
  );
}

function _Fruits({ scene }) {
  const [a, b] = scene.leaves;
  return (
    <g>
      {/* Trellis vine */}
      <g stroke={b} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M30 150 Q60 100 90 130 T150 110 T210 130 T280 110" />
        <path d="M40 150 Q70 110 100 140 T160 120" opacity="0.7" />
      </g>
      {/* Leaves on vine */}
      <g fill={a}>
        {[60, 120, 180, 240].map((cx) => (
          <ellipse key={`leaf-${cx}`} cx={cx} cy={108} rx={14} ry={8}
                   transform={`rotate(-20 ${cx} 108)`} />
        ))}
      </g>
      {/* Fruits */}
      <g>
        {[80, 140, 200, 260].map((cx, i) => (
          <g key={`fruit-${cx}`} transform={`translate(${cx} ${118 + (i % 2) * 4})`}>
            <circle r="9" fill={scene.grain} />
            <ellipse cx="-2" cy="-3" rx="3" ry="2" fill="#FFFFFF" opacity="0.35" />
          </g>
        ))}
      </g>
    </g>
  );
}

function _Pods({ scene }) {
  const [a, b] = scene.leaves;
  return (
    <g>
      <g fill={b}>
        {[40, 110, 180, 250].map((cx) => (
          <path key={`bush-${cx}`}
                d={`M${cx - 24} 150 q0 -34 24 -42 q24 8 24 42 z`}
                opacity="0.95"/>
        ))}
      </g>
      <g fill={a}>
        {[40, 110, 180, 250].map((cx) => (
          <ellipse key={`leaf-${cx}`} cx={cx} cy={120} rx={18} ry={10} />
        ))}
      </g>
      {/* Pods */}
      <g>
        {[
          [40, 120], [62, 132], [110, 116], [130, 134],
          [180, 122], [200, 134], [250, 118], [272, 130],
        ].map(([cx, cy], i) => (
          <ellipse key={`pod-${i}`}
                   cx={cx} cy={cy} rx="4.5" ry="9"
                   fill={scene.grain}
                   transform={`rotate(${(i % 2 === 0 ? -15 : 15)} ${cx} ${cy})`} />
        ))}
      </g>
    </g>
  );
}

function _Paddy({ scene }) {
  const [a, b] = scene.leaves;
  return (
    <g>
      {/* Water surface — subtle horizontal stripes for reflection */}
      <g fill={scene.soil} opacity="0.55">
        <rect x="0" y="116" width="320" height="4" />
        <rect x="0" y="124" width="320" height="2" />
        <rect x="0" y="132" width="320" height="3" />
      </g>
      {/* Rice tufts — many small clumps for paddy field */}
      <g fill={b}>
        {Array.from({ length: 14 }).map((_, i) => {
          const cx = 14 + i * 22;
          const cy = 110 + ((i % 3) * 4);
          return (
            <g key={`tuft-${i}`}>
              <path d={`M${cx} ${cy} q-6 -16 0 -22`} stroke={b} strokeWidth="1.4" fill="none"/>
              <path d={`M${cx + 2} ${cy} q-2 -18 4 -22`} stroke={a} strokeWidth="1.4" fill="none"/>
              <path d={`M${cx - 2} ${cy} q-2 -18 -4 -22`} stroke={a} strokeWidth="1.4" fill="none"/>
              <ellipse cx={cx + 1} cy={cy - 22} rx="2.5" ry="6" fill={scene.grain} />
            </g>
          );
        })}
      </g>
    </g>
  );
}

function _BroadLeaf({ scene }) {
  const [a, b, c] = scene.leaves;
  return (
    <g>
      <g fill={c || b} opacity="0.85">
        {[50, 130, 220].map((cx, i) => (
          <path key={`leaf-back-${cx}`}
                d={`M${cx} 130 q-32 -40 -8 -70 q24 -10 38 30 q4 30 -30 40 z`}
                transform={`scale(${1 - i * 0.05}) translate(${i * 8} ${i * 4})`}/>
        ))}
      </g>
      <g fill={b}>
        {[30, 100, 180, 260].map((cx) => (
          <path key={`leaf-${cx}`}
                d={`M${cx} 150 q-26 -34 -4 -64 q22 -8 32 24 q4 28 -28 40 z`}/>
        ))}
      </g>
      <g fill={a} opacity="0.9">
        {[70, 150, 230].map((cx) => (
          <path key={`leaf-front-${cx}`}
                d={`M${cx} 152 q-22 -28 -2 -52 q18 -6 26 18 q4 24 -24 34 z`}/>
        ))}
      </g>
    </g>
  );
}

function _LowLeaf({ scene }) {
  const [a, b, c] = scene.leaves;
  return (
    <g>
      <g fill={c || b}>
        {[24, 72, 120, 168, 216, 264].map((cx) => (
          <ellipse key={`leaf-b-${cx}`} cx={cx} cy={140} rx={28} ry={16} opacity="0.9" />
        ))}
      </g>
      <g fill={b}>
        {[40, 96, 152, 208, 264].map((cx) => (
          <ellipse key={`leaf-m-${cx}`} cx={cx} cy={130} rx={24} ry={14} />
        ))}
      </g>
      <g fill={a}>
        {[56, 112, 168, 224].map((cx) => (
          <ellipse key={`leaf-t-${cx}`} cx={cx} cy={118} rx={20} ry={11} />
        ))}
      </g>
    </g>
  );
}

function _Potted({ scene }) {
  const [a, b] = scene.leaves;
  return (
    <g>
      {/* Pot */}
      <path
        d="M120 152 L200 152 L194 100 L126 100 Z"
        fill={scene.soil}
      />
      <path
        d="M126 100 L194 100 L196 92 L124 92 Z"
        fill={scene.soil}
        opacity="0.75"
      />
      {/* Plant — layered fronds */}
      <g fill={b}>
        <path d="M160 92 q-30 -28 -8 -56 q14 -2 18 24 q2 22 -10 32 z" />
        <path d="M160 92 q30 -28 8 -56 q-14 -2 -18 24 q-2 22 10 32 z" />
      </g>
      <g fill={a} opacity="0.95">
        <path d="M160 92 q-20 -34 -2 -60 q12 0 16 22 q2 24 -14 38 z" />
        <path d="M160 92 q20 -34 2 -60 q-12 0 -16 22 q-2 24 14 38 z" />
        <path d="M160 96 q-2 -32 0 -54" stroke={a} strokeWidth="2" fill="none" />
      </g>
    </g>
  );
}

function _Bloom({ scene }) {
  const [a, b] = scene.leaves;
  const petal = scene.grain;
  return (
    <g>
      {/* Stems */}
      <g stroke={b} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M80 152 Q80 110 92 80" />
        <path d="M160 152 Q160 102 168 70" />
        <path d="M240 152 Q240 112 226 86" />
      </g>
      {/* Leaves */}
      <g fill={a}>
        <ellipse cx="76" cy="120" rx="10" ry="5" transform="rotate(-30 76 120)" />
        <ellipse cx="164" cy="110" rx="10" ry="5" transform="rotate(30 164 110)" />
        <ellipse cx="234" cy="124" rx="10" ry="5" transform="rotate(-30 234 124)" />
      </g>
      {/* Blooms */}
      {[ [92, 80], [168, 70], [226, 86] ].map(([cx, cy], i) => (
        <g key={`bloom-${i}`} transform={`translate(${cx} ${cy})`}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="0" cy="-9" rx="6" ry="9" fill={petal}
                     transform={`rotate(${deg})`} opacity="0.92" />
          ))}
          <circle r="4" fill="#F5C97D" />
        </g>
      ))}
    </g>
  );
}

function _Horizon({ scene }) {
  const [a, b] = scene.leaves;
  return (
    <g>
      {/* Rolling hills */}
      <path
        d="M0 130 Q80 110 160 122 T320 116 L320 160 L0 160 Z"
        fill={b}
        opacity="0.95"
      />
      <path
        d="M0 142 Q80 124 160 134 T320 128 L320 160 L0 160 Z"
        fill={a}
      />
      {/* Distant tree silhouettes */}
      <g fill={b} opacity="0.7">
        <ellipse cx="60" cy="118" rx="14" ry="8" />
        <ellipse cx="200" cy="120" rx="18" ry="9" />
        <ellipse cx="280" cy="116" rx="12" ry="7" />
      </g>
    </g>
  );
}

function _renderComposition(scene) {
  switch (scene.composition) {
    case 'stalks':    return <_Stalks scene={scene} />;
    case 'fruits':    return <_Fruits scene={scene} />;
    case 'pods':      return <_Pods scene={scene} />;
    case 'paddy':     return <_Paddy scene={scene} />;
    case 'broadLeaf': return <_BroadLeaf scene={scene} />;
    case 'lowLeaf':   return <_LowLeaf scene={scene} />;
    case 'potted':    return <_Potted scene={scene} />;
    case 'bloom':     return <_Bloom scene={scene} />;
    case 'horizon':   return <_Horizon scene={scene} />;
    default:          return <_Horizon scene={scene} />;
  }
}

/**
 * CropImage — renders the resolved scene into a rounded frame.
 * Uses preserveAspectRatio="xMidYMid slice" so the scene fills
 * its host container while keeping the focal point centred. The
 * `tint` overlay sits ABOVE the SVG so caller-side captions read
 * cleanly regardless of palette.
 */
export default function CropImage({
  crop,
  mode = 'farm',
  rounded = 16,
  tint = true,
  testId = 'crop-image',
  style,
}) {
  const { key, scene } = resolveCropImage(crop, mode);
  const gradId = `crop-sky-${key}`;

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
      data-scene-composition={scene.composition}
      aria-label={scene.label}
      role="img"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 160"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={scene.sky[0]} />
            <stop offset="55%"  stopColor={scene.sky[1]} />
            <stop offset="100%" stopColor={scene.soil}   stopOpacity="0.85" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="320" height="160" fill={`url(#${gradId})`} />

        {/* Soft horizon mist for atmospheric depth */}
        <rect x="0" y="86" width="320" height="20" fill="#FFFFFF" opacity="0.18" />

        {_renderComposition(scene)}

        {/* Subtle vignette so caller-side captions read on any crop */}
        <rect x="0" y="0" width="320" height="160" fill="url(#vignette)" opacity="0.6" />
        <defs>
          <linearGradient id="vignette" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor="#1F2933" stopOpacity="0.55" />
            <stop offset="55%"  stopColor="#1F2933" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Caller-controllable warm overlay — slightly increases the
          warmth so the photo-like cards never read cold/gray. */}
      {tint && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,205,140,0.06) 0%, rgba(0,0,0,0.0) 30%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

export { SCENES };
