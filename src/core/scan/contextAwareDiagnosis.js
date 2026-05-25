/**
 * contextAwareDiagnosis.js — multi-signal diagnosis + explainability
 * composer. Wraps the image-only classifier output with the calm
 * "why this result?" structure the spec asks for.
 *
 *   import { composeContextAwareDiagnosis }
 *     from 'src/core/scan/contextAwareDiagnosis.js';
 *
 *   const d = composeContextAwareDiagnosis({
 *     classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
 *     crop:             'tomato',
 *     lifecycle:        { currentStage: 'fruiting' },
 *     weather:          { humidityPct: 88, rainProbability24hPct: 60 },
 *     scanHistory:      [...],
 *     soilRisk:         'moderate',
 *   });
 *   // d = {
 *   //   possibleIssue,
 *   //   confidenceTone,
 *   //   whatWeNoticed,
 *   //   contextRaisingRisk: [...],
 *   //   contextLoweringRisk: [...],
 *   //   whatToCheckNext,
 *   //   whatToDoNow,
 *   //   followUpTask,
 *   //   suppressed: { reason },
 *   // }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composer. Takes the existing classifier output + the
 *   contextual snapshot the orchestrator has already gathered, and
 *   produces a calm, hedged, explainable result envelope the surface
 *   renders verbatim.
 *
 *   It is NOT a classifier — the image-only inference happens
 *   upstream (fastIssueClassifier / external provider). It does
 *   NOT call out to the network. It does NOT prescribe chemicals.
 *
 *   When the classifier returned a needs_review / failed-image
 *   verdict, this function returns `{ suppressed: { reason: 'image_invalid' } }`
 *   with the calm "choose a clearer photo" envelope — the spec's
 *   §1 image-trust gate enforced at the composition layer too.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every output is a `{ key, fallback, params }` envelope.
 *   • Hedged wording only — asserted by the test suite.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

// ── Issue-name envelopes ─────────────────────────────────
const _ISSUE_NAME = {
  fungal_risk:      _msg('scan.issue.fungal',      'Possible fungal pressure'),
  pest_damage:      _msg('scan.issue.pest',        'Possible pest damage'),
  water_stress:     _msg('scan.issue.water',       'Possible water stress'),
  nutrient_stress:  _msg('scan.issue.nutrient',    'Possible nutrient stress'),
  healthy:          _msg('scan.issue.healthy',     'Looks healthy'),
  unknown_needs_clearer_photo: _msg('scan.issue.unclear', 'Needs a clearer photo'),
};

const _CONFIDENCE_TONE = {
  high:         _msg('scan.confidenceTone.high',   'High confidence'),
  medium:       _msg('scan.confidenceTone.medium', 'Medium confidence'),
  low:          _msg('scan.confidenceTone.low',    'Needs a closer look'),
  needs_review: _msg('scan.confidenceTone.review', 'Needs review'),
};

const _WHAT_WE_NOTICED = {
  fungal_risk:     _msg('scan.noticed.fungal',     'Spots or discoloured patches on the leaf surface.'),
  pest_damage:     _msg('scan.noticed.pest',       'Bite marks, holes, or webbing on the leaves.'),
  water_stress:    _msg('scan.noticed.water',      'Drooping or curled leaves that may suggest moisture stress.'),
  nutrient_stress: _msg('scan.noticed.nutrient',   'Yellowing or weak growth that may suggest nutrient gaps.'),
  healthy:         _msg('scan.noticed.healthy',    'Leaves look balanced and the colour is even.'),
};

const _WHAT_TO_CHECK_NEXT = {
  fungal_risk:     _msg('scan.checkNext.fungal',   'Check the underside of nearby leaves for the same pattern.'),
  pest_damage:     _msg('scan.checkNext.pest',     'Walk the row and look at new growth — pests usually move.'),
  water_stress:    _msg('scan.checkNext.water',    'Press a finger 2-3 cm into the soil to confirm moisture.'),
  nutrient_stress: _msg('scan.checkNext.nutrient', 'A soil test gives a clearer picture of what is missing.'),
  healthy:         _msg('scan.checkNext.healthy',  'Keep the routine — check again in a couple of weeks.'),
};

const _WHAT_TO_DO_NOW = {
  fungal_risk:     _msg('scan.doNow.fungal',       'Water at the base of the plant and improve airflow between plants.'),
  pest_damage:     _msg('scan.doNow.pest',         'Hand-pick visible pests and check new growth daily.'),
  water_stress:    _msg('scan.doNow.water',        'Water deeply now and add mulch to keep moisture even.'),
  nutrient_stress: _msg('scan.doNow.nutrient',     'Add compost or organic matter around the plant base.'),
  healthy:         _msg('scan.doNow.healthy',      'No action needed — continue your current care routine.'),
};

// ── Context contributors ─────────────────────────────────

function _contextRaising(issue, weather, scanHistory) {
  const raised = [];
  if (!weather) return raised;
  const h = _num(weather.humidityPct);
  const r = _num(weather.rainProbability24hPct);
  const d = _num(weather.daysSinceRain);
  const t = _num(weather.temperatureC);

  if (issue === 'fungal_risk') {
    if (h != null && h >= 80) raised.push(_msg('scan.context.raise.humid', 'High humidity favours fungal spread.'));
    if (r != null && r >= 60) raised.push(_msg('scan.context.raise.rainSoon', 'Rain in the next 24h keeps leaves wet longer.'));
  }
  if (issue === 'water_stress') {
    if (d != null && d >= 7) raised.push(_msg('scan.context.raise.drySpell', 'Dry spell of {n} day(s) raises water stress.', { n: d }));
    if (t != null && t >= 32) raised.push(_msg('scan.context.raise.heat', 'High temperatures increase evaporation.'));
  }
  if (issue === 'pest_damage' || issue === 'fungal_risk') {
    const recent = (scanHistory || []).filter((s) => s && _str(s.issueCategory) === issue);
    if (recent.length >= 1) {
      raised.push(_msg('scan.context.raise.recurring',
        'This pattern has been seen here before — repeat occurrence raises confidence.'));
    }
  }
  return raised;
}

function _contextLowering(issue, weather, classifierResult) {
  const lowered = [];
  if (!weather) return lowered;
  const h = _num(weather.humidityPct);
  const d = _num(weather.daysSinceRain);

  if (issue === 'fungal_risk') {
    if (h != null && h < 50) lowered.push(_msg('scan.context.lower.dryAir', 'Dry air slows fungal spread.'));
  }
  if (issue === 'water_stress') {
    if (d != null && d <= 2) lowered.push(_msg('scan.context.lower.recentRain', 'Recent rain reduces water-stress likelihood.'));
  }
  if (classifierResult && classifierResult.confidenceLabel === 'low') {
    lowered.push(_msg('scan.context.lower.weakSignal',
      'Visual signal is weak — the result is more "watch" than "act".'));
  }
  return lowered;
}

// ── Composition ──────────────────────────────────────────

/**
 * @param {object} ctx
 * @returns {object}
 */
