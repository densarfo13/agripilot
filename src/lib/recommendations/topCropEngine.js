/**
 * topCropEngine.js — registry-driven Top Crops recommendation engine.
 *
 *   recommendTopCrops(context) → {
 *     best: RecCard,            // highest-scoring crop
 *     alternatives: RecCard[],  // next 2 by score
 *     all: RecCard[],           // every scored candidate, sorted
 *     context: FrozenContext,   // echo back what we used
 *   } | null
 *
 *   RecCard = {
 *     cropId,                   // canonical hyphen-lowercase
 *     score,                    // integer; higher = better fit
 *     reasons: i18nKey[],       // translation keys, in priority order
 *     badges:  i18nKey[],       // shorter "chip" tags
 *     warnings: i18nKey[],      // caveats the UI should show subtly
 *     durationText: string,     // "10–16 weeks" — already formatted
 *     waterNeed, costLevel, droughtTolerance, difficulty, beginnerFriendly,
 *     regions, tags,
 *     recommendationType,       // 'best_for_you' | 'also_consider'
 *   }
 *
 * The engine works on CANONICAL CROP IDs throughout — never display
 * text. Callers that have legacy uppercase codes should pipe them
 * through normalizeCropId() first.
 *
 * Scoring (spec §3) — rough weighted sum of independent factors so
 * the rules stay explainable:
 *
 *   region match          +25   (country-resolved region in crop.regions)
 *   beginner friendliness +20   (if farmer is a beginner)
 *   farm-type fit         +15   (backyard↔low-cost/low-water,
 *                                commercial↔high-market-potential)
 *   low water need        +15   (when waterAvailability is rain_only)
 *   low startup cost      +15   (when budgetSensitivity is low)
 *   seasonal fit          +10   (registry's seasonal guidance)
 *   preferred crop bonus  +30   (when preferredCrop matches)
 *   advanced/expert crop  -20   (when experience='beginner')
 *   cycle length vs profile  ±10 (prefers shorter cycles for beginner/
 *                                  backyard, allows longer for
 *                                  commercial/advanced)
 *
 * Reasons come from the same factors (so the UI can show why a card
 * won). Badges are a short compact subset — {drought_tolerant,
 * low_water, low_cost, beginner_friendly} chips.
 */

import {
  normalizeCropId,
  getCrop,
  getCropLabel,
  getCropImage,
  CANONICAL_KEYS,
  getCropsForRegion,
  getRegionForCountry,
} from '../../config/crops/index.js';
import { evaluateSeasonalFit } from './seasonalCropEngine.js';

const f = Object.freeze;

// ─── Weights ────────────────────────────────────────────────────
const W = f({
  regionMatch:    25,
  beginner:       20,
  farmType:       15,
  lowWater:       15,
  lowCost:        15,
  seasonFit:      10,
  preferred:      30,
  cycleFit:       10,
  advancedPenalty: -20,
});

// Tiny season heuristic — SSA/tropics-friendly default.
const MONTH_SEASON = f({
  0: 'dry', 1: 'dry', 2: 'long_rains', 3: 'long_rains',
  4: 'long_rains', 5: 'long_rains', 6: 'dry', 7: 'dry',
  8: 'short_rains', 9: 'short_rains', 10: 'short_rains', 11: 'dry',
});

function currentSeason(now = new Date()) {
  return MONTH_SEASON[now.getMonth()] || 'long_rains';
}

// Normalise whatever shape callers pass in.
function normaliseContext(raw = {}) {
  const ctx = raw || {};
  const country = (ctx.country || '').toUpperCase() || null;
  const region  = ctx.region || (country ? getRegionForCountry(country) : null);
  const farmType = String(ctx.farmType || '').toLowerCase() || 'small_farm';
  const experience = String(
    ctx.farmerExperienceLevel || ctx.experience || 'beginner',
  ).toLowerCase();
  const preferredCrop = ctx.preferredCrop
    ? normalizeCropId(ctx.preferredCrop) : null;
  // Month may be passed explicitly (1-12). Fall back to the month
  // component of `now`, else today.
  const nowDate = ctx.now ? new Date(ctx.now) : new Date();
  const month = Number.isFinite(ctx.month)
    ? Number(ctx.month)
    : (nowDate.getMonth() + 1);
  return f({
    country, region, farmType, experience,
    preferredCrop,
    seasonContext:       ctx.seasonContext || currentSeason(nowDate),
    waterAvailability:   ctx.waterAvailability || 'rain_only',
    budgetSensitivity:   ctx.budgetSensitivity || 'medium',
    state:               ctx.state || null,
    month,
    weather:             ctx.weather || null,
    now:                 ctx.now || null,
  });
}

