/**
 * pestDiseaseRisk.js — derives a pest-pressure band from
 * crop / stage / weather signals.
 *
 * The model is deliberately heuristic — Farroway is not the right
 * place for a peer-reviewed agronomic engine, but a small rule
 * set covers the common cases that drive farmer-visible alerts:
 *
 *   • Standing rain + flowering / fruiting → fungal pressure
 *   • Hot + dry → mite / aphid pressure
 *   • Vegetative + recent rain → weed surge
 *
 * Input
 *   { crop, stage, weatherRisk }
 *     crop         string (canonical id; aliases tolerated)
 *     stage        string (cropStage, e.g. 'flowering')
 *     weatherRisk  result of deriveWeatherRisk(weather) — used so
 *                   we don't double-walk the weather payload
 *
 * Output
 *   { level: 'low'|'medium'|'high'|'unknown', signals: string[] }
 *
 * Strict rules: pure function, never throws, no I/O. Bands map to
 * the same translation keys as the rest of the farmer-facing UI.
 */

import { WEATHER_LEVELS } from './weatherRiskModel.js';

// Crops with known fungal sensitivity at flowering / fruiting under
// wet conditions. Conservative list — extend per pilot data.
const FUNGAL_SENSITIVE = new Set([
  'tomato', 'potato', 'pepper', 'cassava',
  'maize', 'corn', 'rice',
]);

// Crops with known mite / aphid pressure under hot-dry stress.
const HOT_DRY_SENSITIVE = new Set([
  'cotton', 'soybean', 'bean', 'beans', 'cowpea',
  'tomato', 'pepper',
]);

const ATTACK_STAGES = new Set([
  'flowering', 'fruiting', 'vegetative',
]);

export const PEST_LEVELS = WEATHER_LEVELS; // same band vocabulary

/**
 * @param {object} input
 * @returns {{ level: string, signals: string[] }}
 */
export function derivePestRisk({ crop, stage, weatherRisk } = {}) {
  try {
    const c = _norm(crop);
    const s = _norm(stage);
    const wr = weatherRisk && typeof weatherRisk === 'object'
      ? weatherRisk
      : { level: 'unknown', signals: [] };
    const weatherSignals = Array.isArray(wr.signals) ? wr.signals : [];

    if (!c || !s) {
      return _result('unknown', []);
    }

    const tags = [];

    // Rule 1 — wet + flowering/fruiting + fungal-sensitive crop
    const wet = weatherSignals.includes('heavy_rain')
             || weatherSignals.includes('moderate_rain');
    if (wet && (s === 'flowering' || s === 'fruiting') && FUNGAL_SENSITIVE.has(c)) {
      tags.push('fungal_pressure');
    }

    // Rule 2 — hot-dry stress on vegetative/flowering for hot-dry-
    // sensitive crops.
    const hotDry = weatherSignals.includes('hot')
                && (weatherSignals.includes('dry_spell')
                    || wr.level === 'high');
    if (hotDry && ATTACK_STAGES.has(s) && HOT_DRY_SENSITIVE.has(c)) {
      tags.push('mite_aphid_pressure');
    }

    // Rule 3 — recent rain + vegetative → weed surge for any crop.
    if (wet && s === 'vegetative') {
      tags.push('weed_surge');
    }

    // Rule 4 — generic stage-based scouting nudge: late-vegetative
    // through fruiting is when scouting catches the most issues.
    if (ATTACK_STAGES.has(s) && tags.length === 0) {
      tags.push('routine_scout');
    }

    if (tags.length === 0) return _result('low', []);

    // Severity mapping:
    //   fungal_pressure / mite_aphid_pressure → high
    //   weed_surge                           → medium
    //   routine_scout (only)                 → low
    const high = tags.includes('fungal_pressure') || tags.includes('mite_aphid_pressure');
    const onlyRoutine = tags.length === 1 && tags[0] === 'routine_scout';
    const level = onlyRoutine ? 'low' : (high ? 'high' : 'medium');
    return _result(level, _dedupe(tags));
  } catch {
    return _result('unknown', []);
  }
}

function _norm(v) {
  if (!v) return '';
  return String(v).trim().toLowerCase();
}
function _dedupe(a) { return Array.from(new Set(a)); }
function _result(level, signals) {
  return Object.freeze({ level, signals: Object.freeze(signals.slice()) });
}
