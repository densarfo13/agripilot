/**
 * diseaseConfidenceCalibration.js — Phase 2 §3.
 *
 *   import { calibrateDiseaseConfidence }
 *     from 'src/core/scan/diseaseConfidenceCalibration.js';
 *
 *   const v = calibrateDiseaseConfidence({
 *     rawModelConfidence, imageQualityScore, leafIsolationScore,
 *     cropMatchScore, regionDiseaseRelevance, weatherDiseaseRelevance,
 *     scanHistory, recurrenceHistory,
 *   });
 *
 *   v = {
 *     confidenceTone:      'High confidence' | 'Medium confidence' | 'Needs review',
 *     explanation,         — { key, fallback, params }
 *     uncertaintyFactors,  — [{ kind, key, fallback }]
 *     followUpRecommendation, — { key, fallback } | null
 *     engineVersion:'disease-calibration-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   Converts raw model confidence into farmer-safe tones via a
 *   downgrade-bias calibration. NEVER exposes the raw percentage.
 *   NEVER upgrades confidence past Medium unless multiple
 *   independent signals (recurrence + weather + region) all align.
 *
 *   Downgrade triggers (each independent):
 *     • imageQualityScore < 0.5      — poor photo
 *     • leafIsolationScore < 0.4     — couldn't isolate the leaf
 *     • cropMatchScore < 0.5         — crop mismatch suspected
 *
 *   Upgrade conditions (ALL three required, very conservative):
 *     • rawModelConfidence ≥ 0.85
 *     • regionDiseaseRelevance ≥ 0.6
 *     • (recurrenceHistory shows ≥ 2 prior occurrences
 *        OR weatherDiseaseRelevance ≥ 0.7)
 *
 *   When the flag ENABLE_DISEASE_CONFIDENCE_CALIBRATION is OFF,
 *   the calibration falls back to a calm "Needs review" tone so
 *   the surface treats it conservatively.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Never exposes rawModelConfidence in any output field.
 */

import { FLAG, isFeatureFlagOn } from '../deployment/deploymentGovernance.js';
import { gateEngine } from '../intelligence/dataQualityGate.js';

const ENGINE_VERSION = 'disease-calibration-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const TONE = Object.freeze({
  HIGH:   'High confidence',
  MEDIUM: 'Medium confidence',
  NEEDS:  'Needs review',
});

function _toneEnvelopeFor(tone) {
  if (tone === TONE.HIGH) {
    return Object.freeze({
      key: 'diseaseCal.tone.high', fallback: 'High confidence',
    });
  }
  if (tone === TONE.MEDIUM) {
    return Object.freeze({
      key: 'diseaseCal.tone.medium', fallback: 'Medium confidence',
    });
  }
  return Object.freeze({
    key: 'diseaseCal.tone.needsReview', fallback: 'Needs review',
  });
}

function _collectUncertaintyFactors(input) {
  const out = [];
  const iq = _num(input.imageQualityScore);
  if (iq != null && iq < 0.5) {
    out.push(Object.freeze({
      kind: 'image_quality',
      key:  'diseaseCal.factor.imageQuality',
      fallback: 'The photo was a bit unclear — re-scan in brighter light if you can.',
    }));
  }
  const li = _num(input.leafIsolationScore);
  if (li != null && li < 0.4) {
    out.push(Object.freeze({
      kind: 'leaf_isolation',
      key:  'diseaseCal.factor.leafIsolation',
      fallback: 'The leaf area was hard to single out — try framing just one leaf.',
    }));
  }
  const cm = _num(input.cropMatchScore);
  if (cm != null && cm < 0.5) {
    out.push(Object.freeze({
      kind: 'crop_mismatch',
      key:  'diseaseCal.factor.cropMismatch',
      fallback: 'The crop in the photo did not match expected leaves — confirm the crop in your farm settings.',
    }));
  }
  return out;
}

function _followUpFor(tone) {
  if (tone === TONE.NEEDS) {
    return Object.freeze({
      key:      'diseaseCal.followUp.reScan',
      fallback: 'Re-scan the same plant in 2 days to confirm.',
    });
  }
  if (tone === TONE.MEDIUM) {
    return Object.freeze({
      key:      'diseaseCal.followUp.monitor',
      fallback: 'Keep an eye on this plant for the next few days.',
    });
  }
  return null;
}

/**
 * Calibrate a raw model confidence into a farmer-safe tone.
 * Always returns an envelope; never throws.
 */
export function calibrateDiseaseConfidence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};

    const flagOn = isFeatureFlagOn(FLAG.ENABLE_DISEASE_CONFIDENCE_CALIBRATION);
    const gate   = gateEngine('disease_calibration', safe);

    const uncertaintyFactors = _collectUncertaintyFactors(safe);

    let tone;
    if (!flagOn || !gate.ready) {
      tone = TONE.NEEDS;
    } else if (uncertaintyFactors.length > 0) {
      // Any downgrade trigger → Needs review.
      tone = TONE.NEEDS;
    } else {
      const raw      = _num(safe.rawModelConfidence) || 0;
      const region   = _num(safe.regionDiseaseRelevance) || 0;
      const weather  = _num(safe.weatherDiseaseRelevance) || 0;
      const recurrence = Array.isArray(safe.recurrenceHistory)
        ? safe.recurrenceHistory.length : 0;
      const recurrenceStrong = recurrence >= 2;
      const upgradeAllowed = raw >= 0.85
        && region >= 0.6
        && (recurrenceStrong || weather >= 0.7);
      if (upgradeAllowed) tone = TONE.HIGH;
      else if (raw >= 0.55) tone = TONE.MEDIUM;
      else tone = TONE.NEEDS;
    }

    const explanation = (tone === TONE.NEEDS)
      ? Object.freeze({
          key:      'diseaseCal.explanation.needsReview',
          fallback: 'Treat this reading as a starting point — re-scan when you can.',
        })
      : (tone === TONE.HIGH)
        ? Object.freeze({
            key:      'diseaseCal.explanation.high',
            fallback: 'Multiple recent signals support this reading.',
          })
        : Object.freeze({
            key:      'diseaseCal.explanation.medium',
            fallback: 'Reading is plausible — confirm with a re-scan if uncertain.',
          });

    return Object.freeze({
      engineVersion:          ENGINE_VERSION,
      confidenceTone:         _toneEnvelopeFor(tone),
      confidenceToneRaw:      tone,
      explanation,
      uncertaintyFactors:     Object.freeze(uncertaintyFactors),
      followUpRecommendation: _followUpFor(tone),
      fallbackUsed:           !flagOn || !gate.ready,
      generatedAt:            Date.now(),
    });
  }, Object.freeze({
    engineVersion:          ENGINE_VERSION,
    confidenceTone:         _toneEnvelopeFor(TONE.NEEDS),
    confidenceToneRaw:      TONE.NEEDS,
    explanation: Object.freeze({
      key:      'diseaseCal.explanation.needsReview',
      fallback: 'Treat this reading as a starting point — re-scan when you can.',
    }),
    uncertaintyFactors:     Object.freeze([]),
    followUpRecommendation: Object.freeze({
      key: 'diseaseCal.followUp.reScan',
      fallback: 'Re-scan the same plant in 2 days to confirm.',
    }),
    fallbackUsed:           true,
    generatedAt:            Date.now(),
  }));
}

export const _internal = Object.freeze({
  TONE, _toneEnvelopeFor, _collectUncertaintyFactors, _followUpFor,
  ENGINE_VERSION,
});

const _module = { calibrateDiseaseConfidence, TONE, _internal };
export default _module;
