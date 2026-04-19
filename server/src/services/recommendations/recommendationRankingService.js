/**
 * recommendationRankingService.js — turns the raw feedback
 * history (from recommendationFeedbackService) into something a
 * product manager can act on:
 *
 *   • rankCropsByFeedback(history, country)
 *       → [ { crop, score, n, direction }, ... ] sorted desc
 *
 *   • getTopPerformers(history, country, n=5)
 *       → crops with the strongest positive feedback
 *
 *   • getUnderPerformers(history, country, n=5)
 *       → crops users rejected / harvested badly
 *
 *   • getContestedCrops(history, country)
 *       → crops with high sample count but near-zero score
 *         (meaning: users disagree strongly — worth investigating)
 *
 *   • summarizeCountryPerformance(history, country)
 *       → one-line health summary per country
 *
 * These are NOT recommendation engine internals — they're reports
 * for dashboards. The feedback history is the single source of
 * truth; everything here is a pure read.
 */

const CONTESTED_SAMPLE_THRESHOLD = 3;     // need >= 3 samples to call it contested
const CONTESTED_SCORE_BAND       = 0.15;  // |score| < 0.15 means no clear direction

function entriesForCountry(history, country) {
  if (!history || typeof history !== 'object') return [];
  const prefix = String(country || '').toLowerCase() + ':';
  return Object.entries(history)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({
      crop: k.slice(prefix.length),
      score: Number(v?.score) || 0,
      n: Number(v?.n) || 0,
      reasons: Array.isArray(v?.reasons) ? v.reasons : [],
    }));
}

function directionOf(score) {
  if (score >= 0.15)  return 'positive';
  if (score <= -0.15) return 'negative';
  return 'neutral';
}

export function rankCropsByFeedback(history = {}, country = null) {
  return entriesForCountry(history, country)
    .map((e) => ({ ...e, direction: directionOf(e.score) }))
    .sort((a, b) => b.score - a.score || b.n - a.n);
}

export function getTopPerformers(history = {}, country = null, limit = 5) {
  return rankCropsByFeedback(history, country)
    .filter((e) => e.direction === 'positive')
    .slice(0, limit);
}

export function getUnderPerformers(history = {}, country = null, limit = 5) {
  return rankCropsByFeedback(history, country)
    .filter((e) => e.direction === 'negative')
    .sort((a, b) => a.score - b.score || b.n - a.n)
    .slice(0, limit);
}

/**
 * getContestedCrops — high sample count, near-zero score.
 * Users have feedback but it doesn't consistently agree. These
 * are the crops most likely to need product attention.
 */
export function getContestedCrops(history = {}, country = null, limit = 5) {
  return rankCropsByFeedback(history, country)
    .filter((e) => e.n >= CONTESTED_SAMPLE_THRESHOLD && Math.abs(e.score) < CONTESTED_SCORE_BAND)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

/**
 * summarizeCountryPerformance — one-line health report for a
 * country. Returns:
 *   {
 *     country,
 *     totalCrops,
 *     winners: [crop names...],
 *     losers:  [crop names...],
 *     contested: [crop names...],
 *     averageScore,
 *     netDirection: 'positive' | 'negative' | 'neutral',
 *   }
 */
export function summarizeCountryPerformance(history = {}, country = null, { topN = 3 } = {}) {
  const entries = entriesForCountry(history, country);
  if (!entries.length) {
    return {
      country: country || null,
      totalCrops: 0,
      winners: [], losers: [], contested: [],
      averageScore: null,
      netDirection: 'neutral',
    };
  }
  const winners   = getTopPerformers  (history, country, topN).map((e) => e.crop);
  const losers    = getUnderPerformers(history, country, topN).map((e) => e.crop);
  const contested = getContestedCrops (history, country, topN).map((e) => e.crop);
  const weightedSum = entries.reduce((s, e) => s + e.score * e.n, 0);
  const totalN      = entries.reduce((s, e) => s + e.n, 0);
  const averageScore = totalN > 0 ? +(weightedSum / totalN).toFixed(4) : 0;
  return {
    country: country || null,
    totalCrops: entries.length,
    winners, losers, contested,
    averageScore,
    netDirection: directionOf(averageScore),
  };
}

/**
 * rankCountriesByFeedbackHealth — used for multi-country dashboards.
 * Returns a sorted array of `{ country, averageScore, totalCrops }`
 * so the team can see which regions are happiest with recs.
 */
export function rankCountriesByFeedbackHealth(history = {}) {
  if (!history || typeof history !== 'object') return [];
  const byCountry = new Map();
  for (const [key, val] of Object.entries(history)) {
    const country = String(key.split(':')[0] || '').toLowerCase();
    if (!country) continue;
    const v = { score: Number(val?.score) || 0, n: Number(val?.n) || 0 };
    const bucket = byCountry.get(country) || { weightedSum: 0, totalN: 0, totalCrops: 0 };
    bucket.weightedSum += v.score * v.n;
    bucket.totalN      += v.n;
    bucket.totalCrops  += 1;
    byCountry.set(country, bucket);
  }
  return [...byCountry.entries()]
    .map(([country, b]) => ({
      country,
      averageScore: b.totalN > 0 ? +(b.weightedSum / b.totalN).toFixed(4) : 0,
      totalCrops: b.totalCrops,
      totalSamples: b.totalN,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}

export const _internal = {
  CONTESTED_SAMPLE_THRESHOLD,
  CONTESTED_SCORE_BAND,
  directionOf,
};
