/**
 * contextDiagnosisEngine.js — Phase 12 Context-Aware Diagnosis.
 *
 *   import { runContextDiagnosis }
 *     from 'src/core/scan/contextDiagnosisEngine.js';
 *
 *   const verdict = runContextDiagnosis({
 *     scanResult:    out,                         // analyzeScan output
 *     focusContext:  leafFocusEngine output,
 *     crop:          'tomato',
 *     cropStage:     'flowering',
 *     region:        'Ashanti',
 *     country:       'Ghana',
 *     weather:       { humidityPct, rainProbability24hPct, … },
 *     scanHistory:   getScanUsefulHistory(),
 *     soilSignal:    { risk: 'moderate' },
 *     activeExperience: 'farm',
 *   });
 *
 *   verdict = {
 *     likelyIssue:               { key, fallback, params },
 *     alternativePossibilities:  [{ issueId, label, weight, reason }],
 *     confidence:                'high' | 'medium' | 'low',
 *     confidenceScore:           0..1,
 *     severity:                  'mild' | 'moderate' | 'serious',
 *     urgency:                   'low' | 'medium' | 'high',
 *     treatmentPlan:             { steps: [{ key, fallback }], categoryHint },
 *     preventionPlan:            { steps: [{ key, fallback }] },
 *     followUpWindowDays:        number,
 *     monitoringNeeded:          boolean,
 *     escalationRecommendation:  null | { key, fallback, reason },
 *     whatFarrowayNoticed:       { key, fallback, params },
 *     whyWeThinkThis:            [{ key, fallback, params }],
 *     contextLayers:             { regional, weather, stage, history, focus },
 *     // ── meta ──
 *     engineVersion:             'phase12-v1',
 *     reconciliation:            { visual, contextual, historical, blended },
 *   }
 *
 * What it is
 * ──────────
 *   The orchestrator that turns a raw classifier verdict into an
 *   agricultural decision. Composes with the existing engines —
 *   it does NOT replace any of them:
 *
 *     • hybridAnalyze              — image + weather + region blend
 *     • composeContextAwareDiagnosis — explainability envelope
 *     • regionalRiskSignals        — regional outbreak pressure
 *     • diseaseMemory              — historical scan signals
 *     • leafFocusEngine            — isolation + guidance metrics
 *
 *   The new bits this layer adds on top:
 *     1. Alternative possibilities — ranked top-3 candidates with
 *        weights + per-candidate reason
 *     2. Severity scale — mild / moderate / serious from
 *        urgency × regional pressure × repeat history
 *     3. Treatment plan + Prevention plan (separated)
 *     4. Follow-up window in days (computed from severity + crop
 *        lifecycle stage)
 *     5. Monitoring flag + Escalation recommendation
 *     6. Confidence reconciliation — visual / contextual / historical
 *        blended into a single confidenceScore
 *     7. "What Farroway noticed" / "Why we think this" copy hooks
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Every visible string is a `{ key, fallback, params }` envelope
 *     — surfaces resolve via tSafe so the verdict localises.
 *   • Compose-only: every input modality is best-effort; missing
 *     ones degrade gracefully (lower confidence, fewer "why" rows,
 *     never a crash).
 *   • No network. No clock-dependent comparisons beyond Date.now()
 *     for follow-up date computation.
 */

import { hybridAnalyze, ISSUES } from '../hybridScanEngine.js';
import { composeContextAwareDiagnosis } from './contextAwareDiagnosis.js';
import { aggregateRegionalScans, REGIONAL_PRESSURE } from './regionalRiskSignals.js';
import {
  summariseDiseaseMemory, isRecurringIssue, recoveryTrendFor,
} from './diseaseMemory.js';

const ENGINE_VERSION = 'phase12-v1';

// ─── Helpers ────────────────────────────────────────────────

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

// Map low/medium/high confidence labels → 0..1 numeric anchor.
function _confidenceToScore(label) {
  switch (_str(label).toLowerCase()) {
    case 'high':   return 0.85;
    case 'medium': return 0.55;
    case 'low':    return 0.30;
    default:       return 0.40;
  }
}

