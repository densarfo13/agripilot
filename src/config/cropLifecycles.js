/**
 * cropLifecycles.js — per-crop stage lists + approximate duration in
 * days. Source of truth for the Crop Timeline System (src/lib/
 * timeline/*).
 *
 * Shape:
 *   LIFECYCLES[cropKey] = [
 *     { key, durationDays, transitionKey? },
 *     …
 *   ]
 *
 * Principles
 *   • Durations are APPROXIMATE ranges used to estimate "where is
 *     this crop likely now?" — not contractual. Confidence drops
 *     when the farmer has no planting date, so the UI hedges with
 *     "estimated" language.
 *   • Stage keys are lowercase canonical. Aliases (e.g. maize
 *     "grain_fill" ↔ "grain-fill") land on the same row via the
 *     normalizer below.
 *   • All values are intentionally conservative. Real-world season
 *     variation (rainfall, variety, altitude) swings these numbers
 *     — the engine surfaces that uncertainty in `confidenceLevel`.
 *
 * Adding a new crop
 *   1. List stages in LIFECYCLE order
 *   2. Pick durationDays conservatively (middle of typical range)
 *   3. Keep stage keys lowercase, underscores for multi-word
 *   4. No new code changes needed — cropTimelineEngine picks it up.
 */

const freeze = Object.freeze;

// ─── Generic fallback — used when a crop has no specific lifecycle ─
export const GENERIC_LIFECYCLE = freeze([
  freeze({ key: 'planting',      durationDays: 14 }),
  freeze({ key: 'establishment', durationDays: 30 }),
  freeze({ key: 'vegetative',    durationDays: 45 }),
  freeze({ key: 'flowering',     durationDays: 21 }),
  freeze({ key: 'maturation',    durationDays: 30 }),
  freeze({ key: 'harvest',       durationDays: 14 }),
]);

