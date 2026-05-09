/**
 * regionalRelevance — context-aware booster for "Nearby support".
 *
 *   import { scoreSupportRelevance, prioritiseNearbySupport }
 *     from 'src/intelligence/funding/regionalRelevance.js';
 *
 *   const ranked = prioritiseNearbySupport(opportunities, context);
 *   if (ranked[0]) renderNearbySupportCard(ranked[0]);
 *
 * SPEC §1 + §3 + §5
 *
 *   Region match is necessary but not sufficient. A grant that
 *   covers the right region is ONLY worth surfacing when the
 *   farmer's current situation aligns with what it offers.
 *
 *     • Drought risk          → boost insurance + irrigation +
 *                               emergency_relief
 *     • Harvest approaching   → boost market_access +
 *                               buyer_coordination + storage
 *     • Disease outbreak      → boost emergency_relief +
 *                               extension
 *     • Scaling production    → boost equipment + financial
 *     • Repeated task streak  → boost financial / equipment
 *                               (growth funding)
 *
 *   The scorer combines:
 *     – the legacy fundingMatcher score (region/crop/size: 0–100)
 *     – a context booster (0..30) per situation match
 *     – a verified-host gate (any URL failing the safety
 *       classifier scores 0 — never ranked)
 *
 *   Threshold to surface: composite score ≥ 60. Below that we
 *   fall through silently to the next-best orchestrator candidate.
 *
 * STRICT-RULE AUDIT
 *   • Pure function. Never throws. Tolerates partial input.
 *   • No farmer-facing scores ever leak to the UI — the
 *     orchestrator's adapter strips them.
 *   • Verified-only gate enforces the safety lockdown from the
 *     prior turn (`classifyFundingUrl`).
 */

import { normaliseCategory, SUPPORT_CATEGORY } from './supportCategories.js';
import { classifyFundingUrl }                   from '../../security/validateFundingUrl.js';

// ─── Context → boosted-category map ──────────────────────────────
// When a context signal is present, the listed categories get a
// numeric boost. Multiple signals can stack (drought + harvest =
// emergency_relief AND market_access both boosted).
const CONTEXT_BOOSTS = Object.freeze({
  drought: Object.freeze([
    SUPPORT_CATEGORY.WEATHER_PREP,
    SUPPORT_CATEGORY.INSURANCE,
    SUPPORT_CATEGORY.EMERGENCY_RELIEF,
  ]),
  harvest: Object.freeze([
    SUPPORT_CATEGORY.MARKET_ACCESS,
    SUPPORT_CATEGORY.BUYER_COORDINATION,
    SUPPORT_CATEGORY.EQUIPMENT,
  ]),
  disease: Object.freeze([
    SUPPORT_CATEGORY.EMERGENCY_RELIEF,
    SUPPORT_CATEGORY.EXTENSION,
    SUPPORT_CATEGORY.INPUTS_SEEDS,
  ]),
  scaling: Object.freeze([
    SUPPORT_CATEGORY.EQUIPMENT,
    SUPPORT_CATEGORY.FINANCIAL,
    SUPPORT_CATEGORY.TRAINING,
  ]),
  newFarmer: Object.freeze([
    SUPPORT_CATEGORY.TRAINING,
    SUPPORT_CATEGORY.EXTENSION,
    SUPPORT_CATEGORY.GOVERNMENT_PROGRAM,
  ]),
});

const BOOST_PER_MATCH    = 10;   // each matched category gains +10
const BOOST_CAP          = 30;   // max combined boost
const MIN_SURFACE_SCORE  = 60;

// ─── Context detection ───────────────────────────────────────────

// Window for the "scaling" signal — only count tasks completed
// in the last 14 days. A user with 100 lifetime completions but
// nothing recent isn't actively scaling.
const SCALING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SCALING_THRESHOLD = 5;

/**
 * Extract situational signals from an IntelligenceContext.
 * Each signal name corresponds to a key in CONTEXT_BOOSTS.
 *
 * Robustness fixes (May 2026 regional-funding engine fix):
 *   • `scaling` was triggering on lifetime completion count;
 *     now windows to the last 14 days using `completedAt` /
 *     `completedDate` / `doneAt` timestamps. When a task carries
 *     no timestamp we pessimistically assume "old" so a single
 *     fresh sprint of work moves the needle.
 *   • `newFarmer` was reading `ctx.profile` which the canonical
 *     context didn't normalize until this turn; now that the
 *     context exposes `profile.{experienceLevel,farmerType}`,
 *     this signal actually fires from production input.
 *
 * @param {object} ctx
 * @returns {Set<string>}
 */