function _scoreToConfidence(score) {
  if (score >= 0.70) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

/**
 * Normalize urgency labels emitted by other engines into the
 * canonical low/medium/high triad used throughout Phase 12.
 * hybridScanEngine uses ('today','soon','monitor','routine');
 * other engines use ('critical','high','warning','low'). Unknown
 * labels coerce to 'medium' so we never silently downgrade.
 */
function _normalizeUrgency(label) {
  const s = _str(label).toLowerCase();
  if (!s) return 'medium';
  if (s === 'high' || s === 'critical' || s === 'today') return 'high';
  if (s === 'low'  || s === 'routine'  || s === 'monitor') return 'low';
  if (s === 'medium' || s === 'soon' || s === 'warning') return 'medium';
  return 'medium';
}

// ─── Severity scale ────────────────────────────────────────

const SEVERITY = Object.freeze({ MILD: 'mild', MODERATE: 'moderate', SERIOUS: 'serious' });

function _deriveSeverity({ hybrid, regionalPressure, recurring, recoveryTrend, focus }) {
  // Baseline from hybrid urgency. hybridScanEngine emits its own
  // vocabulary ('today', 'soon', 'monitor', 'routine'); we map
  // each into the low/medium/high triad the rest of the engine
  // uses, and treat unknown labels as medium so an upstream
  // refactor can't silently downgrade severity.
  let score = 0;
  switch (_normalizeUrgency(hybrid && hybrid.urgency)) {
    case 'high':   score += 3; break;
    case 'medium': score += 2; break;
    case 'low':    score += 1; break;
    default:       score += 2;
  }
  // Regional outbreak pressure adds weight
  switch (_str(regionalPressure).toLowerCase()) {
    case 'outbreak': score += 2; break;
    case 'rising':   score += 1; break;
    default:         break;
  }
  // Recurring on the user's own farm escalates urgency
  if (recurring) score += 1;
  // Worsening trend = escalate; improving = de-escalate
  if (recoveryTrend === 'worsening') score += 1;
  if (recoveryTrend === 'improving') score -= 1;
  // Heavy lesion coverage from focus engine raises severity.
  // A lesion that covers >30% of the leaf bumps severity by 3
  // points so even a low-urgency baseline escalates to at least
  // moderate — a visibly diseased leaf is never "mild".
  if (focus && focus.metrics && focus.metrics.lesionBBox) {
    const lb = focus.metrics.lesionBBox;
    const dl = focus.metrics.dominantLeafBBox;
    if (lb && dl) {
      const lesionArea = (lb.maxX - lb.minX + 1) * (lb.maxY - lb.minY + 1);
      const leafArea = (dl.maxX - dl.minX + 1) * (dl.maxY - dl.minY + 1);
      if (leafArea > 0) {
        const pct = lesionArea / leafArea;
        if (pct > 0.30) score += 3;
        else if (pct > 0.15) score += 1;
      }
    }
  }
  if (score >= 6) return SEVERITY.SERIOUS;
  if (score >= 4) return SEVERITY.MODERATE;
  return SEVERITY.MILD;
}

// ─── Follow-up window ──────────────────────────────────────

function _followUpWindowDays(severity, cropStage) {
  const baseBySeverity = {
    [SEVERITY.SERIOUS]:  2,
    [SEVERITY.MODERATE]: 4,
    [SEVERITY.MILD]:     7,
  };
  let days = baseBySeverity[severity] || 7;
  // Flowering / fruiting stages are sensitive — tighten the
  // window so a missed week doesn't cost the crop.
  const stage = _str(cropStage).toLowerCase();
  if (stage.includes('flower') || stage.includes('fruit')) {
    days = Math.max(2, days - 1);
  }
  return days;
}

// ─── Monitoring + escalation ───────────────────────────────

function _monitoringNeeded(severity, recurring, recoveryTrend) {
  if (severity === SEVERITY.SERIOUS) return true;
  if (recurring) return true;
  if (recoveryTrend === 'worsening') return true;
  return severity === SEVERITY.MODERATE;
}

function _escalationRecommendation({ severity, confidenceScore, regionalPressure }) {
  if (severity === SEVERITY.SERIOUS && confidenceScore < 0.55) {
    return Object.freeze({
      key:      'scan.diagnosis.escalate.serious_low_conf',
      fallback: 'Severity looks serious but the photo confidence is low — share with a local agronomist for a second opinion.',
      reason:   'serious_low_confidence',
    });
  }
  if (_str(regionalPressure).toLowerCase() === 'outbreak'
      && severity !== SEVERITY.MILD) {
    return Object.freeze({
      key:      'scan.diagnosis.escalate.regional_outbreak',
      fallback: 'A regional outbreak of this issue is active. Coordinating with neighbours and your extension officer is worth the call.',
      reason:   'regional_outbreak',
    });
  }
  if (severity === SEVERITY.SERIOUS) {
    return Object.freeze({
      key:      'scan.diagnosis.escalate.serious',
      fallback: 'This looks serious. Treat now and consider an agronomist follow-up.',
      reason:   'serious',
    });
  }
  return null;
}

// ─── Treatment + prevention split ─────────────────────────

const TREATMENT_HINTS = Object.freeze([
  /apply|spray|treat|water|remove|cut|prune|fertili[zs]e|drench/i,
]);

const PREVENTION_HINTS = Object.freeze([
  /inspect|monitor|check|avoid|space|rotate|airflow|drain|sanit|clean/i,
]);

function _splitTreatmentPrevention(actions) {
  if (!Array.isArray(actions)) return { treatment: [], prevention: [] };
  const treatment = [];
  const prevention = [];
  for (const a of actions) {
    if (typeof a !== 'string' || !a.trim()) continue;
    const trimmed = a.trim();
    const isPrevention = PREVENTION_HINTS.some((re) => re.test(trimmed));
    const isTreatment  = TREATMENT_HINTS.some((re) => re.test(trimmed));
    if (isTreatment && !isPrevention) treatment.push(trimmed);
    else if (isPrevention) prevention.push(trimmed);
    else treatment.push(trimmed);  // default: actionable now
  }
  return { treatment, prevention };
}

function _envelopeAction(text) {
  return Object.freeze({
    // Use a stable hash-ish key derived from the text; surfaces
    // that want to localize per-action wire a `scan.action.<slug>`
    // entry into the translations overlay.
    key:      'scan.action.' + _slugify(text),
    fallback: text,
  });
}

function _slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

// ─── Alternative possibilities ─────────────────────────────

const KNOWN_ISSUES = [
  { id: ISSUES.YELLOWING_LEAVES,      label: 'Yellowing leaves',     baseWeight: 0.15 },
  { id: ISSUES.WILTING,               label: 'Wilting',              baseWeight: 0.10 },
  { id: ISSUES.PESTS_OR_HOLES,        label: 'Pest damage',          baseWeight: 0.18 },
  { id: ISSUES.SPOTS_OR_DISEASE,      label: 'Leaf spots',           baseWeight: 0.20 },
  { id: ISSUES.NUTRIENT_DEFICIENCY,   label: 'Nutrient deficiency',  baseWeight: 0.12 },
  { id: ISSUES.HEALTHY,               label: 'Healthy',              baseWeight: 0.05 },
  { id: ISSUES.NEEDS_CLOSER_INSPECTION, label: 'Needs review',       baseWeight: 0.10 },
];

function _alternativePossibilities({ primaryIssue, weather, regionalPressure, recurring, hybrid }) {
  // Build a candidate list weighted by:
  //   • base prior
  //   • match with the primary issue (down-weighted to avoid showing duplicates)
  //   • weather context (humidity → fungal; dry → nutrient)
  //   • regional pressure
  //   • recurrence
  const humidity = _num(weather && weather.humidityPct);
  const rainProb = _num(weather && weather.rainProbability24hPct);
  const out = [];
  for (const issue of KNOWN_ISSUES) {
    if (issue.id === primaryIssue) continue;  // skip the primary; alternatives only
    let w = issue.baseWeight;
    if (issue.id === ISSUES.SPOTS_OR_DISEASE) {
      if (humidity != null && humidity >= 70) w += 0.10;
      if (rainProb != null && rainProb >= 50) w += 0.05;
    }
    if (issue.id === ISSUES.NUTRIENT_DEFICIENCY) {
      if (rainProb != null && rainProb <= 20) w += 0.05;
    }
    if (issue.id === ISSUES.WILTING) {
      if (humidity != null && humidity <= 40) w += 0.05;
    }
    // Regional outbreak boost — disease + outbreak nudges
    if (_str(regionalPressure).toLowerCase() === 'outbreak'
        && issue.id === ISSUES.SPOTS_OR_DISEASE) {
      w += 0.10;
    }
    out.push({
      issueId: issue.id,
      label:   issue.label,
      weight:  Math.min(0.99, Math.max(0.01, w)),
      reason:  _alternativeReason(issue.id, weather, regionalPressure),
    });
  }
  // Sort + cap at 3.
  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, 3);
}