export function composeContextAwareDiagnosis(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const classifier = (c.classifierResult && typeof c.classifierResult === 'object')
      ? c.classifierResult : {};
    const issue = _str(classifier.issueCategory) || 'unknown_needs_clearer_photo';
    const confidence = _str(classifier.confidenceLabel) || 'low';

    // §1 hard gate: needs_review / invalid image → calm short-circuit.
    if (confidence === 'needs_review' || issue === 'unknown_needs_clearer_photo') {
      return {
        ok:            false,
        possibleIssue: { ..._ISSUE_NAME.unknown_needs_clearer_photo },
        confidenceTone:{ ..._CONFIDENCE_TONE.needs_review },
        whatWeNoticed: _msg('scan.noticed.unclear',
          'The photo is unclear — symptoms are hard to read.'),
        contextRaisingRisk: [],
        contextLoweringRisk: [],
        whatToCheckNext: _msg('scan.checkNext.unclear',
          'Move closer to the affected leaf and try again in good light.'),
        whatToDoNow: _msg('scan.doNow.unclear',
          'Take a new photo before we suggest next steps.'),
        followUpTask: null,
        suppressed: { reason: 'image_invalid' },
        disclaimer: _msg('scan.disclaimer.hedged',
          'Scan guidance is a starting point — local conditions vary.'),
      };
    }

    const known = _ISSUE_NAME[issue];
    const possibleIssue = known
      ? { ...known }
      : _msg('scan.issue.unknown', 'Pattern not recognised', { issue });

    return {
      ok:              true,
      possibleIssue,
      confidenceTone:  { ...(_CONFIDENCE_TONE[confidence] || _CONFIDENCE_TONE.low) },
      whatWeNoticed:   { ...(_WHAT_WE_NOTICED[issue] || _msg('scan.noticed.generic', 'Unusual pattern on the leaf.')) },
      contextRaisingRisk:  _contextRaising(issue, c.weather, c.scanHistory),
      contextLoweringRisk: _contextLowering(issue, c.weather, classifier),
      whatToCheckNext: { ...(_WHAT_TO_CHECK_NEXT[issue] || _msg('scan.checkNext.generic', 'Check the same plant again in a few days.')) },
      whatToDoNow:     { ...(_WHAT_TO_DO_NOW[issue]     || _msg('scan.doNow.generic',     'Observe and document — avoid sudden changes.')) },
      followUpTask:    {
        titleKey: 'scan.followup.task.' + issue,
        titleFallback: 'Re-check the plant in a few days and compare with this photo.',
      },
      suppressed:      null,
      disclaimer:      _msg('scan.disclaimer.hedged',
        'Scan guidance is a starting point — local conditions vary.'),
    };
  } catch {
    return {
      ok:            false,
      possibleIssue: { ..._ISSUE_NAME.unknown_needs_clearer_photo },
      confidenceTone:{ ..._CONFIDENCE_TONE.needs_review },
      whatWeNoticed: _msg('scan.noticed.unclear', 'The photo could not be read.'),
      contextRaisingRisk: [],
      contextLoweringRisk: [],
      whatToCheckNext: _msg('scan.checkNext.unclear', 'Try a fresh photo.'),
      whatToDoNow: _msg('scan.doNow.unclear', 'Take a new photo before we suggest next steps.'),
      followUpTask: null,
      suppressed: { reason: 'exception' },
      disclaimer: _msg('scan.disclaimer.hedged', 'Scan guidance is a starting point.'),
    };
  }
}

const _module = { composeContextAwareDiagnosis };
export default _module;
