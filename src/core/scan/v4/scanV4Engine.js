/**
 * scanV4Engine.js — Scan v4 contextual visible-intelligence composer.
 *
 *   import { runScanV4 } from 'src/core/scan/v4/scanV4Engine.js';
 *
 *   const v4 = runScanV4({
 *     classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
 *     crop:             'tomato',
 *     lifecycle:        { currentStage: 'fruiting' },
 *     weather:          { humidityPct: 88, rainProbability24hPct: 60, daysSinceRain: 1 },
 *     watering:         { lastWateredAt: NOW - 6 * HOUR },
 *     soilRisk:         'moderate',
 *     region:           'ashanti',
 *     country:          'GH',
 *     scanHistory:      [...],
 *     diseaseMemory:    {...},
 *     nowMs:            Date.now(),
 *   });
 *
 *   v4 = {
 *     possibleIssue,         // { key, fallback, params }
 *     confidenceTone,        // ditto
 *     whatWeNoticed,         // ditto
 *     whyNow,                // [{ key, fallback, params }, ...]
 *     riskFactors,           // [{ key, fallback, params }, ...]
 *     whatToDoNext,          // ditto
 *     preventionTip,         // ditto
 *     followUpTask,          // { titleKey, titleFallback }
 *     journalSummary,        // ditto (one-line summary)
 *     lifecycleImpact,       // { key, fallback, params }
 *     wateringAdjustment,    // ditto
 *     harvestImpact,         // ditto
 *     suppressed,            // null | { reason }
 *     disclaimer,            // ditto
 *   }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The ONE call surfaces make to get the unified scan-result
 *   envelope. Internally it composes:
 *     • `composeContextAwareDiagnosis` (v3) for the visible
 *       diagnosis block (possibleIssue / confidenceTone /
 *       whatWeNoticed / contextRaisingRisk / whatToDoNow).
 *     • `buildFollowupPlan` (v2) for follow-up task + reminder.
 *     • Lifecycle / watering / harvest impact computed inline —
 *       these are the v4-specific additions.
 *     • `gateTreatmentSuggestion` (v3) wraps any prevention tip
 *       that mentions chemicals.
 *     • V5 invisible engine (when ENABLE_SCAN_V5_INVISIBLE is on)
 *       runs over the v4 output to calibrate confidence + adjust
 *       follow-up timing.
 *
 *   It is NOT a classifier — the classifier output is INPUT.
 *   It is NOT a UI component. Surface renders the envelope.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every output is a `{ key, fallback, params }` envelope.
 *   • needs_review / failed image short-circuits via the
 *     diagnosis composer — v4 returns ok:false with the
 *     "choose a clearer photo" envelope. Hard image-trust
 *     gate honoured at the composition layer.
 */

import { composeContextAwareDiagnosis } from '../contextAwareDiagnosis.js';
import { buildFollowupPlan } from '../scanFollowupEngine.js';
import { gateTreatmentSuggestion, TREATMENT_CLASS } from '../../agronomy/treatmentSafetyLayer.js';
import { runScanV5Invisible } from '../v5/scanV5InvisibleEngine.js';
import { isFeatureEnabled, FEATURE } from '../../../config/featureFlags.js';

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

// ── V4-specific impact envelopes ─────────────────────────

function _lifecycleImpactFor(issue, lifecycle) {
  const stage = _str(lifecycle && lifecycle.currentStage);
  if (issue === 'fungal_risk' && (stage === 'flowering' || stage === 'fruiting')) {
    return _msg('scan.v4.lifecycle.fungalFruiting',
      'Fungal pressure at {stage} can reduce fruit set if untreated.',
      { stage });
  }
  if (issue === 'pest_damage' && (stage === 'flowering' || stage === 'fruiting')) {
    return _msg('scan.v4.lifecycle.pestFruiting',
      'Pest pressure during {stage} is worth tracking closely.', { stage });
  }
  if (issue === 'water_stress' && (stage === 'vegetative' || stage === 'fruiting')) {
    return _msg('scan.v4.lifecycle.waterCritical',
      'Water stress during {stage} can stunt growth — fix this first.', { stage });
  }
  if (issue === 'healthy') {
    return _msg('scan.v4.lifecycle.healthy', 'On track for this stage.');
  }
  return _msg('scan.v4.lifecycle.generic',
    'Watch how this changes through the next stage.');
}