function _alternativeReason(issueId, weather, regionalPressure) {
  const humidity = _num(weather && weather.humidityPct);
  const rainProb = _num(weather && weather.rainProbability24hPct);
  if (issueId === ISSUES.SPOTS_OR_DISEASE && humidity != null && humidity >= 70) {
    return Object.freeze({
      key:      'scan.alt.reason.fungal_humidity',
      fallback: 'Humid weather raises fungal-disease pressure.',
    });
  }
  if (issueId === ISSUES.NUTRIENT_DEFICIENCY && rainProb != null && rainProb <= 20) {
    return Object.freeze({
      key:      'scan.alt.reason.dry_nutrient',
      fallback: 'Dry conditions can mask nutrient uptake stress.',
    });
  }
  if (_str(regionalPressure).toLowerCase() === 'outbreak'
      && issueId === ISSUES.SPOTS_OR_DISEASE) {
    return Object.freeze({
      key:      'scan.alt.reason.regional_outbreak',
      fallback: 'A regional outbreak of this issue is active.',
    });
  }
  return null;
}

// ─── Confidence reconciliation ─────────────────────────────

function _reconcileConfidence({ visualLabel, hybrid, contextSignals, history }) {
  const visual     = _confidenceToScore(visualLabel || (hybrid && hybrid.confidence));
  // Contextual confidence = how strongly the context supports the
  // verdict. We treat any context-raising signal as a +0.10 boost,
  // any context-lowering signal as a -0.05 nudge.
  let contextual = 0.50;
  if (contextSignals) {
    if (Array.isArray(contextSignals.raising)) contextual += contextSignals.raising.length * 0.10;
    if (Array.isArray(contextSignals.lowering)) contextual -= contextSignals.lowering.length * 0.05;
    contextual = Math.max(0.1, Math.min(0.9, contextual));
  }
  // Historical confidence = repeat detections raise it slightly,
  // resolved-but-now-back drops it slightly (the user has data on
  // this not working).
  let historical = 0.50;
  if (history) {
    if (history.recurring) historical += 0.10;
    if (history.recoveryTrend === 'worsening') historical += 0.05;
    if (history.recoveryTrend === 'improving') historical -= 0.05;
    historical = Math.max(0.1, Math.min(0.9, historical));
  }
  // Blended — weighted average favouring visual but bounded.
  const blended = Math.max(0.05, Math.min(0.95,
    visual * 0.55 + contextual * 0.30 + historical * 0.15));
  return {
    visual:     Number(visual.toFixed(2)),
    contextual: Number(contextual.toFixed(2)),
    historical: Number(historical.toFixed(2)),
    blended:    Number(blended.toFixed(2)),
  };
}

