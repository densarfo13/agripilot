/**
 * lighting.js — TimeAwareLighting.
 *
 * Maps a local hour (0-23) to a named lighting phase + the
 * gradient-overlay stops that DynamicWeatherBackdrop layers on
 * top of the scene photo. The overlay is the only piece of the
 * "synthetic gradient" the spec calls out — keeping it light + warm
 * + tuned-per-phase is what makes the backdrop feel cinematic
 * instead of muddy.
 *
 *   import { resolveLighting } from './lighting.js';
 *   const lit = resolveLighting({ hour: 17 });
 *   //   lit.phase    = 'sunset'
 *   //   lit.overlay  = 'linear-gradient(...)'
 *   //   lit.tone     = 'warm'
 *   //   lit.ambient  = '#F2C99A'  // for accent/glow rendering
 *
 * Strict-rule audit
 *   • Pure function — never throws, never reads window/Date directly.
 *     Caller passes the hour explicitly so SSR + tests are stable.
 *   • Returns frozen objects so consumers cannot mutate state.
 *   • Overlay strings are deterministic — same input = same output —
 *     so React reconciliation re-uses the same backgroundImage value
 *     and never re-paints unnecessarily.
 */

// Phase boundaries — coarse but matches the cinematic mockup
// language: sunrise / morning / midday / afternoon / sunset / dusk
// / night. Defined as half-open intervals on [start, end).
const PHASE_RANGES = Object.freeze([
  { phase: 'night',    start: 0,  end: 5  },
  { phase: 'sunrise',  start: 5,  end: 7  },
  { phase: 'morning',  start: 7,  end: 11 },
  { phase: 'midday',   start: 11, end: 14 },
  { phase: 'afternoon',start: 14, end: 17 },
  { phase: 'sunset',   start: 17, end: 19 },
  { phase: 'dusk',     start: 19, end: 21 },
  { phase: 'night',    start: 21, end: 24 },
]);

// Per-phase overlay tuning. Stops are { top, mid, bottom } each at
// roughly 0%, 60%, 100% — these triple-stops are softer than the
// legacy two-stop wash so the photo reads cleanly underneath.
//
// `tone` is a coarse classification used by the metric/icon layer
// to pick warm vs cool accent colours. `ambient` is a single hex
// the caller can sample for sun-glow / moon-glow effects.
const PHASE_STYLE = Object.freeze({
  sunrise: Object.freeze({
    tone: 'warm',
    ambient: '#F2A56B',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(48,30,20,0.08) 0%, '
      + 'rgba(40,28,22,0.34) 60%, '
      + 'rgba(28,22,20,0.55) 100%)',
  }),
  morning: Object.freeze({
    tone: 'warm',
    ambient: '#F5D49A',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(30,28,24,0.08) 0%, '
      + 'rgba(28,28,26,0.30) 60%, '
      + 'rgba(22,24,22,0.50) 100%)',
  }),
  midday: Object.freeze({
    tone: 'neutral',
    ambient: '#FFE9B0',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(20,28,30,0.08) 0%, '
      + 'rgba(22,28,30,0.28) 60%, '
      + 'rgba(20,26,28,0.48) 100%)',
  }),
  afternoon: Object.freeze({
    tone: 'warm',
    ambient: '#F0C176',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(34,26,20,0.10) 0%, '
      + 'rgba(34,26,20,0.32) 60%, '
      + 'rgba(28,22,20,0.52) 100%)',
  }),
  sunset: Object.freeze({
    tone: 'warm',
    ambient: '#E89150',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(48,28,18,0.12) 0%, '
      + 'rgba(40,24,18,0.40) 60%, '
      + 'rgba(28,18,16,0.62) 100%)',
  }),
  dusk: Object.freeze({
    tone: 'cool',
    ambient: '#7A8AA8',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(20,24,32,0.16) 0%, '
      + 'rgba(20,24,32,0.46) 60%, '
      + 'rgba(16,20,28,0.68) 100%)',
  }),
  night: Object.freeze({
    tone: 'cool',
    ambient: '#9FB0CB',
    overlay:
      'linear-gradient(180deg, '
      + 'rgba(12,16,22,0.30) 0%, '
      + 'rgba(10,14,20,0.55) 60%, '
      + 'rgba(8,12,18,0.78) 100%)',
  }),
});

const VALID_PHASES = Object.freeze(Object.keys(PHASE_STYLE));

/**
 * Map an hour-of-day (0-23) to a named lighting phase.
 * Bad input → 'midday' (the most neutral fallback).
 */
export function phaseForHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'midday';
  const wrapped = ((Math.floor(h) % 24) + 24) % 24;
  for (const r of PHASE_RANGES) {
    if (wrapped >= r.start && wrapped < r.end) return r.phase;
  }
  return 'midday';
}

/**
 * resolveLighting({ hour, phase? }) → { phase, tone, ambient, overlay }
 *
 * Either an explicit `phase` (one of VALID_PHASES) or an `hour`
 * must be passed. When neither is present, the helper falls back
 * to midday so the backdrop never paints a black/empty scene.
 */
export function resolveLighting({ hour, phase } = {}) {
  let resolved = (typeof phase === 'string' && VALID_PHASES.includes(phase))
    ? phase
    : phaseForHour(hour);
  const style = PHASE_STYLE[resolved] || PHASE_STYLE.midday;
  return Object.freeze({
    phase:   resolved,
    tone:    style.tone,
    ambient: style.ambient,
    overlay: style.overlay,
  });
}

export const LIGHTING_PHASES = VALID_PHASES;
