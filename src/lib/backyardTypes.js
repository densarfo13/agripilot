/**
 * backyardTypes.js — canonical backyard/garden subtype catalog.
 *
 *   import {
 *     BACKYARD_TYPES,
 *     resolveBackyardType,
 *     getTaskCopyForBackyardType,
 *     getHeroCopyForBackyardType,
 *   } from '../lib/backyardTypes.js';
 *
 *   const type = resolveBackyardType(farm);
 *   const { title, reason } = getTaskCopyForBackyardType(type);
 *
 * Why this exists
 *   Spec §3-§5/§7 of the Farm State + Backyard Type Fix asked
 *   for a 7-type backyard/garden subtype model:
 *     • Pots / Containers
 *     • Raised bed
 *     • Backyard soil bed
 *     • Balcony / Patio
 *     • Indoor grow
 *     • Greenhouse
 *     • Mixed backyard setup
 *
 *   Each type drives different per-day task copy (spec §7) so
 *   the Home daily-rhythm tile reads like real care guidance
 *   instead of a generic "Walk your field" fallback.
 *
 *   This module is the data model + copy lookup. Onboarding form
 *   updates (to LET users select these subtypes during signup)
 *   are a separate, larger workstream — for now the resolver
 *   INFERS subtype from existing farm.growingSetup +
 *   farm.farmType + farm.farmSize, so users who chose
 *   "backyard"/"home_garden" in the legacy onboarding flow get
 *   the new per-type copy without re-onboarding.
 *
 * Strict-rule audit
 *   • Pure / SSR-safe / never throws.
 *   • Returns a stable BACKYARD_TYPES.* value or 'small_farm' /
 *     'commercial' for outside-spec inputs.
 *   • Copy strings are short and reading-grade-low per the
 *     low-literacy spec.
 */

// ─── Canonical type catalog ─────────────────────────────────────
//
// Each entry is the value stored on farm/garden rows in
// the multi-experience store. The display labels are the
// English fallbacks; i18n entries can override at the UI layer.
export const BACKYARD_TYPES = Object.freeze({
  POTS:                'pots',
  RAISED_BED:          'raised_bed',
  BACKYARD_SOIL_BED:   'backyard_soil_bed',
  BALCONY_PATIO:       'balcony_patio',
  INDOOR_GROW:         'indoor_grow',
  GREENHOUSE:          'greenhouse',
  MIXED:               'mixed',
  // Non-backyard catch-alls — useful so callers can use ONE
  // dispatch path for every farm/garden.
  SMALL_FARM:          'small_farm',
  COMMERCIAL:          'commercial',
});

// ─── Per-type daily-rhythm task copy (spec §7) ──────────────────
//
// Title: the action card title.
// Reason: 1-line "why now" beneath the title.
// Both intentionally short — spec §22 low-literacy readiness.
const TASK_COPY = Object.freeze({
  pots: Object.freeze({
    title:  'Check pot moisture today',
    reason: 'Pots dry out faster than soil beds. A quick finger check tells you if water is needed.',
  }),
  raised_bed: Object.freeze({
    title:  'Check bed moisture and leaf health',
    reason: 'Raised beds drain fast and warm early. Look for dry top-inch + any drooping leaves.',
  }),
  backyard_soil_bed: Object.freeze({
    title:  'Walk your garden and check soil',
    reason: 'A short walk around the bed catches dry patches, pests, or weak spots before they spread.',
  }),
  balcony_patio: Object.freeze({
    title:  'Check container plants on your balcony',
    reason: 'Containers exposed to wind dry faster. Check moisture and rotate for even sun.',
  }),
  indoor_grow: Object.freeze({
    title:  'Check indoor plants and light',
    reason: 'Indoor plants need steady light and even moisture. A daily glance prevents stretch and rot.',
  }),
  greenhouse: Object.freeze({
    title:  'Check greenhouse heat and humidity',
    reason: 'Greenhouses swing fast on sunny days. Vent if needed and check soil moisture.',
  }),
  mixed: Object.freeze({
    title:  'Walk your garden and check moisture',
    reason: 'Mixed setups need a quick check of pots, beds, and any sheltered plants.',
  }),
  small_farm: Object.freeze({
    title:  'Walk your field and check crop health',
    reason: 'A short field walk catches dry soil, weak leaves, pests, or unusual spots early.',
  }),
  commercial: Object.freeze({
    title:  'Review priority field conditions',
    reason: 'Check the highest-risk blocks first: edges, low spots, recent transplants.',
  }),
});

// ─── Per-type hero copy (spec §7) ──────────────────────────────
//
// The ImmersiveHomeHero empty-state title + line + CTA.
// Same daily-rhythm intent as TASK_COPY but tuned for the hero
// surface (shorter title; CTA names the action, not "Scan").
const HERO_COPY = Object.freeze({
  pots: Object.freeze({
    title: 'Today in your garden',
    line:  'A quick pot check helps catch problems early.',
    cta:   'Start garden check',
  }),
  raised_bed: Object.freeze({
    title: 'Today in your garden',
    line:  'A quick bed check helps catch problems early.',
    cta:   'Start garden check',
  }),
  backyard_soil_bed: Object.freeze({
    title: 'Today in your garden',
    line:  'A quick garden walk helps catch problems early.',
    cta:   'Start garden check',
  }),
  balcony_patio: Object.freeze({
    title: 'Today on your balcony',
    line:  'A quick container check helps catch problems early.',
    cta:   'Start check',
  }),
  indoor_grow: Object.freeze({
    title: 'Today on your plants',
    line:  'A quick indoor check helps catch problems early.',
    cta:   'Start check',
  }),
  greenhouse: Object.freeze({
    title: 'Today in your greenhouse',
    line:  'A quick check helps catch heat or moisture problems early.',
    cta:   'Start check',
  }),
  mixed: Object.freeze({
    title: 'Today in your garden',
    line:  'A quick check helps catch problems early.',
    cta:   'Start garden check',
  }),
  small_farm: Object.freeze({
    title: 'Today on your farm',
    line:  'A quick field check helps catch problems early.',
    cta:   'Start farm check',
  }),
  commercial: Object.freeze({
    title: 'Today on your farm',
    line:  'A quick field check helps catch problems early.',
    cta:   'Start farm check',
  }),
});