// ─── "Why we think this" rows ──────────────────────────────

function _whyWeThinkThis({ hybrid, focus, weather, regionalPressure, recurring }) {
  const rows = [];
  // From hybrid's contextType + reason
  if (hybrid && hybrid.reason) {
    rows.push(Object.freeze({
      key: 'scan.why.engine', fallback: hybrid.reason,
    }));
  }
  // From focus engine — confirms image quality / isolation
  if (focus && focus.ok) {
    rows.push(Object.freeze({
      key:      'scan.why.focus_isolated',
      fallback: 'We isolated the leaf from the background and looked at it directly.',
    }));
    if (focus.metrics && focus.metrics.lesionBBox) {
      rows.push(Object.freeze({
        key:      'scan.why.lesion_found',
        fallback: 'We found a discoloured patch on the leaf and zoomed in on it.',
      }));
    }
  }
  // Weather
  const humidity = _num(weather && weather.humidityPct);
  if (humidity != null && humidity >= 70) {
    rows.push(Object.freeze({
      key:      'scan.why.humid_weather',
      fallback: 'Recent weather has been humid — fungal pressure is up.',
    }));
  }
  // Regional pressure
  if (_str(regionalPressure).toLowerCase() === 'outbreak') {
    rows.push(Object.freeze({
      key:      'scan.why.regional_outbreak',
      fallback: 'A regional outbreak of this issue is active.',
    }));
  } else if (_str(regionalPressure).toLowerCase() === 'rising') {
    rows.push(Object.freeze({
      key:      'scan.why.regional_rising',
      fallback: 'Reports of this issue are rising in your region.',
    }));
  }
  // History
  if (recurring) {
    rows.push(Object.freeze({
      key:      'scan.why.recurring',
      fallback: 'You scanned this same issue recently — it may have come back.',
    }));
  }
  return rows;
}