function formatDuration(range) {
  if (!range || range.length < 2) return '';
  const [a, b] = range;
  if (a === b) return `${a}`;
  return `${a}\u2013${b}`;
}

// ─── Per-crop scorer ───────────────────────────────────────────
function scoreCrop(cropId, ctx) {
  const crop = getCrop(cropId);
  if (!crop) return null;
  let score = 0;
  const reasons = [];
  const badges = [];
  const warnings = [];

  // 1. Region match (strongest positive for contextual fit).
  if (ctx.region && Array.isArray(crop.regions)) {
    if (crop.regions.includes(ctx.region)) {
      score += W.regionMatch;
      reasons.push('topCrops.reason.regionMatch');
    } else if (crop.regions.includes('global') || crop.regions.length === 0) {
      // Global crops don't boost, but they don't get penalised either.
      // No reason pushed — lets other factors earn the card.
    }
  }

  // 2. Beginner friendliness.
  if (ctx.experience === 'beginner') {
    if (crop.beginnerFriendly) {
      score += W.beginner;
      reasons.push('topCrops.reason.beginnerFriendly');
      badges.push('topCrops.badge.beginnerFriendly');
    } else if (crop.difficulty === 'advanced') {
      score += W.advancedPenalty;
      warnings.push('topCrops.warning.advancedCrop');
    }
  } else if (ctx.experience === 'intermediate') {
    if (crop.difficulty === 'advanced') {
      warnings.push('topCrops.warning.advancedCrop');
    } else {
      score += 5;
    }
  } else {
    // advanced farmers — everything OK
    score += 5;
  }

  // 3. Farm-type fit.
  if (ctx.farmType === 'backyard') {
    if (crop.costLevel === 'low' && crop.waterNeed !== 'high') {
      score += W.farmType;
      reasons.push('topCrops.reason.fitsBackyard');
    } else if (crop.costLevel === 'high' || crop.waterNeed === 'high') {
      warnings.push('topCrops.warning.heavyForBackyard');
    }
  } else if (ctx.farmType === 'commercial') {
    if (crop.marketPotential === 'high') {
      score += W.farmType;
      reasons.push('topCrops.reason.goodMarket');
      badges.push('topCrops.badge.goodMarket');
    }
  } else {
    // small_farm — balanced; a small fit bonus
    score += 5;
  }

  // 4. Water availability.
  if (ctx.waterAvailability === 'rain_only') {
    if (crop.waterNeed === 'low') {
      score += W.lowWater;
      reasons.push('topCrops.reason.lowWater');
      badges.push('topCrops.badge.lowWater');
    } else if (crop.waterNeed === 'high') {
      warnings.push('topCrops.warning.needsIrrigation');
    }
    if (crop.droughtTolerance === 'high') {
      score += 5;
      reasons.push('topCrops.reason.droughtTolerant');
      badges.push('topCrops.badge.droughtTolerant');
    }
  } else if (ctx.waterAvailability === 'irrigation') {
    // No bonus; all crops viable.
  }

  // 5. Budget sensitivity.
  if (ctx.budgetSensitivity === 'low' || ctx.budgetSensitivity === 'high_sensitive') {
    if (crop.costLevel === 'low') {
      score += W.lowCost;
      reasons.push('topCrops.reason.lowCost');
      badges.push('topCrops.badge.lowCost');
    } else if (crop.costLevel === 'high') {
      warnings.push('topCrops.warning.highCost');
    }
  }

  // 6. Season fit — registry-backed seasonality by country + month.
  //    Weather (when available) nudges the fit up or down a single
  //    step. evaluateSeasonalFit always returns a usable shape so we
  //    can safely drop it straight into reasons / badges / warnings.
  const seasonal = evaluateSeasonalFit({
    cropId: crop.id,
    country: ctx.country,
    state:   ctx.state,
    month:   ctx.month,
    weather: ctx.weather,
    now:     ctx.now,
  });
  score += seasonal.scoreAdjustment || 0;
  if (seasonal.seasonFit === 'high') {
    reasons.push('topCrops.reason.goodTiming');
    badges.push('topCrops.badge.goodTiming');
  } else if (seasonal.seasonFit === 'low') {
    warnings.push('topCrops.warning.outOfSeason');
  }
  // Rainfall-specific warning chip when the combined picture is
  // low fit purely because of current rainfall (dry or heavy).
  if (seasonal.rainfallFit === 'low' && seasonal.riskMessage) {
    warnings.push(seasonal.riskMessage);
  }
  // Surface the specific explanation reasons (preferredMonth /
  // acceptableMonth / outOfWindow / weather nudges) so the UI can
  // show a chip per structured reason without string guesswork.
  for (const r of seasonal.reasons) reasons.push(r);

  // 7. Preferred crop bonus — the farmer asked for this, trust them.
  if (ctx.preferredCrop && ctx.preferredCrop === crop.id) {
    score += W.preferred;
    reasons.push('topCrops.reason.yourChoice');
  }

  // 8. Cycle length vs farmer profile.
  const cycleMax = crop.cycleRangeWeeks && crop.cycleRangeWeeks[1];
  if (cycleMax) {
    if ((ctx.experience === 'beginner' || ctx.farmType === 'backyard')
        && cycleMax <= 20) {
      score += W.cycleFit;
    }
    if (cycleMax >= 104 && ctx.experience === 'beginner') {
      // Multi-year tree crops are a big commitment for a new farmer.
      warnings.push('topCrops.warning.longCycle');
    }
  }

  return {
    cropId: crop.id,
    score,
    reasons: f(Array.from(new Set(reasons))),
    badges:  f(Array.from(new Set(badges))),
    warnings: f(warnings),
    durationText:     formatDuration(crop.cycleRangeWeeks),
    waterNeed:        crop.waterNeed,
    costLevel:        crop.costLevel,
    droughtTolerance: crop.droughtTolerance,
    difficulty:       crop.difficulty,
    beginnerFriendly: crop.beginnerFriendly,
    regions:          crop.regions,
    tags:             crop.tags,
    // Seasonal + rainfall intelligence — UI renders plantingMessage
    // as the dynamic "good time to plant now" copy, honouring
    // language. `rainfallFit` / `weatherState` / `riskMessage` /
    // `taskHint` let downstream engines (risk, task) react.
    seasonFit:        seasonal.seasonFit,
    plantingMessage:  seasonal.plantingMessage,
    plantingWindow:   seasonal.window,
    weatherAdjusted:  seasonal.weatherAdjusted,
    weatherState:     seasonal.weatherState,
    rainfallFit:      seasonal.rainfallFit,
    riskMessage:      seasonal.riskMessage,
    taskHint:         seasonal.taskHint,
  };
}

