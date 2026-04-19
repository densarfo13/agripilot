/**
 * filterRecommendations.js — shapes the raw recommendation
 * output into the three display sections the Recommendations
 * screen needs:
 *
 *   bestForYou:      top 3-5 crops (high fit)
 *   alsoPossible:    next tier (medium fit)
 *   notRecommended:  low fit, collapsed by default
 *
 * The input is caller-supplied — this module doesn't know
 * whether scores came from the existing engine, the bias
 * adapter, or the cropRecommendations helper. Keeps the
 * screen testable without mocking the engine.
 *
 * Mode affects only the pool size:
 *   backyard → cap bestForYou at 3, alsoPossible at 3
 *   farm     → cap bestForYou at 5, alsoPossible at 6
 */

const BACKYARD_BEST_N = 3;
const BACKYARD_ALSO_N = 3;
const FARM_BEST_N     = 5;
const FARM_ALSO_N     = 6;

const BEST_THRESHOLD = 0.6;
const ALSO_THRESHOLD = 0.3;

/**
 * @param {object[]} crops — [{ crop, score, beginnerFriendly?, reasons?, fit?, supportDepth? }]
 * @param {object}   opts
 * @param {'backyard'|'farm'} [opts.mode='farm']
 * @param {boolean} [opts.experienced]
 */
export function filterRecommendations(crops = [], opts = {}) {
  const mode = opts.mode === 'backyard' ? 'backyard' : 'farm';
  const bestCap = mode === 'backyard' ? BACKYARD_BEST_N : FARM_BEST_N;
  const alsoCap = mode === 'backyard' ? BACKYARD_ALSO_N : FARM_ALSO_N;

  const all = (Array.isArray(crops) ? crops : [])
    .filter((c) => c && c.crop != null)
    .map((c) => ({
      ...c,
      score: clampScore(c.score),
      beginnerFriendly: !!c.beginnerFriendly,
      reasons: Array.isArray(c.reasons) ? c.reasons.slice(0, 2) : [],
    }))
    .sort((a, b) => b.score - a.score);

  // Sometimes we want to push beginner-friendly crops up the list
  // when the user said they're new, so they see approachable
  // options first even if the raw score is tied.
  if (opts.experienced === false) {
    all.sort((a, b) => (b.score + (b.beginnerFriendly ? 0.05 : 0))
                      - (a.score + (a.beginnerFriendly ? 0.05 : 0)));
  }

  const bestForYou     = all.filter((c) => c.score >= BEST_THRESHOLD).slice(0, bestCap);
  const takenCrops     = new Set(bestForYou.map((c) => c.crop));
  const alsoPossible   = all
    .filter((c) => !takenCrops.has(c.crop)
                && c.score >= ALSO_THRESHOLD
                && c.score <  BEST_THRESHOLD)
    .slice(0, alsoCap);
  const notRecommended = all
    .filter((c) => !takenCrops.has(c.crop)
                && !alsoPossible.some((x) => x.crop === c.crop)
                && c.score <  ALSO_THRESHOLD);

  return {
    bestForYou,
    alsoPossible,
    notRecommended,
    mode,
    totals: {
      best: bestForYou.length,
      also: alsoPossible.length,
      not:  notRecommended.length,
      all:  all.length,
    },
  };
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const _internal = {
  BACKYARD_BEST_N, BACKYARD_ALSO_N, FARM_BEST_N, FARM_ALSO_N,
  BEST_THRESHOLD, ALSO_THRESHOLD,
};
