/**
 * getRecommendationReasonSummary — one-line summary for compact
 * crop cards (mobile list view). Picks the two highest-value
 * reasons and joins them with an "·" separator so the card stays
 * a single readable line.
 *
 * Avoids the vague words the spec calls out ("recommended",
 * "suitable", "optimized") by leaning on the same i18n keys the
 * existing reason generator already uses — but picked + capped
 * at 2 and then joined.
 *
 *   buildRecommendationReasons(crop, ctx) → string[]  (full list, capped at 3)
 *   getRecommendationReasonSummary(crop, ctx, t) → string  (≤ 2, joined)
 *
 * ctx shape matches what CropRecommendationStep already passes:
 *   { region, season, farmSize, beginnerLevel, farmType, mode }
 */

const GOOD_KEYS = Object.freeze([
  'recommendation.plantingOpen',
  'recommendation.beginnerReason',
  'recommendation.goodForBackyard',
  'recommendation.goodForSmallFarms',
  'recommendation.goodForRegion',
]);

const VAGUE_WORDS = /^(recommended|suitable|optimi[sz]ed)\.?$/i;

function isVague(str) {
  if (!str) return true;
  return VAGUE_WORDS.test(String(str).trim());
}

export function buildRecommendationReasons(crop = {}, ctx = {}) {
  const keys = [];
  const fit = String(crop.fitLevel || '').toLowerCase();
  const status = String(crop.plantingStatus || '').toLowerCase();

  if (fit === 'high') {
    // Prefer the region-specific variant so the copy reads
    // "Good for small farms in your region" not just "recommended".
    if (ctx?.mode === 'backyard' || ctx?.farmType === 'backyard') {
      keys.push('recommendation.goodForBackyard');
    } else if (ctx?.farmSize === 'small' || ctx?.farmType === 'small_farm') {
      keys.push('recommendation.goodForSmallFarms');
    } else {
      keys.push('recommendation.goodForRegion');
    }
  }

  if (status === 'plant_now' || status === 'plant_soon') {
    keys.push('recommendation.plantingOpen');
  }

  if (ctx?.beginnerLevel === 'beginner' || ctx?.beginnerLevel === 'new') {
    keys.push('recommendation.beginnerReason');
  }

  // Dedupe preserving order; cap at 3.
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    if (!seen.has(k)) { seen.add(k); out.push(k); }
    if (out.length >= 3) break;
  }
  return out;
}

export function getRecommendationReasonSummary(crop = {}, ctx = {}, t = null) {
  // Prefer the server-shaped crop.reasons if they're already
  // translated + non-vague; otherwise derive from keys.
  if (Array.isArray(crop.reasons) && crop.reasons.length) {
    const clean = crop.reasons.filter((r) => !isVague(r)).slice(0, 2);
    if (clean.length) return clean.join(' · ');
  }
  const keys = buildRecommendationReasons(crop, ctx).slice(0, 2);
  if (!t) return keys.join(' · ');
  const translated = keys.map((k) => t(k)).filter((s) => s && !isVague(s));
  return translated.join(' · ');
}

export const _internal = { GOOD_KEYS, isVague };
