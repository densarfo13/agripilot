/**
 * onboardingCropFilter.js — client-side helpers that turn onboarding
 * answers into a filtered list of crop recommendations, using the
 * server's suitability scorer.
 *
 * Exports:
 *   getRecommendedCropsForOnboarding({ country, state, farmType,
 *     growingStyle?, beginnerLevel, currentMonth?, crops? }) — async
 *   filterCropsByBeginnerStatus(list, isBeginner)                — pure
 *   filterCropsByFarmSize(list, size)                            — pure
 *   categorizeCropsByFit(list)                                   — pure
 *
 * Keeps the fallback cohort so the onboarding still works when the
 * user is offline — we default-rank by crop profile heuristics then
 * let the server override once it's reachable.
 */

// Fallback set surfaced when the network is unreachable. Picks
// crops that are broadly viable across temperate North America.
const OFFLINE_FALLBACK_CROPS = Object.freeze([
  'tomato', 'pepper', 'lettuce', 'beans', 'herbs', 'cucumber',
  'carrot', 'squash', 'kale',
]);

// Crops that should never be shown as "Best for you" on a small
// backyard unless the region explicitly allows them. Used by
// filterCropsByFarmSize.
const COMMERCIAL_HEAVY = new Set([
  'sorghum', 'cotton', 'rice', 'sugarcane', 'almonds', 'pecan',
  'alfalfa', 'corn', 'sweet_corn', 'soybean', 'wheat', 'barley',
  'oats', 'sunflower',
]);

const BEGINNER_FRIENDLY = new Set([
  'tomato', 'pepper', 'lettuce', 'beans', 'bush_beans',
  'herbs', 'cucumber', 'radish', 'carrot', 'kale', 'zucchini',
  'green_onion', 'collards', 'swiss_chard',
]);

/**
 * Async — calls POST /api/v2/recommend/us/suitability with the
 * onboarding inputs. Returns:
 *   { location, bestMatch[], alsoConsider[], notRecommendedNow[],
 *     warnings: { isFallback: boolean } }
 */
export async function getRecommendedCropsForOnboarding(input) {
  const body = {
    country: input.country || 'USA',
    state: input.state,
    farmType: input.farmType,
    growingStyle: input.growingStyle || null,
    purpose: input.purpose || null,
    beginnerLevel: input.beginnerLevel || (input.isBeginner ? 'beginner' : 'intermediate'),
    currentMonth: Number.isFinite(input.currentMonth)
      ? input.currentMonth
      : new Date().getMonth() + 1,
    crops: input.crops,
  };
  try {
    const res = await fetch('/api/v2/recommend/us/suitability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`request_failed_${res.status}`);
    const data = await res.json();
    return { ...data, warnings: { isFallback: false } };
  } catch {
    // Offline / server down → return a flat list clients can still render.
    return buildOfflineFallback(input);
  }
}

/** Keep only beginner-friendly crops at the top when the user is new. */
export function filterCropsByBeginnerStatus(list, isBeginner) {
  if (!Array.isArray(list)) return [];
  if (!isBeginner) return list;
  const friendly = [];
  const rest = [];
  for (const c of list) {
    if (BEGINNER_FRIENDLY.has(c.crop) || c.fitLevel === 'high') friendly.push(c);
    else rest.push(c);
  }
  return [...friendly, ...rest];
}

/**
 * Demote crops that don't match the farm size.
 *   size = 'backyard' | 'small' | 'medium' | 'large' | 'commercial'
 * Backyard/small users should never see commercial-heavy row crops
 * as top picks; medium/large allow the broader set back.
 */
export function filterCropsByFarmSize(list, size) {
  if (!Array.isArray(list)) return [];
  const normalized = String(size || '').toLowerCase();
  const isSmall = ['backyard', 'small'].includes(normalized);
  if (!isSmall) return list;
  const primary = [];
  const demoted = [];
  for (const c of list) {
    if (COMMERCIAL_HEAVY.has(c.crop)) demoted.push({ ...c, fitLevel: downgrade(c.fitLevel) });
    else primary.push(c);
  }
  return [...primary, ...demoted];
}

/** Group a flat list into the three UI buckets by fit level. */
export function categorizeCropsByFit(list = []) {
  const best = [];
  const possible = [];
  const notRecommended = [];
  for (const c of list) {
    if (c.fitLevel === 'high') best.push(c);
    else if (c.fitLevel === 'medium') possible.push(c);
    else notRecommended.push(c);
  }
  return { best, possible, notRecommended };
}

/**
 * Pick the top recommendation deterministically for "Pick the best
 * crop for me" button. Prefers high fit, then medium, then any.
 */
export function pickTopCrop(list = []) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list
    .slice()
    .sort((a, b) => (b.suitabilityScore || 0) - (a.suitabilityScore || 0))[0];
}

// ─── helpers ──────────────────────────────────────────────────

function downgrade(level) {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

function buildOfflineFallback(input) {
  const month = Number.isFinite(input.currentMonth)
    ? input.currentMonth : new Date().getMonth() + 1;
  const crops = OFFLINE_FALLBACK_CROPS.map((key) => ({
    crop: key,
    cropName: key.replace(/_/g, ' '),
    suitabilityScore: 70,
    fitLevel: 'medium',
    plantingStatus: month >= 4 && month <= 9 ? 'plant_now' : 'wait',
    reasons: [],
    riskNotes: [],
    regionLabel: null,
    fitBadge: 'Worth considering',
    lowFitWarning: false,
    plantingWindowExplanation: 'Offline — suitability will update once you reconnect.',
  }));
  return {
    location: null,
    bestMatch: [],
    alsoConsider: crops,
    notRecommendedNow: [],
    warnings: { isFallback: true },
  };
}

export const _internal = { OFFLINE_FALLBACK_CROPS, COMMERCIAL_HEAVY, BEGINNER_FRIENDLY };
