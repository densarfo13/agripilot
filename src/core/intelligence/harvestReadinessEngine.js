/**
 * harvestReadinessEngine.js — composes a calm "how close to
 * harvest are we?" view.
 *
 *   import { computeHarvestReadiness, READINESS_LABEL }
 *     from 'src/core/intelligence/harvestReadinessEngine.js';
 *
 *   const r = computeHarvestReadiness({ crop, plantingDate, ... });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composition layer over `cropDurationRegistry` (range)
 *   + `cropLifecycleEngine` (current stage). It returns
 *   - daysUntilEarliest / daysUntilLatest (ints; negatives ⇒ past)
 *   - readinessLabel: 'too_early' | 'maturing' | 'ready_window' | 'overdue'
 *   - confidence (low by default — we do not pretend to know the
 *     exact day)
 *   - spoilage flag when rain is expected on a ripe crop
 *
 *   It does NOT invent a date — every output carries
 *   `isEstimate: true` and a disclaimer.
 *
 * Strict-rule audit
 *   • Pure. Never throws.
 */

import { estimateHarvestWindow, getDurationDays } from '../lifecycle/cropDurationRegistry.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const READINESS_LABEL = Object.freeze({
  TOO_EARLY:     'too_early',
  MATURING:      'maturing',
  READY_WINDOW:  'ready_window',
  OVERDUE:       'overdue',
  UNKNOWN:       'unknown',
});

const LABEL_COPY = Object.freeze({
  too_early:    { key: 'harvest.label.too_early',    fallback: 'Not yet — {crop} is still growing.' },
  maturing:     { key: 'harvest.label.maturing',     fallback: '{crop} is approaching harvest.' },
  ready_window: { key: 'harvest.label.ready_window', fallback: '{crop} may be ready — check colour and firmness.' },
  overdue:      { key: 'harvest.label.overdue',      fallback: '{crop} is past its typical harvest window.' },
  unknown:      { key: 'harvest.label.unknown',      fallback: 'Add a planting date to estimate harvest.' },
});

function _msg(template, params) {
  return { key: template.key, fallback: template.fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

/**
 * Compute the harvest readiness view.
 *
 * @param {object} args
 * @param {string} args.crop
 * @param {string|number|Date} [args.plantingDate]
 * @param {object} [args.weather]   for spoilage flag
 * @param {object} [args.opts]      { climate, setting }
 * @param {number} [args.nowMs]
 * @returns {object}
 */
export function computeHarvestReadiness(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const crop = a.crop || null;
    if (!crop || !a.plantingDate) {
      return Object.freeze({
        ok:           false,
        reason:       crop ? 'no_planting_date' : 'no_crop',
        cropLabel:    String(crop || 'the plant'),
        readinessLabel: READINESS_LABEL.UNKNOWN,
        message:      _msg(LABEL_COPY.unknown, { crop: String(crop || 'the plant') }),
        isEstimate:   true,
        disclaimer:   'Estimate not available — add a planting date for guidance.',
      });
    }

    const opts = (a.opts && typeof a.opts === 'object') ? a.opts : {};
    const w = estimateHarvestWindow(crop, a.plantingDate, { ...opts, nowMs: a.nowMs });
    if (!w || !w.ok) {
      return Object.freeze({
        ok:             false,
        reason:         w ? w.reason : 'unknown_crop',
        cropLabel:      String(crop),
        readinessLabel: READINESS_LABEL.UNKNOWN,
        message:        _msg(LABEL_COPY.unknown, { crop: String(crop) }),
        isEstimate:     true,
        disclaimer:     'Estimate not available for this crop yet.',
      });
    }

    let label;
    if (w.daysUntilEarliest > 14) label = READINESS_LABEL.TOO_EARLY;
    else if (w.daysUntilEarliest > 0) label = READINESS_LABEL.MATURING;
    else if (w.daysUntilLatest >= 0) label = READINESS_LABEL.READY_WINDOW;
    else label = READINESS_LABEL.OVERDUE;

    // Spoilage flag — only when we're inside the ready window AND
    // rain is expected.
    const weather = (a.weather && typeof a.weather === 'object') ? a.weather : {};
    const rainProb = Number(weather.rainProbability24hPct);
    const spoilageRisk = label === READINESS_LABEL.READY_WINDOW
      && Number.isFinite(rainProb) && rainProb >= 60;

    // Confidence ceiling is "medium" — we never claim "high"
    // confidence on a harvest date estimate. Confidence is
    // explicitly LOW when we're far from the window (too_early),
    // MEDIUM when in/near it.
    const confidence =
      label === READINESS_LABEL.TOO_EARLY ? 'low'
        : label === READINESS_LABEL.OVERDUE ? 'low'
          : 'medium';

    return Object.freeze({
      ok:               true,
      cropLabel:        String(crop),
      cropKey:          w.cropKey,
      readinessLabel:   label,
      message:          _msg(LABEL_COPY[label], { crop: String(crop) }),
      daysUntilEarliest: w.daysUntilEarliest,
      daysUntilLatest:   w.daysUntilLatest,
      earliest:          w.earliest,
      latest:            w.latest,
      durationDays:      w.durationDays,
      confidence,
      spoilageRisk,
      isEstimate:        true,
      disclaimer:        'Estimated harvest window — local conditions and variety may shift it.',
    });
  } catch {
    return Object.freeze({
      ok:             false, reason: 'exception',
      cropLabel:      'the plant',
      readinessLabel: READINESS_LABEL.UNKNOWN,
      message:        _msg(LABEL_COPY.unknown, { crop: 'the plant' }),
      isEstimate:     true,
      disclaimer:     'Estimate not available right now.',
    });
  }
}

const _module = { READINESS_LABEL, computeHarvestReadiness };
export default _module;