/**
 * recommendTopCrops(context)
 *   Score every canonical crop, sort by score, return the top pick +
 *   two alternatives. Never throws — returns null when the registry
 *   is empty (shouldn't happen in practice).
 */
export function recommendTopCrops(rawContext = {}) {
  const ctx = normaliseContext(rawContext);
  const pool = ctx.region
    ? getCropsForRegion(ctx.region, { pool: CANONICAL_KEYS })
    : CANONICAL_KEYS;
  if (!pool || pool.length === 0) return null;

  const scored = [];
  for (const id of pool) {
    const card = scoreCrop(id, ctx);
    if (card) scored.push(card);
  }
  if (scored.length === 0) return null;

  // Break ties deterministically so the UI doesn't jitter between
  // equal-scoring crops: by id ascending.
  scored.sort((a, b) => (b.score - a.score) || a.cropId.localeCompare(b.cropId));

  const [best, ...rest] = scored;
  const taggedBest = f({ ...best, recommendationType: 'best_for_you' });
  const alternatives = rest.slice(0, 2).map((c) => f({
    ...c, recommendationType: 'also_consider',
  }));

  const out = f({
    best:         taggedBest,
    alternatives: f(alternatives),
    all:          f(scored),
    context:      ctx,
  });

  // Dev-only logging per spec §12.
  if (typeof process !== 'undefined'
      && process.env && process.env.NODE_ENV !== 'production') {
    try {
      // eslint-disable-next-line no-console
      console.log('TOP_CROP_RECOMMENDATION', {
        language: rawContext.language || null,
        context: ctx,
        bestCropId:      taggedBest.cropId,
        alternativeIds:  alternatives.map((c) => c.cropId),
      });
    } catch { /* never let logging break the flow */ }
  }

  return out;
}

/**
 * renderTopCrop(card, language)
 *   UI-helper that projects a RecCard into label/image using the
 *   registry. Keeps UI components pure — they never need to call
 *   getCropLabel/getCropImage themselves.
 */
export function renderTopCrop(card, language = 'en') {
  if (!card || !card.cropId) return null;
  return f({
    ...card,
    label: getCropLabel(card.cropId, language),
    image: getCropImage(card.cropId),
  });
}

export const _internal = f({ scoreCrop, normaliseContext, currentSeason, W });
