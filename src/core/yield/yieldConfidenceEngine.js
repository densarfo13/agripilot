/**
 * yieldConfidenceEngine.js — picks a HONEST confidence band for
 * a yield estimate based on how thin the input signals are.
 *
 *   import { confidenceBandFor, CONFIDENCE_BAND }
 *     from 'src/core/yield/yieldConfidenceEngine.js';
 *
 *   const b = confidenceBandFor({
 *     hasPlantCount: true, hasPlantingDate: true,
 *     hasScanHistory: true, taskCompletionRate: 0.8,
 *     daysSincePlanting: 60,
 *   });
 *   // b.band       → 'low' | 'medium' (NEVER 'high')
 *   // b.signals    → [{ key, fallback }] (what raised/lowered confidence)
 *   // b.bandReason → { key, fallback }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny scoring helper. Confidence is HARD-CAPPED at 'medium'
 *   because we have no trained yield model — only honest signal
 *   counts. Anything claiming 'high' confidence here would be
 *   manufactured precision.
 *
 *   It is NOT a probability. It is a "how thin is the data?"
 *   indicator the surface uses to decide whether to show the
 *   estimate inline or behind a "see details" expander.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const CONFIDENCE_BAND = Object.freeze({
  LOW:    'low',
  MEDIUM: 'medium',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

/**
 * @param {object} signals
 * @returns {{ band, signals, bandReason }}
 */
export function confidenceBandFor(signals) {
  try {
    const s = (signals && typeof signals === 'object') ? signals : {};
    let score = 0;
    const reasons = [];

    if (s.hasPlantCount)                 { score += 1; reasons.push(_msg('yield.signal.plantCount', 'Plant count known')); }
    if (s.hasPlantingDate)               { score += 1; reasons.push(_msg('yield.signal.plantingDate', 'Planting date known')); }
    if (s.hasScanHistory)                { score += 1; reasons.push(_msg('yield.signal.scanHistory', 'Recent scan history')); }
    const tcr = Number(s.taskCompletionRate);
    if (Number.isFinite(tcr) && tcr >= 0.6) { score += 1; reasons.push(_msg('yield.signal.tasksOnTrack', 'Tasks broadly on track')); }
    const days = Number(s.daysSincePlanting);
    if (Number.isFinite(days) && days >= 30) { score += 1; reasons.push(_msg('yield.signal.midSeason', 'Past early-season — outcomes more predictable')); }

    // Cap at medium — honest ceiling for an un-trained model.
    const band = score >= 4 ? CONFIDENCE_BAND.MEDIUM : CONFIDENCE_BAND.LOW;
    const bandReason = band === CONFIDENCE_BAND.MEDIUM
      ? _msg('yield.confidence.medium', 'Several inputs available — still a ballpark estimate.')
      : _msg('yield.confidence.low',    'Limited inputs — treat as a rough ballpark only.');

    return { band, signals: reasons, bandReason };
  } catch {
    return {
      band: CONFIDENCE_BAND.LOW,
      signals: [],
      bandReason: _msg('yield.confidence.low', 'Limited inputs — treat as a rough ballpark only.'),
    };
  }
}

const _module = { CONFIDENCE_BAND, confidenceBandFor };
export default _module;
