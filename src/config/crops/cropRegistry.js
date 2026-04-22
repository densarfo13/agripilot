/**
 * cropRegistry.js — the unified crop intelligence registry.
 *
 * Consolidates every per-crop data source into one shape:
 *
 *   getCrop('maize') → {
 *     key:           'maize',
 *     labels:        { en: 'Maize (corn)', fr: 'Maïs', ... },
 *     image:         '/crops/maize.webp',
 *     category:      'grain',
 *     lifecycle:     [{ key, durationDays }, ...],
 *     defaultTaskTemplates: { [stageKey]: Template[] },
 *     riskPatterns:  RiskPattern[],
 *     yieldProfile:  { low, high, typical, unit, source },
 *     seasonalGuidance: { plantingWindow, avoidWindow?, harvestCue? },
 *   } | null
 *
 * The registry is a READ-ONLY unifier — it imports from existing
 * modules (cropLifecycles, cropImages, cropYieldRanges, crops) and
 * composes them with the new per-crop layers in this directory
 * (cropCategories, cropRiskPatterns, cropSeasonalGuidance,
 * cropTaskTemplates). It doesn't duplicate data.
 *
 * Why not a giant hand-authored per-crop object? Because each data
 * dimension (labels, image, lifecycle, yield, risk, guidance) has
 * its own maintenance cadence and translators/editors touch them
 * independently. Keeping the files separate and composing at read
 * time is cheaper to maintain than one mega-file.
 *
 * Backward compatibility
 *   • Unknown crops → getCrop returns null; UI shows neutral fallback
 *   • Crops without category/risk/seasonal data → those fields are
 *     null but lifecycle/image/labels still work
 *   • All existing consumers (yield engine, risk engine, task engine,
 *     FarmForm) can migrate incrementally — the old modules still
 *     export exactly what they always did.
 */

import { normalizeCropKey, isCanonicalCropKey, CANONICAL_KEYS } from './cropAliases.js';
import { getCropCategory } from './cropCategories.js';
import { getCropRiskPatterns, matchCropRiskPatterns } from './cropRiskPatterns.js';
import { getCropSeasonalGuidance } from './cropSeasonalGuidance.js';
import { CROP_TASK_TEMPLATES } from './cropTaskTemplates.js';

import { getLifecycle, hasLifecycle, normalizeStageKey } from '../cropLifecycles.js';
import { getCropImage, getCropImagePath, CROP_IMAGE_PLACEHOLDER } from '../cropImages.js';
import { getYieldRange } from '../cropYieldRanges.js';
import { getCropLabel as getRawCropLabel, _internal as cropsInternal } from '../crops.js';

const { CROP_LABELS_BY_LANG } = cropsInternal;
const SUPPORTED_LANGS = Object.freeze(Object.keys(CROP_LABELS_BY_LANG));

const EMPTY = Object.freeze({});
const EMPTY_LIST = Object.freeze([]);

/**
 * collectLabels(canonicalKey)
 *   Builds the `labels` map by asking getCropLabel for each
 *   supported language. The crops.js module owns the translation
 *   tables — we just project them onto the registry key (which may
 *   be hyphenated while crops.js uses underscore form). So we ask
 *   for both shapes and take the non-empty one.
 */
function collectLabels(canonicalKey) {
  const out = {};
  const underscore = canonicalKey.replace(/-/g, '_');
  for (const lang of SUPPORTED_LANGS) {
    // Try underscore form first (crops.js canon), fall back to hyphen.
    const labU = getRawCropLabel(underscore, lang);
    const labH = getRawCropLabel(canonicalKey, lang);
    // getCropLabel never returns empty; prefer the one that looks
    // localised (i.e. not the humanised hyphen-form fallback).
    out[lang] = looksHumanised(labU, underscore) && !looksHumanised(labH, canonicalKey)
      ? labH : labU;
  }
  return Object.freeze(out);
}

function looksHumanised(label, key) {
  // "Sweet Potato" from humanising 'sweet-potato' equals the same as
  // a genuine English label — not perfectly distinguishable, but
  // this heuristic catches the "we returned the fallback" case where
  // `label` is just `key` with separators → spaces + titlecase.
  if (!label) return true;
  const fromKey = key.replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
  return label === fromKey;
}

