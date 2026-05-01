/**
 * marketDemand.js — derive demand signals from the existing
 * buyer-interest store.
 *
 * Source of truth
 *   `getBuyerInterests()` in `src/market/marketStore.js` already
 *   logs every buyer interest to localStorage. This module is a
 *   read-only aggregator on top of that — no new keys, no fork.
 *
 * Public API
 *   getDemandForCrop({ crop, country?, region? }) → {
 *     count:  number,                    // raw interests in the last 30 days
 *     level:  'high' | 'medium' | 'low', // bucketed signal
 *     scope:  'crop+region' | 'crop+country' | 'crop' | 'none',
 *   }
 *
 *   getNearbyBuyersCount({ crop, region, country }) → number
 *
 * Strict-rule audit
 *   • Pure read — never writes localStorage.
 *   • Never throws.
 *   • Time-bounded to 30 days so a stale buyer-interest record
 *     does not inflate "demand" forever.
 *   • Region match is case-insensitive + fuzzy (substring) so the
 *     human-typed "GH"/"Greater Accra"/"Accra" all resolve to a
 *     plausible match.
 */

import { getBuyerInterests } from './marketStore.js';

const WINDOW_MS = 30 * 86_400_000;          // 30 days

function _norm(s) {
  return String(s || '').trim().toLowerCase();
}

function _isWithinWindow(entry, now) {
  const t = Date.parse(entry?.createdAt || entry?.timestamp || '');
  if (!Number.isFinite(t)) return true;     // unknown timestamps count
  return (now - t) <= WINDOW_MS;
}

function _matchCrop(entry, crop) {
  const c = _norm(entry?.crop);
  return c && c === _norm(crop);
}

function _matchRegion(entry, region) {
  if (!region) return true;
  const want = _norm(region);
  const have = _norm(entry?.region || entry?.location?.region || '');
  if (!have) return false;
  return have === want || have.includes(want) || want.includes(have);
}

function _matchCountry(entry, country) {
  if (!country) return true;
  const want = _norm(country);
  const have = _norm(entry?.country || entry?.location?.country || '');
  if (!have) return false;
  return have === want;
}

function _bucket(count) {
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

/**
 * Demand signal for the given crop. Falls back from
 * `crop+region` → `crop+country` → `crop` so the count never
 * looks artificially zero when only the region is missing.
 */
export function getDemandForCrop({ crop, country, region } = {}) {
  if (!crop) {
    return { count: 0, level: 'low', scope: 'none' };
  }
  let interests = [];
  try { interests = getBuyerInterests() || []; } catch { interests = []; }
  if (!Array.isArray(interests) || interests.length === 0) {
    return { count: 0, level: 'low', scope: 'none' };
  }
  const now = Date.now();
  const fresh = interests.filter((e) => _isWithinWindow(e, now));

  // Try crop+region first (tightest signal).
  if (region) {
    const tight = fresh.filter((e) => _matchCrop(e, crop) && _matchRegion(e, region));
    if (tight.length > 0) {
      return { count: tight.length, level: _bucket(tight.length), scope: 'crop+region' };
    }
  }
  // Fall back to crop+country.
  if (country) {
    const mid = fresh.filter((e) => _matchCrop(e, crop) && _matchCountry(e, country));
    if (mid.length > 0) {
      return { count: mid.length, level: _bucket(mid.length), scope: 'crop+country' };
    }
  }
  // Fall back to crop only.
  const wide = fresh.filter((e) => _matchCrop(e, crop));
  return { count: wide.length, level: _bucket(wide.length), scope: 'crop' };
}

/**
 * Nearby buyers — same lookup, returned as a plain integer for
 * the "X buyers are looking for this crop" headline.
 */
export function getNearbyBuyersCount({ crop, region, country } = {}) {
  const d = getDemandForCrop({ crop, region, country });
  return d.count || 0;
}

export default { getDemandForCrop, getNearbyBuyersCount };