// ─── Orchestrator ──────────────────────────────────────────

/**
 * Main entry point. Returns the V12 envelope.
 *
 * @param {object} input
 * @param {object} [input.scanResult]   — analyzeScan output (post-hybrid)
 * @param {object} [input.focusContext] — leafFocusEngine output
 * @param {string} [input.crop]
 * @param {string} [input.cropStage]
 * @param {string} [input.region]
 * @param {string} [input.country]
 * @param {object} [input.weather]
 * @param {Array}  [input.scanHistory]
 * @param {object} [input.soilSignal]
 * @param {'farm'|'garden'|'generic'} [input.activeExperience]
 */
export function runContextDiagnosis(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const scanResult = _isObj(safe.scanResult) ? safe.scanResult : {};
    const focus      = _isObj(safe.focusContext) ? safe.focusContext : null;
    const weather    = _isObj(safe.weather) ? safe.weather : null;
    const history    = Array.isArray(safe.scanHistory) ? safe.scanHistory : [];

    // 1. Re-run hybrid to combine image + weather + crop into a
    //    canonical envelope. The orchestrator may receive the
    //    already-blended result from analyzeScan; calling
    //    hybridAnalyze again is idempotent and gives us a stable
    //    contract independent of the caller's shape.
    const hybrid = _safe(() => hybridAnalyze({
      imageResult:      scanResult,
      plantName:        scanResult && scanResult.plantName,
      cropName:         safe.crop,
      activeExperience: safe.activeExperience,
      country:          safe.country,
      region:           safe.region,
      weather,
      sizeSqFt:         safe.sizeSqFt,
      growingSetup:     safe.growingSetup,
    }), { possibleIssue: scanResult.possibleIssue, confidence: 'low' });

    // 2. Context-aware explainability envelope.
    const explain = _safe(() => composeContextAwareDiagnosis({
      classifierResult: scanResult,
      crop:             safe.crop,
      lifecycle:        { currentStage: safe.cropStage },
      weather,
      scanHistory:      history,
      soilRisk:         (safe.soilSignal && safe.soilSignal.risk) || null,
    }), {});

    // 3. Regional pressure + outbreak signals.
    const regional = _safe(() => aggregateRegionalScans({
      country:       safe.country,
      region:        safe.region,
      crop:          safe.crop,
      issueCategory: hybrid && hybrid.possibleIssue,
    }), null);
    const regionalPressure = (regional && regional.pressure) || REGIONAL_PRESSURE.NORMAL;

    // 4. Historical signals — recurrence + recovery trend.
    const memory = _safe(() => summariseDiseaseMemory({
      scanHistory:   history,
      issueCategory: hybrid && hybrid.possibleIssue,
    }), {});
    const recurring     = _safe(() => isRecurringIssue(history, hybrid && hybrid.possibleIssue), false);
    const recoveryTrend = _safe(() => recoveryTrendFor(history, hybrid && hybrid.possibleIssue), null);

    // 5. Severity.
    const severity = _deriveSeverity({
      hybrid, regionalPressure, recurring, recoveryTrend, focus,
    });

    // 6. Follow-up window + monitoring + escalation.
    const followUpWindowDays = _followUpWindowDays(severity, safe.cropStage);
    const monitoringNeeded = _monitoringNeeded(severity, recurring, recoveryTrend);

    // 7. Confidence reconciliation.
    const reconciliation = _reconcileConfidence({
      visualLabel: scanResult && scanResult.confidence,
      hybrid,
      contextSignals: {
        raising:  explain && explain.contextRaisingRisk,
        lowering: explain && explain.contextLoweringRisk,
      },
      history: { recurring, recoveryTrend },
    });
    const confidenceScore = reconciliation.blended;
    const confidence = _scoreToConfidence(confidenceScore);

    // 8. Escalation.
    const escalation = _escalationRecommendation({
      severity, confidenceScore, regionalPressure,
    });

    // 9. Treatment + prevention split from hybrid's recommended actions.
    const { treatment, prevention } = _splitTreatmentPrevention(
      hybrid && hybrid.recommendedActions,
    );

    // 10. Alternatives.
    const alternatives = _alternativePossibilities({
      primaryIssue:     hybrid && hybrid.possibleIssue,
      weather,
      regionalPressure,
      recurring,
      hybrid,
    });

    // 11. Why-we-think rows.
    const why = _whyWeThinkThis({
      hybrid, focus, weather, regionalPressure, recurring,
    });

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      likelyIssue: Object.freeze({
        key:      'scan.issue.' + (hybrid && hybrid.possibleIssue || 'needs_review'),
        fallback: (hybrid && hybrid.possibleIssue) || 'Needs review',
        params:   { crop: _str(safe.crop) || null },
      }),
      alternativePossibilities: alternatives,
      confidence,
      confidenceScore,
      severity,
      urgency:    _normalizeUrgency(hybrid && hybrid.urgency),
      treatmentPlan: Object.freeze({
        steps:        treatment.map(_envelopeAction),
        categoryHint: hybrid && hybrid.contextType,
      }),
      preventionPlan: Object.freeze({
        steps: prevention.map(_envelopeAction),
      }),
      followUpWindowDays,
      monitoringNeeded,
      escalationRecommendation: escalation,
      whatFarrowayNoticed: Object.freeze({
        key:      'scan.whatNoticed.summary',
        fallback: (explain && explain.whatWeNoticed)
                  || 'We looked at the leaf and compared it against common patterns.',
      }),
      whyWeThinkThis: why,
      contextLayers: Object.freeze({
        regional:      regional || null,
        weather:       weather || null,
        stage:         safe.cropStage || null,
        history:       memory || null,
        focus:         (focus && focus.guidance) || null,
        recurring,
        recoveryTrend,
      }),
      reconciliation: Object.freeze(reconciliation),
    });
  }, _failureEnvelope());
}