/**
 * collectYieldProfile(canonicalKey)
 *   Returns { low, high, typical, unit, source } | null.
 *   The underlying getYieldRange always returns a range (even the
 *   generic fallback); we translate "fallback" source → null so the
 *   UI can honestly say "no data" instead of showing a fake number.
 */
function collectYieldProfile(canonicalKey, countryCode = null) {
  // cropYieldRanges.js is keyed by the underscore form (crops.js).
  const code = canonicalKey.replace(/-/g, '_');
  const r = getYieldRange(code, countryCode);
  if (!r || r.source === 'fallback') return null;
  return Object.freeze({
    lowYieldPerSqm:     r.low,
    highYieldPerSqm:    r.high,
    typicalYieldPerSqm: r.typical,
    unit: 'kg/m²',
    source: r.source,
  });
}

/**
 * buildCropDefinition(canonicalKey)
 *   Core composer. Never throws — if a sub-module has no entry for
 *   this key, that field comes back null/empty and the rest still
 *   works.
 */
function buildCropDefinition(canonicalKey, { countryCode = null } = {}) {
  if (!canonicalKey) return null;

  const image = getCropImagePath(canonicalKey);
  const lifecycle = getLifecycle(canonicalKey);  // frozen; falls back to GENERIC_LIFECYCLE
  const taskTemplates = CROP_TASK_TEMPLATES[canonicalKey] || EMPTY;

  return Object.freeze({
    key: canonicalKey,
    labels: collectLabels(canonicalKey),
    image: image || CROP_IMAGE_PLACEHOLDER,
    imageResolved: Boolean(image),
    category: getCropCategory(canonicalKey),
    lifecycle,
    hasCustomLifecycle: hasLifecycle(canonicalKey),
    defaultTaskTemplates: taskTemplates,
    riskPatterns: getCropRiskPatterns(canonicalKey),
    yieldProfile: collectYieldProfile(canonicalKey, countryCode),
    seasonalGuidance: getCropSeasonalGuidance(canonicalKey, countryCode),
  });
}

/**
 * getCrop(input, options?)
 *   Primary entry point. Accepts any input shape (normalises via
 *   normalizeCropKey). Returns a frozen crop definition or null.
 */
export function getCrop(input, options = {}) {
  const key = normalizeCropKey(input);
  if (!key) return null;
  // Even if the key isn't in CANONICAL_KEYS (e.g. a catalogued
  // crop that has a lifecycle but no explicit canonical-list entry),
  // we can still build a definition — the sub-modules all fall back
  // safely. Guard only against truly empty input.
  return buildCropDefinition(key, options);
}

/**
 * getCropLifecycle(input) → frozen lifecycle array (always returns
 * something — GENERIC_LIFECYCLE for unknowns).
 */
export function getCropLifecycle(input) {
  const key = normalizeCropKey(input);
  return getLifecycle(key || '');
}

/**
 * getCropStageLabel(input, stageKey, language?)
 *   Localised stage name. For now this humanises the canonical stage
 *   key; i18n tables live in the translation system. If a
 *   translation key is missing, the humanised fallback reads
 *   naturally on a phone.
 */
export function getCropStageLabel(input, stageKey, /* language = 'en' */) {
  const norm = normalizeStageKey(stageKey);
  if (!norm) return '';
  // Humanise: 'grain_fill' → 'Grain fill'.
  return norm.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * getCropLabel(input, language?)
 *   Thin pass-through that accepts either canonical form. Delegates
 *   to crops.js which owns the label tables.
 */
export function getCropLabel(input, language = 'en') {
  const key = normalizeCropKey(input);
  if (!key) return '';
  // crops.js is keyed by underscore form, so translate the canonical
  // hyphen form before lookup. For single-word keys this is a no-op.
  const underscore = key.replace(/-/g, '_');
  return getRawCropLabel(underscore, language);
}

/**
 * listRegisteredCrops()
 *   Returns the canonical key list. Useful for registry integrity
 *   checks and for building dropdowns that want every canonical
 *   crop, not only the ones with full per-crop data.
 */
export function listRegisteredCrops() {
  return CANONICAL_KEYS;
}

// Re-exports so callers import everything they need from one place.
export {
  normalizeCropKey,
  isCanonicalCropKey,
  getCropImage,
  getCropCategory,
  getCropRiskPatterns,
  matchCropRiskPatterns,
  getCropSeasonalGuidance,
};