// ─── Resolution ────────────────────────────────────────────────

/**
 * Resolve the canonical backyard type for a farm/garden row.
 * Returns one of the BACKYARD_TYPES.* values; defaults to
 * 'small_farm' for any non-backyard input.
 *
 * Resolution priority:
 *   1. explicit row.backyardType (if set)
 *   2. row.growingSetup (legacy onboarding field)
 *   3. row.farmType + row.farmSize inference
 *
 * @param {object|null} farm
 * @returns {string} one of BACKYARD_TYPES.*
 */
export function resolveBackyardType(farm) {
  try {
    if (!farm || typeof farm !== 'object') return BACKYARD_TYPES.SMALL_FARM;
    // ─── 1. Explicit field wins ─────────────────────────────
    const explicit = _normType(farm.backyardType);
    if (explicit) return explicit;
    // ─── 2. growingSetup legacy field ───────────────────────
    const gs = _normType(farm.growingSetup);
    if (gs) return gs;
    // ─── 3. Inference from farmType + size ──────────────────
    const ft = String(farm.farmType || '').toLowerCase();
    const isBackyard = ft === 'backyard' || ft === 'home_garden' || ft === 'home';
    if (!isBackyard) {
      // Commercial threshold: >= 50 acres ≈ 200,000 sq m.
      const sqMeters = _toSquareMeters(farm.farmSize, farm.sizeUnit || farm.unit);
      if (sqMeters != null && sqMeters >= 200000) return BACKYARD_TYPES.COMMERCIAL;
      return BACKYARD_TYPES.SMALL_FARM;
    }
    // Backyard but no subtype hint — default to MIXED so the
    // Home copy reads naturally instead of presupposing pots.
    return BACKYARD_TYPES.MIXED;
  } catch {
    return BACKYARD_TYPES.SMALL_FARM;
  }
}

/**
 * Pick the action-card title + reason for the given type.
 * Always returns a non-null { title, reason } pair.
 */
export function getTaskCopyForBackyardType(type) {
  const t = _normType(type) || BACKYARD_TYPES.SMALL_FARM;
  return TASK_COPY[t] || TASK_COPY.small_farm;
}

/**
 * Pick the Home hero empty-state title + line + cta for the
 * given type.
 */
export function getHeroCopyForBackyardType(type) {
  const t = _normType(type) || BACKYARD_TYPES.SMALL_FARM;
  return HERO_COPY[t] || HERO_COPY.small_farm;
}

/**
 * Whether the type is a backyard variant (not small/commercial farm).
 * Used by callers that branch on garden vs field wording.
 */
export function isBackyardType(type) {
  const t = _normType(type);
  if (!t) return false;
  return t !== BACKYARD_TYPES.SMALL_FARM && t !== BACKYARD_TYPES.COMMERCIAL;
}

// ─── Internal helpers ──────────────────────────────────────────

function _normType(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  // Accept legacy aliases for forward-compat.
  if (s === 'container' || s === 'containers' || s === 'pot') return BACKYARD_TYPES.POTS;
  if (s === 'raised' || s === 'bed' || s === 'raised_beds') return BACKYARD_TYPES.RAISED_BED;
  if (s === 'soil' || s === 'soil_bed' || s === 'backyard') return BACKYARD_TYPES.BACKYARD_SOIL_BED;
  if (s === 'balcony' || s === 'patio') return BACKYARD_TYPES.BALCONY_PATIO;
  if (s === 'indoor' || s === 'house' || s === 'inside') return BACKYARD_TYPES.INDOOR_GROW;
  if (s === 'green' || s === 'greenhouse' || s === 'tunnel') return BACKYARD_TYPES.GREENHOUSE;
  if (s === 'mixed' || s === 'multi' || s === 'home_garden') return BACKYARD_TYPES.MIXED;
  if (s === 'small_farm' || s === 'farm' || s === 'small') return BACKYARD_TYPES.SMALL_FARM;
  if (s === 'commercial' || s === 'large' || s === 'large_farm') return BACKYARD_TYPES.COMMERCIAL;
  // Already canonical?
  const values = Object.values(BACKYARD_TYPES);
  if (values.includes(s)) return s;
  return null;
}

function _toSquareMeters(value, unit) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const u = String(unit || '').toLowerCase();
  if (u === 'm2' || u === 'sqm' || u === 'sq_m' || u === 'square_meter' || u === 'square_meters') return num;
  if (u === 'ha' || u === 'hectare' || u === 'hectares') return num * 10000;
  if (u === 'ac' || u === 'acre' || u === 'acres') return num * 4046.86;
  if (u === 'ft2' || u === 'sqft' || u === 'sq_ft' || u === 'square_feet') return num * 0.092903;
  // Unknown unit — assume acres (the legacy default).
  return num * 4046.86;
}

const _module = {
  BACKYARD_TYPES,
  resolveBackyardType,
  getTaskCopyForBackyardType,
  getHeroCopyForBackyardType,
  isBackyardType,
};
export default _module;