function _failureEnvelope() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    likelyIssue: Object.freeze({
      key:      'scan.issue.needs_review',
      fallback: 'Needs review',
      params:   {},
    }),
    alternativePossibilities: [],
    confidence:               'low',
    confidenceScore:          0.3,
    severity:                 SEVERITY.MILD,
    urgency:                  'low',
    treatmentPlan:            Object.freeze({ steps: [], categoryHint: null }),
    preventionPlan:           Object.freeze({ steps: [] }),
    followUpWindowDays:       7,
    monitoringNeeded:         false,
    escalationRecommendation: null,
    whatFarrowayNoticed: Object.freeze({
      key: 'scan.whatNoticed.fallback',
      fallback: 'We could not read enough from the photo. Try again in better light.',
    }),
    whyWeThinkThis:           [],
    contextLayers:            Object.freeze({}),
    reconciliation:           Object.freeze({ visual: 0.3, contextual: 0.3, historical: 0.5, blended: 0.3 }),
  });
}

export const _internal = Object.freeze({
  SEVERITY, ENGINE_VERSION,
  _deriveSeverity, _followUpWindowDays, _monitoringNeeded,
  _escalationRecommendation, _splitTreatmentPrevention,
  _alternativePossibilities, _reconcileConfidence, _whyWeThinkThis,
  _scoreToConfidence, _confidenceToScore, _normalizeUrgency,
});

const _module = { runContextDiagnosis, _internal };
export default _module;
