/**
 * procedural.js — phase + cluster aware sky/horizon canvas.
 *
 * Used as the BASE layer of <DynamicWeatherBackdrop>. When the
 * production photograph for a slot exists, RealisticPhoto loads
 * over the top and fully covers this canvas. When the photo is
 * absent (operator photography gap), RealisticPhoto's calm
 * placeholder is ~6-10% opacity so the canvas tones bleed
 * through — every (phase × cluster × weather × mode) combination
 * still feels visually distinct without ever pretending to be
 * documentary photography.
 *
 *   import { proceduralCanvas } from './procedural.js';
 *   const css = proceduralCanvas({
 *     phase:   'sunset',
 *     cluster: 'tropical',
 *     weather: 'rain',
 *     mode:    'farm',
 *   });
 *   //   css.backgroundImage  — layered linear-gradients
 *   //   css.skyBand          — '#…' stops
 *   //   css.groundBand       — '#…' stops
 *   //   css.weatherWash      — translucent rain/fog/storm tint
 *
 * Strict-rule audit
 *   • Pure. Deterministic. Frozen result. Never throws.
 *   • Output is plain CSS values — no animation loops, no JS
 *     paint, no canvas element. Reduced-motion safe.
 *   • Honest fallback — a horizon band, not a fake photograph.
 */

// ─── Sky band per phase ─────────────────────────────────────────
// Two-stop top-of-frame band, 0% to 45%. Tones sourced from the
// lighting module's ambient palette so sunrise/morning/midday/
// afternoon/sunset/dusk/night each present a recognisably
// different sky.
const SKY = Object.freeze({
  sunrise:   ['#F8C29A', '#E89D6E'],
  morning:   ['#D8E2EC', '#E9D9B6'],
  midday:    ['#BBD3E2', '#DDE5EB'],
  afternoon: ['#E1C9A0', '#D6B583'],
  sunset:    ['#E07F4A', '#9C4A38'],
  dusk:      ['#42536C', '#2A3346'],
  night:     ['#0F1626', '#1B2438'],
});

// ─── Ground band per cluster ────────────────────────────────────
// Two-stop bottom-of-frame band, 55% to 100%. The vegetation tone
// distinguishes regional vocabulary — tropical greens are saturated
// + warm; arid is sand + ochre; temperate is muted olive; monsoon
// is a wet emerald; highland is a cool teal.
const GROUND_FARM = Object.freeze({
  tropical:  ['#3B6E3B', '#1F4A24'],
  monsoon:   ['#3F704A', '#1E4528'],
  temperate: ['#7A8C5C', '#4D5C3B'],
  arid:      ['#C9A36F', '#8B6943'],
  highland:  ['#5C7E73', '#314A45'],
});

// Garden mode collapses cluster differences — small-scale scenes
// share a single warm-soil + foliage palette (terracotta + leaf).
const GROUND_GARDEN = Object.freeze({
  base:      ['#9C7050', '#5A3B2A'],
  foliage:   ['#5E8A4C', '#39612F'],
});

// ─── Weather wash ───────────────────────────────────────────────
// A full-frame translucent overlay layered above sky+ground but
// below the lighting overlay. Adds rain mood, storm darkening,
// fog softening — never a cartoon raindrop.
const WEATHER_WASH = Object.freeze({
  rain:  'linear-gradient(180deg, rgba(70,90,110,0.10) 0%, rgba(60,80,100,0.22) 100%)',
  storm: 'linear-gradient(180deg, rgba(30,40,55,0.20) 0%, rgba(20,28,40,0.42) 100%)',
  fog:   'linear-gradient(180deg, rgba(220,225,230,0.35) 0%, rgba(200,210,220,0.20) 100%)',
  snow:  'linear-gradient(180deg, rgba(245,248,252,0.25) 0%, rgba(230,238,246,0.12) 100%)',
});

const VALID_PHASES   = Object.freeze(Object.keys(SKY));
const VALID_CLUSTERS = Object.freeze(Object.keys(GROUND_FARM));

function _sky(phase) {
  const p = VALID_PHASES.includes(phase) ? phase : 'midday';
  return SKY[p];
}

function _ground(cluster, mode) {
  if (mode === 'garden') return GROUND_GARDEN.base;
  const c = VALID_CLUSTERS.includes(cluster) ? cluster : 'temperate';
  return GROUND_FARM[c];
}

function _weatherWash(weather) {
  if (typeof weather !== 'string') return '';
  const w = weather.toLowerCase();
  return WEATHER_WASH[w] || '';
}

/**
 * proceduralCanvas({ phase, cluster, weather, mode }) →
 *   { backgroundImage, skyBand, groundBand, weatherWash, mode, phase, cluster }
 *
 * The `backgroundImage` value is the only field consumers need
 * to render the canvas. The decomposed fields are exposed for
 * test introspection + future per-band animation.
 */
export function proceduralCanvas({
  phase   = 'midday',
  cluster = 'temperate',
  weather = '',
  mode    = 'farm',
} = {}) {
  const [skyTop, skyHorizon] = _sky(phase);
  const [groundTop, groundBottom] = _ground(cluster, mode);
  const wash = _weatherWash(weather);

  // Three-band linear gradient: sky (0-45%), horizon glow (45-55%),
  // ground (55-100%). The horizon mid-stop is the AVERAGE of sky-
  // horizon and ground-top so the transition reads as a soft
  // atmospheric line rather than a hard edge.
  const horizonStop = _mix(skyHorizon, groundTop, 0.5);
  const baseGradient =
    'linear-gradient(180deg, '
    + `${skyTop} 0%, `
    + `${skyHorizon} 42%, `
    + `${horizonStop} 50%, `
    + `${groundTop} 58%, `
    + `${groundBottom} 100%)`;

  // Layered backgroundImage: optional weather wash on top, base
  // sky/ground gradient below. CSS layers paint top-to-bottom in
  // the comma-separated list, so the wash sits ABOVE the gradient.
  const backgroundImage = wash
    ? `${wash}, ${baseGradient}`
    : baseGradient;

  return Object.freeze({
    backgroundImage,
    skyBand:    `${skyTop} → ${skyHorizon}`,
    groundBand: `${groundTop} → ${groundBottom}`,
    weatherWash: wash || '',
    mode,
    phase,
    cluster,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * _mix(hexA, hexB, t) — linear blend between two #RRGGBB colours
 * at ratio t ∈ [0,1]. Bad input falls through to hexA.
 */
function _mix(hexA, hexB, t) {
  try {
    const a = _parseHex(hexA);
    const b = _parseHex(hexB);
    if (!a || !b) return hexA;
    const k = Math.max(0, Math.min(1, Number(t) || 0));
    const r = Math.round(a.r + (b.r - a.r) * k);
    const g = Math.round(a.g + (b.g - a.g) * k);
    const bl = Math.round(a.b + (b.b - a.b) * k);
    return _toHex(r, g, bl);
  } catch { return hexA; }
}

function _parseHex(s) {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function _toHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export const PROCEDURAL_PHASES   = VALID_PHASES;
export const PROCEDURAL_CLUSTERS = VALID_CLUSTERS;