// ─── Per-crop lifecycles ──────────────────────────────────────────
const LIFECYCLES = freeze({
  cassava: freeze([
    freeze({ key: 'planting',      durationDays: 14 }),
    freeze({ key: 'establishment', durationDays: 30 }),
    freeze({ key: 'vegetative',    durationDays: 60 }),
    freeze({ key: 'bulking',       durationDays: 90 }),
    freeze({ key: 'maturation',    durationDays: 60 }),
    freeze({ key: 'harvest',       durationDays: 14 }),
  ]),

  maize: freeze([
    freeze({ key: 'planting',    durationDays: 7 }),
    freeze({ key: 'germination', durationDays: 10 }),
    freeze({ key: 'vegetative',  durationDays: 30 }),
    freeze({ key: 'tasseling',   durationDays: 14 }),
    freeze({ key: 'grain_fill',  durationDays: 30 }),
    freeze({ key: 'harvest',     durationDays: 14 }),
  ]),

  tomato: freeze([
    freeze({ key: 'seedling',   durationDays: 14 }),
    freeze({ key: 'transplant', durationDays: 14 }),
    freeze({ key: 'vegetative', durationDays: 21 }),
    freeze({ key: 'flowering',  durationDays: 21 }),
    freeze({ key: 'fruiting',   durationDays: 30 }),
    freeze({ key: 'harvest',    durationDays: 21 }),
  ]),

  rice: freeze([
    freeze({ key: 'seedling',   durationDays: 21 }),
    freeze({ key: 'transplant', durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 40 }),
    freeze({ key: 'flowering',  durationDays: 21 }),
    freeze({ key: 'grain_fill', durationDays: 30 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  beans: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 25 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'pod_fill',   durationDays: 21 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  groundnut: freeze([
    freeze({ key: 'planting',   durationDays: 10 }),
    freeze({ key: 'vegetative', durationDays: 40 }),
    freeze({ key: 'flowering',  durationDays: 21 }),
    freeze({ key: 'pegging',    durationDays: 21 }),
    freeze({ key: 'pod_fill',   durationDays: 30 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  soybean: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 35 }),
    freeze({ key: 'flowering',  durationDays: 21 }),
    freeze({ key: 'pod_fill',   durationDays: 35 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  sorghum: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 35 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'grain_fill', durationDays: 30 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  millet: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 30 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'grain_fill', durationDays: 25 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  pepper: freeze([
    freeze({ key: 'seedling',   durationDays: 21 }),
    freeze({ key: 'transplant', durationDays: 14 }),
    freeze({ key: 'vegetative', durationDays: 30 }),
    freeze({ key: 'flowering',  durationDays: 21 }),
    freeze({ key: 'fruiting',   durationDays: 35 }),
    freeze({ key: 'harvest',    durationDays: 21 }),
  ]),

  onion: freeze([
    freeze({ key: 'seedling',   durationDays: 28 }),
    freeze({ key: 'transplant', durationDays: 14 }),
    freeze({ key: 'vegetative', durationDays: 40 }),
    freeze({ key: 'bulking',    durationDays: 45 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  okra: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 28 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'fruiting',   durationDays: 40 }),
    freeze({ key: 'harvest',    durationDays: 21 }),
  ]),

  potato: freeze([
    freeze({ key: 'planting',   durationDays: 10 }),
    freeze({ key: 'vegetative', durationDays: 35 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'bulking',    durationDays: 40 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  'sweet-potato': freeze([
    freeze({ key: 'planting',      durationDays: 14 }),
    freeze({ key: 'establishment', durationDays: 21 }),
    freeze({ key: 'vegetative',    durationDays: 45 }),
    freeze({ key: 'bulking',       durationDays: 50 }),
    freeze({ key: 'harvest',       durationDays: 14 }),
  ]),

  yam: freeze([
    freeze({ key: 'planting',      durationDays: 21 }),
    freeze({ key: 'establishment', durationDays: 45 }),
    freeze({ key: 'vegetative',    durationDays: 90 }),
    freeze({ key: 'bulking',       durationDays: 90 }),
    freeze({ key: 'maturation',    durationDays: 45 }),
    freeze({ key: 'harvest',       durationDays: 21 }),
  ]),

  wheat: freeze([
    freeze({ key: 'planting',   durationDays: 10 }),
    freeze({ key: 'vegetative', durationDays: 40 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'grain_fill', durationDays: 30 }),
    freeze({ key: 'harvest',    durationDays: 10 }),
  ]),

  cowpea: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 30 }),
    freeze({ key: 'flowering',  durationDays: 14 }),
    freeze({ key: 'pod_fill',   durationDays: 21 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  cabbage: freeze([
    freeze({ key: 'seedling',   durationDays: 21 }),
    freeze({ key: 'transplant', durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 45 }),
    freeze({ key: 'maturation', durationDays: 21 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  cucumber: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'vegetative', durationDays: 21 }),
    freeze({ key: 'flowering',  durationDays: 10 }),
    freeze({ key: 'fruiting',   durationDays: 28 }),
    freeze({ key: 'harvest',    durationDays: 21 }),
  ]),

  carrot: freeze([
    freeze({ key: 'planting',   durationDays: 7 }),
    freeze({ key: 'seedling',   durationDays: 21 }),
    freeze({ key: 'vegetative', durationDays: 30 }),
    freeze({ key: 'bulking',    durationDays: 35 }),
    freeze({ key: 'harvest',    durationDays: 14 }),
  ]),

  // ─── Tree / perennial (typical annual cycle) ──────────────────
  banana: freeze([
    freeze({ key: 'planting',      durationDays: 14 }),
    freeze({ key: 'establishment', durationDays: 60 }),
    freeze({ key: 'vegetative',    durationDays: 180 }),
    freeze({ key: 'flowering',     durationDays: 30 }),
    freeze({ key: 'maturation',    durationDays: 90 }),
    freeze({ key: 'harvest',       durationDays: 7 }),
  ]),

  plantain: freeze([
    freeze({ key: 'planting',      durationDays: 14 }),
    freeze({ key: 'establishment', durationDays: 60 }),
    freeze({ key: 'vegetative',    durationDays: 180 }),
    freeze({ key: 'flowering',     durationDays: 30 }),
    freeze({ key: 'maturation',    durationDays: 90 }),
    freeze({ key: 'harvest',       durationDays: 7 }),
  ]),

  mango: freeze([
    freeze({ key: 'planting',      durationDays: 14 }),
    freeze({ key: 'establishment', durationDays: 180 }),
    freeze({ key: 'vegetative',    durationDays: 180 }),
    freeze({ key: 'flowering',     durationDays: 30 }),
    freeze({ key: 'fruiting',      durationDays: 120 }),
    freeze({ key: 'harvest',       durationDays: 21 }),
  ]),

  orange: freeze([
    freeze({ key: 'vegetative',    durationDays: 180 }),
    freeze({ key: 'flowering',     durationDays: 30 }),
    freeze({ key: 'fruiting',      durationDays: 180 }),
    freeze({ key: 'harvest',       durationDays: 21 }),
  ]),

  pineapple: freeze([
    freeze({ key: 'planting',      durationDays: 21 }),
    freeze({ key: 'establishment', durationDays: 60 }),
    freeze({ key: 'vegetative',    durationDays: 240 }),
    freeze({ key: 'flowering',     durationDays: 45 }),
    freeze({ key: 'fruiting',      durationDays: 120 }),
    freeze({ key: 'harvest',       durationDays: 14 }),
  ]),

  cocoa: freeze([
    freeze({ key: 'planting',      durationDays: 14 }),
    freeze({ key: 'establishment', durationDays: 180 }),
    freeze({ key: 'vegetative',    durationDays: 365 }),
    freeze({ key: 'flowering',     durationDays: 45 }),
    freeze({ key: 'fruiting',      durationDays: 150 }),
    freeze({ key: 'harvest',       durationDays: 60 }),
  ]),

  coffee: freeze([
    freeze({ key: 'vegetative',    durationDays: 180 }),
    freeze({ key: 'flowering',     durationDays: 30 }),
    freeze({ key: 'fruiting',      durationDays: 180 }),
    freeze({ key: 'harvest',       durationDays: 45 }),
  ]),

  cotton: freeze([
    freeze({ key: 'planting',      durationDays: 10 }),
    freeze({ key: 'vegetative',    durationDays: 45 }),
    freeze({ key: 'flowering',     durationDays: 35 }),
    freeze({ key: 'fruiting',      durationDays: 45 }),
    freeze({ key: 'harvest',       durationDays: 30 }),
  ]),

  sugarcane: freeze([
    freeze({ key: 'planting',      durationDays: 21 }),
    freeze({ key: 'establishment', durationDays: 90 }),
    freeze({ key: 'vegetative',    durationDays: 180 }),
    freeze({ key: 'maturation',    durationDays: 90 }),
    freeze({ key: 'harvest',       durationDays: 60 }),
  ]),
});

// ─── Stage key normaliser ────────────────────────────────────────
// Accepts legacy / synonym names and returns the canonical stage key
// used by the timeline engine. Falls through to lowercase as-is when
// no alias matches — unknown keys still render the localized label.
const STAGE_ALIASES = freeze({
  land_prep:        'planting',
  land_preparation: 'planting',
  planned:          'planting',
  planning:         'planting',
  seed:             'planting',
  planted:          'planting',
  germinate:        'germination',
  emergence:        'germination',
  growing:          'vegetative',
  mid_growth:       'vegetative',
  tasselling:       'tasseling',
  'grain-fill':     'grain_fill',
  grainfill:        'grain_fill',
  early_growth:     'vegetative',
  ripening:         'maturation',
  ripe:             'maturation',
  maturing:         'maturation',
  harvesting:       'harvest',
  post_harvest:     'harvest',
  postharvest:      'harvest',
  pod_fill_stage:   'pod_fill',
  'pod-fill':       'pod_fill',
  fruit_set:        'fruiting',
  fruit_setting:    'fruiting',
  bulk:             'bulking',
  bulbing:          'bulking',
  nursery:          'seedling',
});

export function normalizeStageKey(stage) {
  if (!stage) return null;
  const raw = String(stage).trim().toLowerCase().replace(/-/g, '_');
  return STAGE_ALIASES[raw] || raw;
}

/**
 * normalizeCropKey — same separator-collapse as cropImages.js so
 * LIFECYCLES[cassava] resolves from "CASSAVA", "Cassava", "cassava",
 * "cassavas" (no). Hyphen/underscore/space collapse to hyphen for
 * multi-word crops (sweet-potato).
 */
export function normalizeCropKey(crop) {
  if (!crop) return null;
  const raw = String(crop).trim().toLowerCase();
  if (LIFECYCLES[raw]) return raw;
  const hyphenated = raw.replace(/[\s_]+/g, '-');
  if (LIFECYCLES[hyphenated]) return hyphenated;
  const underscored = raw.replace(/[\s-]+/g, '_');
  if (LIFECYCLES[underscored]) return underscored;
  return raw;  // unknown — engine falls back to GENERIC_LIFECYCLE
}

export function getLifecycle(crop) {
  const key = normalizeCropKey(crop);
  return key && LIFECYCLES[key] ? LIFECYCLES[key] : GENERIC_LIFECYCLE;
}

export function hasLifecycle(crop) {
  const key = normalizeCropKey(crop);
  return !!(key && LIFECYCLES[key]);
}

export const _internal = freeze({ LIFECYCLES, GENERIC_LIFECYCLE, STAGE_ALIASES });