function _wateringAdjustmentFor(issue, weather, watering) {
  const wet = weather && (_num(weather.humidityPct) >= 80 ||
                          _num(weather.rainProbability24hPct) >= 60);
  if (issue === 'fungal_risk') {
    return _msg('scan.v4.water.fungalAdjust',
      'Water at the base of the plant — avoid wetting leaves.');
  }
  if (issue === 'water_stress') {
    return _msg('scan.v4.water.waterDeeply',
      'Water deeply today and add mulch to keep moisture even.');
  }
  if (issue === 'healthy' && wet) {
    return _msg('scan.v4.water.skipWet',
      'Skip watering today — humidity is high and a wet leaf canopy lingers.');
  }
  if (issue === 'healthy') {
    return _msg('scan.v4.water.stayCourse',
      'Continue your normal watering routine.');
  }
  return _msg('scan.v4.water.generic',
    'No watering change is forced — observe before changing routine.');
}

function _harvestImpactFor(issue, lifecycle) {
  const stage = _str(lifecycle && lifecycle.currentStage);
  if (issue === 'fungal_risk' && (stage === 'fruiting' || stage === 'harvest_ready')) {
    return _msg('scan.v4.harvest.fungalRisk',
      'If untreated, fungal pressure may reduce the harvest yield.');
  }
  if (issue === 'pest_damage' && stage === 'harvest_ready') {
    return _msg('scan.v4.harvest.pestNearHarvest',
      'Pest damage close to harvest needs immediate attention.');
  }
  if (issue === 'healthy') {
    return _msg('scan.v4.harvest.healthy', 'Harvest outlook looks normal.');
  }
  return _msg('scan.v4.harvest.generic',
    'Harvest outlook depends on how this evolves over the next week.');
}

function _journalSummaryFor(diagnosis, crop) {
  const issueLabel = diagnosis.possibleIssue && diagnosis.possibleIssue.fallback;
  return _msg('scan.v4.journal.summary',
    '{crop} scan — {issue}.',
    { crop: crop || '', issue: issueLabel || 'observed' });
}

function _whyNowFor(diagnosis) {
  // Reuse the raisedContext block from the diagnosis composer
  // since "why now?" maps directly to "what context raised the
  // risk?"
  return Array.isArray(diagnosis.contextRaisingRisk)
    ? diagnosis.contextRaisingRisk.slice(0, 3)
    : [];
}

function _riskFactorsFor(diagnosis, scanHistory, issue) {
  const factors = [];
  // Reuse raised risk + add recurrence as a top-level risk factor.
  if (Array.isArray(diagnosis.contextRaisingRisk)) {
    for (const r of diagnosis.contextRaisingRisk) factors.push(r);
  }
  const recurring = (scanHistory || []).filter(
    (s) => s && _str(s.issueCategory) === issue);
  if (recurring.length >= 2) {
    factors.push(_msg('scan.v4.risk.recurring',
      'This is the {n}rd time we have seen this on your farm.',
      { n: recurring.length + 1 }));
  }
  return factors.slice(0, 4);
}

