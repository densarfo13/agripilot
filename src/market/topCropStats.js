/**
 * topCropStats.js — derives the "top-selling crops" signal for the
 * marketplace from local listings + interests history.
 *
 * Spec coverage (Marketplace revenue scale §1)
 *   • Identify top-selling crop → prioritize listings
 *
 *   getTopCrops({ windowDays?, limit? }) → Array<{
 *     crop:          string,
 *     soldCount:     number,    // listings transitioned to SOLD
 *     interestCount: number,    // recent interest activity
 *     score:         number,    // soldCount*5 + interestCount
 *   }>
 *
 * Strict-rule audit
 *   • Pure read — never writes localStorage.
 *   • Reads `farroway_market_listings` + `farroway_buyer_interests`
 *     directly (decoupled from marketStore to avoid import cycles
 *     with listingPriority).
 *   • Never throws.
 *   • Conservative window (default 90 days) keeps the signal
 *     responsive without being noisy.
 */

const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 5;

function _safeReadJsonArray(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _norm(s) { return String(s || '').trim().toLowerCase(); }

function _within(iso, cutoffMs) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return true;       // unknown timestamps count
  return t >= cutoffMs;
}

/**
 * @param {object} [opts]
 * @param {number} [opts.windowDays]
 * @param {number} [opts.limit]
 * @param {number} [opts.now]
 */
export function getTopCrops({
  windowDays = DEFAULT_WINDOW_DAYS,
  limit      = DEFAULT_LIMIT,
  now        = Date.now(),
} = {}) {
  const cutoff = now - windowDays * 86_400_000;

  const soldByCrop     = new Map();
  const interestByCrop = new Map();

  // Listings — SOLD + STATUS-based + interest-driven counts.
  const listings = _safeReadJsonArray('farroway_market_listings');
  for (const l of listings) {
    if (!l || !l.crop) continue;
    if (!_within(l.updatedAt || l.createdAt, cutoff)) continue;
    if (String(l.status || '').toUpperCase() !== 'SOLD') continue;
    const c = _norm(l.crop);
    soldByCrop.set(c, (soldByCrop.get(c) || 0) + 1);
  }

  // Interests — count of recent buyer activity per crop.
  const interests = _safeReadJsonArray('farroway_buyer_interests');
  for (const i of interests) {
    if (!i) continue;
    if (!_within(i.createdAt, cutoff)) continue;
    const c = _norm(i.crop);
    if (!c) continue;
    interestByCrop.set(c, (interestByCrop.get(c) || 0) + 1);
  }

  const all = new Set([...soldByCrop.keys(), ...interestByCrop.keys()]);
  const rows = [];
  for (const c of all) {
    const s = soldByCrop.get(c)     || 0;
    const i = interestByCrop.get(c) || 0;
    rows.push({
      crop:          c,
      soldCount:     s,
      interestCount: i,
      // Sold transactions weigh 5× as much as raw interest so a
      // crop with one closed deal still beats a crop with five
      // unconverted clicks. Tunable per pilot.
      score:         (s * 5) + i,
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, Math.max(0, Number(limit) || DEFAULT_LIMIT));
}

/** Convenience: just the crop names of the top sellers. */
export function getTopCropNames(opts) {
  return getTopCrops(opts).map((r) => r.crop);
}

export const _internal = Object.freeze({
  DEFAULT_WINDOW_DAYS,
  DEFAULT_LIMIT,
});

export default { getTopCrops, getTopCropNames };