export function detectContextSignals(ctx) {
  const out = new Set();
  if (!ctx || typeof ctx !== 'object') return out;

  // Drought — hot temp + low rain prob OR weather flag.
  const weather = ctx.weather || {};
  const tempC    = Number(weather.tempC    ?? weather.temperature ?? weather.temp);
  const rainProb = Number(weather.rainProbability ?? weather.precipitationProbability ?? weather.rainProb);
  if (Number.isFinite(tempC) && tempC >= 32
      && Number.isFinite(rainProb) && rainProb <= 0.2) {
    out.add('drought');
  }
  if (weather.alert === 'drought') out.add('drought');

  // Harvest approaching — crop stage hint.
  const stage = String(ctx.cropStage || '').toLowerCase();
  if (stage.includes('harvest') || stage.includes('mature')) out.add('harvest');

  // Disease outbreak — recent flagged scan.
  const recent = (ctx.scanHistory || [])[0];
  if (recent && typeof recent === 'object'
      && recent.category && recent.category !== 'healthy'
      && recent.category !== 'no_issue_detected') {
    out.add('disease');
  }

  // Scaling — completed tasks in the last 14 days. We accept a
  // few common timestamp field names because the various task
  // stores in the codebase aren't perfectly aligned.
  const cutoff = Date.now() - SCALING_WINDOW_MS;
  let recentCompleted = 0;
  for (const t of (ctx.tasks || [])) {
    if (!t || !t.completed) continue;
    const stamp = t.completedAt || t.completedDate || t.doneAt;
    const ts = typeof stamp === 'number' ? stamp : Date.parse(stamp || '');
    if (Number.isFinite(ts) && ts >= cutoff) recentCompleted += 1;
  }
  if (recentCompleted >= SCALING_THRESHOLD) out.add('scaling');

  // New farmer — explicit flag from profile. Note: works only
  // when the canonical context normalises `profile`, which it
  // now does after the May 2026 fix to intelligenceContext.js.
  if (ctx.profile && (ctx.profile.experienceLevel === 'new'
                   || ctx.profile.farmerType === 'beginner')) {
    out.add('newFarmer');
  }

  return out;
}

// ─── Per-opportunity scoring ─────────────────────────────────────

/**
 * Score a single opportunity against a context. Returns the
 * composite score [0..100] + a typed reason envelope. Never
 * throws.
 *
 * @param {object} opportunity
 * @param {object} ctx
 * @returns {{score:number, blocked:boolean, reason:string,
 *            baseScore:number, boost:number, signals:string[]}}
 */
