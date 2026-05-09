/**
 * season.js — SeasonalEnvironmentSelector.
 *
 * Maps month + hemisphere to a coarse season label used by the
 * scene resolver. Not used for agronomy decisions (those run off
 * the much-richer plantingCalendar.js); only used to nudge the
 * scene picker toward a season-appropriate variant when one
 * exists.
 *
 *   import { resolveSeason } from './season.js';
 *   resolveSeason({ month: 1, hemisphere: 'north' }) === 'winter';
 *   resolveSeason({ month: 1, hemisphere: 'south' }) === 'summer';
 *
 * Strict-rule audit
 *   • Pure. Never throws.
 *   • Bad month → 'spring' (the most neutral fallback).
 */

const SEASONS = Object.freeze(['spring','summer','autumn','winter']);

export function resolveSeason({ month, hemisphere = 'north' } = {}) {
  const m = Number(month);
  if (!Number.isFinite(m) || m < 1 || m > 12) return 'spring';
  const idx = Math.floor(m) - 1; // 0-11
  // Northern reference table — Mar-May spring, Jun-Aug summer, etc.
  // Southern flips by 6 months.
  const northTable = [
    'winter','winter','spring','spring','spring','summer',
    'summer','summer','autumn','autumn','autumn','winter',
  ];
  const south = hemisphere === 'south';
  const out = north => south
    ? (north === 'spring' ? 'autumn'
       : north === 'autumn' ? 'spring'
       : north === 'summer' ? 'winter'
       : 'summer')
    : north;
  return out(northTable[idx]);
}

export const SEASON_LIST = SEASONS;
