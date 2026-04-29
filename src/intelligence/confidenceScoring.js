/**
 * confidenceScoring.js — emits the intelligence layer's
 * confidence in its own output.
 *
 * Bands (per spec): 'low' | 'medium' | 'high'.
 *
 * The score is COMPLETENESS-driven: how much of the input contract
 * was actually filled in for this farm? Each present signal earns a
 * small positive weight; missing or 'unknown' signals earn nothing.
 *
 * No magic-number score is exposed — UI should render the band
 * label only ("Low" / "Medium" / "High"), and only when product has
 * decided to surface it. Internal callers can still read the raw
 * `points` value for telemetry.
 *
 * Strict contract
 * ───────────────
 *   Input: a flat object with the four signal results the
 *          orchestrator already collected.
 *
 *     {
 *       weatherRisk:   { level, signals } | null
 *       pestRisk:      { level, signals } | null
 *       stageInfo:     { stage, source }  | null
 *       yieldInfo:     { kg, band }       | null
 *       satellite:     { ndvi, ..., confidence } | null
 *     }
 *
 *   Output: { level: 'low'|'medium'|'high', points: number, missing: string[] }.
 *
 * Pure, never throws.
 */

const WEIGHTS = Object.freeze({
  weatherRisk:  2,   // explicit 'low'/'medium'/'high' from real data
  pestRisk:     2,   // implicit but high-impact
  stageInfo:    3,   // declared > estimate; declared = full credit
  yieldInfo:    2,   // computed band
  satellite:    1,   // mock today; real provider lifts this to 2 later
});

// Maximum points if every slot is fully credited. Stays in sync with
// WEIGHTS so a future weight tweak doesn't desync the bands.
const MAX_POINTS = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

const HIGH_CUTOFF   = 0.75;   // ≥ 75% of max → high
const MEDIUM_CUTOFF = 0.40;   // ≥ 40% of max → medium

/**
 * @param {object} signals
 * @returns {{ level: 'low'|'medium'|'high', points: number, missing: string[] }}
 */
export function scoreConfidence(signals = {}) {
  try {
    let points = 0;
    const missing = [];

    // ─── weatherRisk ────────────────────────────────────────
    if (_isReal(signals.weatherRisk?.level)) {
      points += WEIGHTS.weatherRisk;
    } else {
      missing.push('weatherRisk');
    }

    // ─── pestRisk ───────────────────────────────────────────
    if (_isReal(signals.pestRisk?.level)) {
      points += WEIGHTS.pestRisk;
    } else {
      missing.push('pestRisk');
    }

    // ─── stageInfo ──────────────────────────────────────────
    // Declared by the farmer = full credit; estimated from
    // plantingDate = half credit (we believe the model less than
    // we believe the farmer).
    const stageSource = signals.stageInfo?.source;
    if (stageSource === 'declared') {
      points += WEIGHTS.stageInfo;
    } else if (stageSource === 'estimate') {
      points += WEIGHTS.stageInfo / 2;
    } else {
      missing.push('stageInfo');
    }

    // ─── yieldInfo ──────────────────────────────────────────
    if (signals.yieldInfo && Number.isFinite(signals.yieldInfo.kg) && signals.yieldInfo.kg > 0) {
      points += WEIGHTS.yieldInfo;
    } else {
      missing.push('yieldInfo');
    }

    // ─── satellite ──────────────────────────────────────────
    // Source 'mock' → half credit (we know it's synthetic). Real
    // providers earn full credit.
    const satSource = signals.satellite?.source;
    if (satSource && satSource !== 'mock') {
      points += WEIGHTS.satellite;
    } else if (satSource === 'mock') {
      points += WEIGHTS.satellite / 2;
    } else {
      missing.push('satellite');
    }

    const ratio = MAX_POINTS > 0 ? points / MAX_POINTS : 0;
    const level = ratio >= HIGH_CUTOFF   ? 'high'
                : ratio >= MEDIUM_CUTOFF ? 'medium'
                :                          'low';

    return Object.freeze({ level, points, missing: Object.freeze(missing) });
  } catch {
    return Object.freeze({ level: 'low', points: 0, missing: ['error'] });
  }
}

function _isReal(level) {
  return level === 'low' || level === 'medium' || level === 'high';
}

export { WEIGHTS, MAX_POINTS };
