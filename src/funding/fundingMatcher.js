/**
 * fundingMatcher.js — pure scoring engine for the v3
 * Funding Opportunities Layer.
 *
 *   matchFundingForFarm(farm, opportunities) → Array<Match>
 *
 * Match shape (per spec § 4):
 *   {
 *     opportunity: <FundingOpportunity>,
 *     score:       <0..100 integer>,
 *     reasons:     ["Matches your region", "Supports your crop", …],
 *   }
 *
 * Scoring (per spec § 4)
 *   country match           +30
 *   region match            +25
 *   crop match              +25
 *   farm-size eligibility   +10
 *   active && verified      +10
 *   threshold to surface    >= 50
 *
 * Trust + compliance (per spec § 13)
 *   * Reasons strings stay conservative — "Matches your
 *     region", "Supports your crop", "Currently active".
 *     Never "You qualify".
 *   * The matcher does NOT guarantee eligibility — it is a
 *     surfacing heuristic. The farmer-facing page is
 *     responsible for "May qualify" wording + the
 *     "Check requirements before applying" reminder.
 *
 * Strict-rule audit
 *   * Pure JS — no I/O, no React, no module-level state.
 *   * Defensive — missing farm fields don't throw; missing
 *     opportunity fields don't throw. Returns [] for any
 *     genuinely invalid input.
 *   * Deterministic — same inputs → same outputs (no
 *     Date.now in the hot path).
 */

const SCORE = Object.freeze({
  COUNTRY:  30,
  REGION:   25,
  CROP:     25,
  SIZE:     10,
  TRUSTED:  10,
});
export const MATCH_THRESHOLD = 50;

function _norm(s) {
  if (s === null || s === undefined) return '';
  return String(s).trim().toLowerCase();
}

function _safeArr(x) { return Array.isArray(x) ? x : []; }

/**
 * Resolve the farm's geo + crop + size shape into a flat
 * "candidate" object the scorer compares against. Tolerant
 * of every shape we've seen in the codebase (legacy
 * profile, v2 farm, GPS-only, manual region).
 */
export function _farmCandidate(farm) {
  if (!farm || typeof farm !== 'object') {
    return {
      country: '', region: '', crops: [], size: null,
    };
  }
  const country =
       farm.country
    || farm.countryCode
    || (farm.location && (farm.location.country || farm.location.countryCode))
    || '';
  const region =
       farm.region
    || (farm.location && farm.location.region)
    || farm.state
    || '';
  // A farm may carry a single `crop` / `cropType` or an
  // array of crops (multi-cycle farms). Accept either.
  const cropList = [];
  const single = farm.crop || farm.cropType || farm.primaryCrop;
  if (single) cropList.push(single);
  if (Array.isArray(farm.crops)) cropList.push(...farm.crops);
  if (Array.isArray(farm.cropTypes)) cropList.push(...farm.cropTypes);
  const size =
       Number.isFinite(Number(farm.sizeHectares))
         ? Number(farm.sizeHectares)
    : Number.isFinite(Number(farm.size))
         ? Number(farm.size)
    : Number.isFinite(Number(farm.farmSize))
         ? Number(farm.farmSize)
    : null;

  return {
    country: _norm(country),
    region:  _norm(region),
    crops:   cropList.map(_norm).filter(Boolean),
    size,
  };
}

/**
 * Score a single opportunity against a farm candidate.
 * Returns { score, reasons } — never throws.
 */
function _scoreOne(cand, opp) {
  if (!opp || typeof opp !== 'object') return { score: 0, reasons: [] };

  let score   = 0;
  const reasons = [];

  // Country match: '*' or empty = matches any country.
  // Otherwise require equality (case-insensitive).
  const oppCountry = _norm(opp.country);
  if (!oppCountry || oppCountry === '*') {
    score += SCORE.COUNTRY;
    reasons.push('Available in your country');
  } else if (cand.country && oppCountry === cand.country) {
    score += SCORE.COUNTRY;
    reasons.push('Matches your country');
  }

  // Region match — empty regions[] = open to all.
  const oppRegions = _safeArr(opp.regions).map(_norm);
  if (oppRegions.length === 0) {
    score += SCORE.REGION;
    reasons.push('Open to all regions');
  } else if (cand.region && oppRegions.includes(cand.region)) {
    score += SCORE.REGION;
    reasons.push('Matches your region');
  }

  // Crop match — empty crops[] = open to all.
  const oppCrops = _safeArr(opp.crops).map(_norm);
  if (oppCrops.length === 0) {
    score += SCORE.CROP;
    reasons.push('Open to any crop');
  } else if (cand.crops.length
             && cand.crops.some((c) => oppCrops.includes(c))) {
    score += SCORE.CROP;
    reasons.push('Supports your crop');
  }

  // Farm-size eligibility. Awarded ONLY when we have a
  // farm size AND it falls in the [min, max] range. If
  // either bound is missing on the opportunity, we treat
  // that side as unbounded.
  if (cand.size !== null) {
    const minS = Number.isFinite(Number(opp.minFarmSize))
                   ? Number(opp.minFarmSize) : 0;
    const maxS = Number.isFinite(Number(opp.maxFarmSize))
                   ? Number(opp.maxFarmSize) : Infinity;
    if (cand.size >= minS && cand.size <= maxS) {
      score += SCORE.SIZE;
      reasons.push('Within eligible farm size');
    }
  }

  // Trust bonus — active AND verified.
  if (opp.active === true && opp.verified === true) {
    score += SCORE.TRUSTED;
    reasons.push('Currently active');
  }

  return { score, reasons };
}

/**
 * Public entry point. Returns matches whose score
 * meets MATCH_THRESHOLD, sorted by score desc + then by
 * deadline (sooner first).
 */
export function matchFundingForFarm(farm, opportunities) {
  const list = _safeArr(opportunities);
  if (!list.length) return [];

  const cand = _farmCandidate(farm);

  const out = [];
  for (const opp of list) {
    if (!opp || !opp.id) continue;
    // Hard exclusion before scoring: never surface
    // inactive / unverified entries to a farmer.
    if (opp.active !== true)   continue;
    if (opp.verified !== true) continue;

    const { score, reasons } = _scoreOne(cand, opp);
    if (score >= MATCH_THRESHOLD) {
      out.push({ opportunity: opp, score, reasons });
    }
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // tie-break by deadline (sooner first; null = last)
    const da = a.opportunity.deadline ? Date.parse(a.opportunity.deadline) : Infinity;
    const db = b.opportunity.deadline ? Date.parse(b.opportunity.deadline) : Infinity;
    return da - db;
  });

  return out;
}

export const __test__ = { _farmCandidate, _scoreOne };
