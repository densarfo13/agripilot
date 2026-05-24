/**
 * seasonalCropRecommendations.js — Smart Planting Intelligence
 * (Phase 4). Returns the ranked candidates for "what should I
 * plant now in this region?".
 *
 *   import { recommendCropsForSeason }
 *     from 'src/core/planning/seasonalCropRecommendations.js';
 *
 *   const recs = recommendCropsForSeason({
 *     country: 'Ghana', mode: 'farmer', nowMs: Date.now(),
 *   });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composition layer over the existing
 *   `plantingWindowEngine` (which knows region × crop × month) +
 *   `cropDurationRegistry` (which knows how long each crop takes)
 *   + `growSetupGuidance` (which knows sunlight + setting fit).
 *   It does NOT add new agronomy facts. It re-orders the
 *   already-known crops by "is this a good fit RIGHT NOW?".
 *
 *   Tags returned per candidate:
 *     • inWindow      — we're in the recommended planting window
 *     • justBefore    — the window opens within ~30 days
 *     • fastHarvest   — <= 80 days to harvest
 *     • slowHarvest   — > 365 days (tree crops)
 *     • container_ok  — works in container / pot / balcony
 *     • field_only    — needs a field
 *
 *   Honest defaults: when no (country, crop) pair has data we
 *   return `{ ok: false, reason: 'no_data' }` — we never guess.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { getPlantingWindow, PLANTING_REGIONS } from '../lifecycle/plantingWindowEngine.js';
import { getDurationDays, KNOWN_CROPS } from '../lifecycle/cropDurationRegistry.js';
import { getGrowSetupGuidance } from '../grow/growSetupGuidance.js';

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const DAY_MS = 24 * 60 * 60 * 1000;

const SCORE = Object.freeze({
  IN_WINDOW:    50,
  JUST_BEFORE:  25,  // window opens within ~30 days
  FAST_HARVEST: 10,
  CONTAINER:    8,
  HEALTHY_FIT:  5,
});

function _monthsUntilWindow(currentMonth, startMonth, endMonth) {
  // Returns 0 when we're inside the window, else the number of
  // months until the window opens (wrap-aware).
  if (startMonth <= endMonth) {
    if (currentMonth >= startMonth && currentMonth <= endMonth) return 0;
    if (currentMonth < startMonth) return startMonth - currentMonth;
    return (12 - currentMonth) + startMonth;
  }
  // Wrapping window (e.g. Nov–Feb).
  if (currentMonth >= startMonth || currentMonth <= endMonth) return 0;
  return startMonth - currentMonth;
}

function _scoreCrop({ country, crop, mode, setting, nowMs }) {
  const tags = [];
  let score = 0;

  // Planting window — biggest signal.
  const w = getPlantingWindow({ country, crop, nowMs });
  if (!w || !w.ok) return null;
  const monthsUntil = _monthsUntilWindow(w.currentMonth, w.startMonth, w.endMonth);
  if (monthsUntil === 0) {
    score += SCORE.IN_WINDOW;
    tags.push('inWindow');
  } else if (monthsUntil === 1) {
    score += SCORE.JUST_BEFORE;
    tags.push('justBefore');
  }

  // Duration — short-cycle crops surface earlier for impatient
  // beginners; long tree crops get a slow_harvest tag.
  const dur = getDurationDays(crop, { setting });
  if (dur) {
    if (dur.max <= 80)  { score += SCORE.FAST_HARVEST; tags.push('fastHarvest'); }
    if (dur.min >= 365) { tags.push('slowHarvest'); }
  }

  // Setup fit — gardener mode + a container-friendly crop scores.
  const setup = getGrowSetupGuidance(crop);
  const isGardener = _str(mode) === 'gardener';
  if (setup) {
    const containerOk = setup.settings.some((s) => /container|pot|balcony|raised_bed|indoor/.test(s));
    if (containerOk) tags.push('container_ok');
    if (!containerOk) tags.push('field_only');
    if (isGardener && containerOk) score += SCORE.CONTAINER;
    if (setup.sunlight === 'full_sun' || setup.sunlight === 'part_sun') {
      score += SCORE.HEALTHY_FIT;
    }
  }

  return {
    crop:        w.cropKey,
    score,
    inWindow:    monthsUntil === 0,
    monthsUntilWindow: monthsUntil,
    durationDays: dur ? { min: dur.min, max: dur.max } : null,
    sunlight:    setup ? setup.sunlight : null,
    settings:    setup ? setup.settings.slice() : [],
    tags,
    why: { key: 'planning.why.window', fallback: w.why ? w.why.fallback : '' },
  };
}

/**
 * Rank the crops we have data for, given a region + the user's
 * mode + (optional) setting.
 *
 * @param {object} args
 * @param {string} args.country
 * @param {string} [args.mode]      'farmer' | 'gardener'
 * @param {string} [args.setting]   'field' | 'container' | …
 * @param {number} [args.nowMs]
 * @returns {{ ok, recommended, easyFirst, fastHarvest, allCandidates } | { ok:false, reason }}
 */
export function recommendCropsForSeason(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const country = a.country;
    if (!country) return { ok: false, reason: 'no_country' };
    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();

    const candidates = [];
    for (const crop of KNOWN_CROPS) {
      const scored = _scoreCrop({
        country, crop,
        mode: a.mode, setting: a.setting, nowMs,
      });
      if (scored) candidates.push(scored);
    }

    if (candidates.length === 0) {
      return { ok: false, reason: 'no_data', country };
    }

    // Sort by score desc, then by faster harvest first (more
    // satisfying for new growers), then alphabetically for
    // stability.
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = a.durationDays ? a.durationDays.min : 9999;
      const bd = b.durationDays ? b.durationDays.min : 9999;
      if (ad !== bd) return ad - bd;
      return a.crop.localeCompare(b.crop);
    });

    const inWindow = candidates.filter((c) => c.inWindow);
    const fastHarvest = candidates
      .filter((c) => c.tags.includes('fastHarvest'))
      .slice(0, 5);
    const easyFirst = candidates
      .filter((c) => c.tags.includes('container_ok')
        || (c.durationDays && c.durationDays.max <= 90))
      .slice(0, 5);

    return Object.freeze({
      ok:             true,
      country,
      recommended:    inWindow.slice(0, 5),   // primary list — in-window crops
      easyFirst,
      fastHarvest,
      allCandidates:  candidates,
      isEstimate:     true,
      disclaimer:     'Recommendations are guidance — local microclimate, soil, and variety may shift them.',
    });
  } catch {
    return { ok: false, reason: 'exception' };
  }
}

export const SUPPORTED_PLANTING_REGIONS = PLANTING_REGIONS;

const _module = { recommendCropsForSeason, SUPPORTED_PLANTING_REGIONS };
export default _module;