/**
 * Run the v4 composer. Returns the unified envelope.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function runScanV4(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const classifier = c.classifierResult || {};
    const issue = _str(classifier.issueCategory);
    const confidence = _str(classifier.confidenceLabel);

    // 1. Diagnosis composer — gives us the image-trust gate
    //    (needs_review → short-circuit) + the visible blocks.
    const diagnosis = composeContextAwareDiagnosis({
      classifierResult: classifier,
      crop:             c.crop,
      lifecycle:        c.lifecycle,
      weather:          c.weather,
      scanHistory:      c.scanHistory,
      soilRisk:         c.soilRisk,
    });

    if (!diagnosis.ok) {
      // Failed image / needs review — return the calm short-circuit
      // envelope with v4 shape so callers see consistent fields.
      return {
        ok:                 false,
        possibleIssue:      diagnosis.possibleIssue,
        confidenceTone:     diagnosis.confidenceTone,
        whatWeNoticed:      diagnosis.whatWeNoticed,
        whyNow:             [],
        riskFactors:        [],
        whatToDoNext:       diagnosis.whatToDoNow,
        preventionTip:      null,
        followUpTask:       null,
        journalSummary:     null,
        lifecycleImpact:    null,
        wateringAdjustment: null,
        harvestImpact:      null,
        suppressed:         diagnosis.suppressed,
        disclaimer:         diagnosis.disclaimer,
      };
    }

    // 2. Follow-up plan — recheck timing + prevention tip.
    const followup = buildFollowupPlan({
      issueCategory:   issue,
      confidenceLabel: confidence,
      crop:            c.crop,
      stage:           c.lifecycle && c.lifecycle.currentStage,
      weather:         c.weather,
      scanHistory:     c.scanHistory,
      scanId:          c.scanId,
      nowMs:           c.nowMs,
    });

    // 3. Prevention tip — pass through the treatment safety
    //    layer so chemical-flavoured wording always routes to
    //    the consult-expert envelope.
    const preventionRaw = followup && followup.preventionTip;
    const preventionGated = preventionRaw
      ? gateTreatmentSuggestion({
          suggestion: preventionRaw.fallback || '',
          verifiedSource: false,
        })
      : null;
    const preventionTip = preventionGated && preventionGated.allowed
      ? preventionRaw
      : (preventionGated ? preventionGated.publicMessage : preventionRaw);

    // 4. V4 envelope.
    const v4 = {
      ok:                 true,
      possibleIssue:      diagnosis.possibleIssue,
      confidenceTone:     diagnosis.confidenceTone,
      whatWeNoticed:      diagnosis.whatWeNoticed,
      whyNow:             _whyNowFor(diagnosis),
      riskFactors:        _riskFactorsFor(diagnosis, c.scanHistory, issue),
      whatToDoNext:       diagnosis.whatToDoNow,
      preventionTip,
      followUpTask:       followup && followup.followupTask
        ? {
            titleKey:      'scan.v4.followupTask',
            titleFallback: followup.followupTask.fallback,
            atMs:          followup.reminder && followup.reminder.atMs,
          }
        : null,
      journalSummary:     _journalSummaryFor(diagnosis, c.crop),
      lifecycleImpact:    _lifecycleImpactFor(issue, c.lifecycle),
      wateringAdjustment: _wateringAdjustmentFor(issue, c.weather, c.watering),
      harvestImpact:      _harvestImpactFor(issue, c.lifecycle),
      suppressed:         null,
      disclaimer:         diagnosis.disclaimer,
    };

    // 5. V5 invisible pass — when the flag is ON, calibrate
    //    confidence + suggest a follow-up timing adjustment.
    //    NEVER mutates the visible envelope.
    if (isFeatureEnabled(FEATURE.SCAN_V5_INVISIBLE)) {
      const v5 = runScanV5Invisible({
        v4Output:       v4,
        scanHistory:    c.scanHistory,
        diseaseMemory:  c.diseaseMemory,
        outcomeLog:     c.outcomeLog,
      });
      // Attach the v5 hints under a separate key — surfaces that
      // want them can read; the visible result is unaffected.
      v4.invisibleHints = v5;
    }

    return v4;
  } catch {
    return {
      ok:                 false,
      possibleIssue:      _msg('scan.issue.unclear', 'Needs a clearer photo'),
      confidenceTone:     _msg('scan.confidenceTone.review', 'Needs review'),
      whatWeNoticed:      _msg('scan.noticed.unclear', 'The photo could not be read.'),
      whyNow:             [],
      riskFactors:        [],
      whatToDoNext:       _msg('scan.doNow.unclear', 'Take a new photo before we suggest next steps.'),
      preventionTip:      null,
      followUpTask:       null,
      journalSummary:     null,
      lifecycleImpact:    null,
      wateringAdjustment: null,
      harvestImpact:      null,
      suppressed:         { reason: 'exception' },
      disclaimer:         _msg('scan.disclaimer.hedged',
        'Scan guidance is a starting point — local conditions vary.'),
    };
  }
}

const _module = { runScanV4 };
export default _module;