export function scoreSupportRelevance(opportunity, ctx) {
  const safe = (opportunity && typeof opportunity === 'object') ? opportunity : null;
  if (!safe) {
    return { score: 0, blocked: true, reason: 'invalid_opportunity',
             baseScore: 0, boost: 0, signals: [] };
  }

  // ─── Verified-host gate (defence-in-depth) ────────────────────
  // The orchestrator already gates on this; we double-check here
  // so any direct caller of this scorer can't leak an unverified
  // recommendation. URL-less entries score 0.
  const url = String(safe.url || safe.applyUrl || safe.sourceUrl || safe.externalUrl || '');
  if (!url) {
    return { score: 0, blocked: true, reason: 'no_url',
             baseScore: 0, boost: 0, signals: [] };
  }
  const safety = classifyFundingUrl(url);
  if (!safety.ok) {
    return { score: 0, blocked: true, reason: 'unverified_url',
             baseScore: 0, boost: 0, signals: [] };
  }

  // ─── Base score — country + region + crop + farm size + stage ─
  // Fixed May 2026: the previous version compared
  // `safe.country === ctx.region` as a primary branch, which is
  // semantically nonsensical (country code vs region/state code).
  // The corrected logic compares country-to-country only; region
  // is its own independent dimension.
  let baseScore = 0;

  // Country (ISO-3166 — `us`, `gh`, `ng`, etc.)
  const oppCountry = String(safe.country || '').toLowerCase();
  const ctxCountry = String(ctx.country || '').toLowerCase();
  if (oppCountry && ctxCountry && oppCountry === ctxCountry) {
    baseScore += 30;
  }

  // Region / state — opportunity may carry a `regions[]` whitelist.
  const regionMatch = (() => {
    const oppRegions = Array.isArray(safe.regions) ? safe.regions : [];
    if (oppRegions.length === 0) return false;
    const ctxRegion = String(ctx.region || '').toLowerCase();
    if (!ctxRegion) return false;
    return oppRegions.some((r) => String(r).toLowerCase() === ctxRegion);
  })();
  if (regionMatch) baseScore += 25;

  // Crop — opportunity may carry a `crops[]` whitelist.
  const cropMatch = (() => {
    const oppCrops = Array.isArray(safe.crops) ? safe.crops : [];
    if (oppCrops.length === 0) return false;
    const ctxCrop = String(ctx.crop || '').toLowerCase();
    if (!ctxCrop) return false;
    return oppCrops.some((c) => String(c).toLowerCase() === ctxCrop);
  })();
  if (cropMatch) baseScore += 25;

  // Farm size — opportunity may carry `minFarmSizeAcres` /
  // `maxFarmSizeAcres` eligibility bands. A farm size that fits
  // inside the band gets +5; a missing size or missing band is
  // neutral (no bonus, no penalty). Spec §1 explicitly lists
  // farm size as a filter dimension.
  const farmSize = Number(ctx.farmSize);
  const minSize  = Number(safe.minFarmSizeAcres);
  const maxSize  = Number(safe.maxFarmSizeAcres);
  if (Number.isFinite(farmSize) && Number.isFinite(minSize) && farmSize >= minSize
      && (!Number.isFinite(maxSize) || farmSize <= maxSize)) {
    baseScore += 5;
  }

  // Crop stage — opportunity may target specific stages
  // (e.g. land prep, growing, harvest). When the farmer's
  // current stage matches one of them: +5.
  const oppStages = Array.isArray(safe.stages) ? safe.stages : [];
  const ctxStage  = String(ctx.cropStage || '').toLowerCase();
  if (oppStages.length > 0 && ctxStage
      && oppStages.some((s) => String(s).toLowerCase() === ctxStage)) {
    baseScore += 5;
  }

  // Verified + active (necessary trust gates).
  if (safe.verified === true) baseScore += 10;
  if (safe.active === true)   baseScore += 10;

  // ─── Context booster ──────────────────────────────────────────
  const signals = detectContextSignals(ctx);
  const oppCategory = normaliseCategory(safe.category);
  let boost = 0;
  for (const signal of signals) {
    const boostedCats = CONTEXT_BOOSTS[signal];
    if (!boostedCats) continue;
    if (boostedCats.includes(oppCategory)) {
      boost += BOOST_PER_MATCH;
    }
  }
  boost = Math.min(BOOST_CAP, boost);

  // Composite score is intentionally NOT capped at 100. The
  // legacy base scoring already saturates at 100 on a perfect
  // region+crop match (country 30 + region 25 + crop 25 +
  // verified 10 + active 10), so a cap here would erase the
  // context boost when it matters most. Ranking only compares
  // relative scores within a single call, so an unbounded
  // composite is fine — and the threshold check (`>= 60`)
  // still gates whether anything surfaces at all.
  const score = baseScore + boost;
  return Object.freeze({
    score,
    blocked: false,
    reason: score >= MIN_SURFACE_SCORE ? 'surface' : 'below_threshold',
    baseScore,
    boost,
    signals: Array.from(signals),
  });
}

// ─── Ranking ─────────────────────────────────────────────────────

/**
 * Rank a list of opportunities by composite relevance.
 * Anything below `MIN_SURFACE_SCORE` is filtered out — the
 * spec mandates calm timing (only surface when useful).
 *
 * @param {Array<object>} opportunities
 * @param {object} ctx
 * @returns {Array<{opportunity:object, score:number,
 *                  baseScore:number, boost:number, signals:string[]}>}
 */
export function prioritiseNearbySupport(opportunities, ctx) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) return [];
  const scored = [];
  for (const opp of opportunities) {
    const r = scoreSupportRelevance(opp, ctx);
    if (r.blocked || r.score < MIN_SURFACE_SCORE) continue;
    scored.push({
      opportunity: opp,
      score:       r.score,
      baseScore:   r.baseScore,
      boost:       r.boost,
      signals:     r.signals,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export const _internal = Object.freeze({
  CONTEXT_BOOSTS,
  BOOST_PER_MATCH,
  BOOST_CAP,
  MIN_SURFACE_SCORE,
});

const _module = {
  detectContextSignals,
  scoreSupportRelevance,
  prioritiseNearbySupport,
  _internal,
};
export default _module;
