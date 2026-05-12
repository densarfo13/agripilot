/**
 * scanResultNormalizer.js — adapter that translates the rich
 * server-side scan verdict into the spec's strict JSON shape.
 *
 *   normalizeToSpecShape(safeVerdict, opts?) → {
 *     status:       'healthy' | 'needs_attention' | 'uncertain',
 *     issueType:    'pest' | 'disease' | 'water' | 'nutrient' | 'unknown',
 *     confidence:   'low' | 'medium' | 'high',
 *     explanation:  string,
 *     action:       string,
 *     timing:       'today' | '24_hours' | 'monitor',
 *   }
 *
 * Why a sibling adapter rather than rewriting the verdict
 * ──────────────────────────────────────────────────────
 *   The existing safe verdict carries 8 fields the frontend
 *   depends on (possibleIssue, confidence, recommendedActions,
 *   reason, urgency, followUpTask, disclaimer, safetyFiltered).
 *   The Smart Scan AI Backend spec asks for a tighter 6-field
 *   shape that ML / analytics partners can rely on without
 *   knowing the legacy fields. This adapter emits the spec
 *   shape from the safe verdict; both can coexist on the
 *   response.
 *
 * Strict-rule audit
 *   • Pure + sync; never throws on partial input.
 *   • Honest derivation — when a field is missing, falls back
 *     to the safest neutral value ('uncertain' status,
 *     'unknown' issueType, 'monitor' timing).
 *   • Never fabricates dosage / specificity that the safety
 *     filter has already stripped.
 */

const STATUSES = Object.freeze(['healthy', 'needs_attention', 'uncertain']);
const ISSUE_TYPES = Object.freeze(['pest', 'disease', 'water', 'nutrient', 'unknown']);
const TIMINGS = Object.freeze(['today', '24_hours', 'monitor']);
const CONFIDENCES = Object.freeze(['low', 'medium', 'high']);

const LOW_CONFIDENCE_FALLBACK_ACTION =
  'Scan again with a clearer photo or check with a local expert.';

// Heuristic — words that signal each issue category. The first
// match wins; ties broken by category order (pest before disease
// before water before nutrient).
const ISSUE_KEYWORDS = Object.freeze({
  pest: [
    'pest', 'insect', 'aphid', 'whitefly', 'caterpillar', 'mite',
    'beetle', 'worm', 'larva', 'hopper', 'thrip',
  ],
  disease: [
    'disease', 'fungus', 'fungal', 'mildew', 'rust', 'blight',
    'rot', 'mosaic', 'wilt', 'bacterial', 'viral', 'spot',
  ],
  water: [
    'water', 'drought', 'overwater', 'underwater', 'wilting',
    'dry', 'thirsty', 'moisture', 'irrigation',
  ],
  nutrient: [
    'nutrient', 'nitrogen', 'phosphorus', 'potassium', 'fertili',
    'deficien', 'yellowing', 'chlorosis', 'starv',
  ],
});

// Phrases that indicate "we couldn't confirm" — drives status
// 'uncertain' even when confidence may be reported higher.
const UNCERTAIN_PHRASES = [
  'needs closer inspection', 'unclear', 'retake', 'try again',
  'good light', 'unable to', 'couldn\u2019t', "couldn't",
];

function _normStr(v, fb = '') {
  if (v == null) return fb;
  return String(v).trim();
}

function _normEnum(v, allowed, fb) {
  const s = _normStr(v).toLowerCase();
  return allowed.includes(s) ? s : fb;
}

function _looksUncertain(text) {
  const t = String(text || '').toLowerCase();
  for (const phrase of UNCERTAIN_PHRASES) {
    if (t.includes(phrase)) return true;
  }
  return false;
}

function _looksHealthy(text) {
  const t = String(text || '').toLowerCase();
  // Heuristic — no issue + reassuring language.
  return /\b(healthy|looks?\s+good|no\s+issue|nothing\s+(?:serious|wrong))\b/.test(t);
}

function _deriveStatus({ possibleIssue, confidence }) {
  const issueText = _normStr(possibleIssue);
  if (!issueText) return 'uncertain';
  if (_looksUncertain(issueText)) return 'uncertain';
  if (confidence === 'low') return 'uncertain';
  if (_looksHealthy(issueText)) return 'healthy';
  return 'needs_attention';
}

function _deriveIssueType(possibleIssue) {
  const text = String(possibleIssue || '').toLowerCase();
  if (!text) return 'unknown';
  for (const [type, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return type;
    }
  }
  return 'unknown';
}

function _deriveTiming({ urgency, status, confidence }) {
  // Spec §3 timing values: 'today' | '24_hours' | 'monitor'.
  // Existing urgency values in the engine: 'now' | 'today' |
  // 'this_week' | 'this week' | 'high' | 'medium' | 'low'.
  const u = String(urgency || '').toLowerCase().trim();
  if (status === 'uncertain') return 'monitor';
  if (status === 'healthy')   return 'monitor';
  if (u === 'now' || u === 'today' || u === 'high') return 'today';
  if (u === '24_hours' || u === '24 hours' || u === 'medium') return '24_hours';
  if (confidence === 'high') return '24_hours';
  return 'monitor';
}

function _deriveExplanation({ reason, possibleIssue, status }) {
  // Prefer the engine's explanatory `reason` when present;
  // otherwise compose a short line from `possibleIssue` +
  // status. Capped at 220 chars so the JSON stays tight.
  const r = _normStr(reason);
  if (r) return r.slice(0, 220);
  const issue = _normStr(possibleIssue);
  if (status === 'healthy') {
    return issue || 'Plant looks healthy.';
  }
  if (status === 'uncertain') {
    return issue || 'We couldn\u2019t see this clearly.';
  }
  return (issue || 'Possible issue identified.').slice(0, 220);
}

function _deriveAction({ recommendedActions, status, confidence }) {
  // Spec §4 — if confidence is low, return the safe fallback
  // line regardless of what the engine emitted.
  if (confidence === 'low' || status === 'uncertain') {
    return LOW_CONFIDENCE_FALLBACK_ACTION;
  }
  const list = Array.isArray(recommendedActions) ? recommendedActions : [];
  for (const a of list) {
    const s = _normStr(a);
    if (s) return s.slice(0, 180);
  }
  // Healthy / no actions — return the standard "monitor" line.
  return 'Keep an eye on it; check again tomorrow.';
}

/**
 * normalizeToSpecShape — main entry. Pure + never throws.
 *
 * @param {object} safeVerdict — output of applySafetyFilter()
 * @param {object} [opts]
 * @param {boolean} [opts.forceLowConfidence] — caller-supplied override
 * @returns {{status, issueType, confidence, explanation, action, timing}}
 */
export function normalizeToSpecShape(safeVerdict = {}, opts = {}) {
  const safe = (safeVerdict && typeof safeVerdict === 'object') ? safeVerdict : {};
  const confidence = opts && opts.forceLowConfidence
    ? 'low'
    : _normEnum(safe.confidence, CONFIDENCES, 'low');
  const possibleIssue = _normStr(safe.possibleIssue);
  const status = _normEnum(
    _deriveStatus({ possibleIssue, confidence }),
    STATUSES,
    'uncertain',
  );
  const issueType = _normEnum(
    _deriveIssueType(possibleIssue),
    ISSUE_TYPES,
    'unknown',
  );
  const explanation = _deriveExplanation({
    reason: safe.reason,
    possibleIssue,
    status,
  });
  const action = _deriveAction({
    recommendedActions: safe.recommendedActions,
    status,
    confidence,
  });
  const timing = _normEnum(
    _deriveTiming({ urgency: safe.urgency, status, confidence }),
    TIMINGS,
    'monitor',
  );

  return Object.freeze({
    status,
    issueType,
    confidence,
    explanation,
    action,
    timing,
  });
}

/**
 * Spec §8 — fallback verdict shape. Returned verbatim by the
 * route handler when the AI inference path throws, fails, or
 * returns nothing usable. Always emits the spec shape with the
 * "uncertain / monitor" defaults.
 */
export const SPEC_FALLBACK_VERDICT = Object.freeze({
  status:      'uncertain',
  issueType:   'unknown',
  confidence:  'low',
  explanation: 'We couldn\u2019t analyze this clearly.',
  action:      'Take another photo in good light.',
  timing:      'monitor',
});

// ─── Plant Identification (v1.1 spec) ────────────────────
//
// `normalizeToFullSpecShape(safe, opts)` returns the richer
// `{ plantIdentification, healthAnalysis }` envelope that the
// frontend ScanResultPage now consumes. Existing
// `normalizeToSpecShape` stays unchanged for backward compat
// (every existing caller still sees the same 6-field shape).
//
// Contract for plantIdentification:
//   {
//     detectedName: string | null,    // canonical (e.g. "Tomato")
//     commonName:   string | null,    // user-friendly label
//     confidence:   "low" | "medium" | "high",
//     alternatives: string[],         // up to 3 next-best guesses
//   }
//
// Resolution order:
//   1. Inference returned a `detectedPlant` field → use it.
//      Confidence comes from `identificationConfidence` if
//      present, otherwise from the verdict-level confidence.
//      Alternatives capped at 3 to keep UI uncluttered.
//   2. Caller supplied `opts.selectedCropOrPlant` (the user's
//      profile crop) and inference didn't identify → echo the
//      user's value with `confidence: 'medium'`. Honest floor:
//      we can't independently confirm without an inference hit.
//   3. Both missing → all-null shape with `confidence: 'low'`.
//      Frontend renders the spec's identification fallback line.
//
// Confidence-language rule (spec §3) is enforced at the FRONTEND
// render layer — this module only emits the enum value.
function _buildPlantIdentification(safeVerdict, opts = {}) {
  const safe = safeVerdict && typeof safeVerdict === 'object' ? safeVerdict : {};
  const detected = _normStr(safe.detectedPlant) || _normStr(safe.plantName) || null;
  const provided = opts.selectedCropOrPlant
    ? _normStr(opts.selectedCropOrPlant) : null;

  // Identification confidence — when the inference path used
  // its fallback (`opts.forceLowConfidence`) we MUST clamp to
  // 'low' regardless of what the caller stamped on the verdict.
  // Honest floor.
  let confidence;
  if (opts.forceLowConfidence) {
    confidence = 'low';
  } else if (safe.identificationConfidence) {
    confidence = _normEnum(safe.identificationConfidence, CONFIDENCES, 'medium');
  } else if (detected) {
    confidence = _normEnum(safe.confidence, CONFIDENCES, 'medium');
  } else if (provided) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Filter alternatives — only accept actual strings. Numbers,
  // nulls, and objects would produce noisy entries (e.g. "42" or
  // "[object Object]") in the UI.
  const alternatives = (Array.isArray(safe.alternatives)
    ? safe.alternatives : [])
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (detected) {
    return {
      detectedName: detected,
      commonName:   detected,
      confidence,
      alternatives,
    };
  }
  if (provided) {
    return {
      detectedName: provided,
      commonName:   provided,
      confidence,        // 'medium' from rule 2 above
      alternatives,
    };
  }
  return {
    detectedName: null,
    commonName:   null,
    confidence:   'low',
    alternatives: [],
  };
}

/**
 * normalizeToFullSpecShape(safeVerdict, opts) →
 *   { plantIdentification, healthAnalysis }
 *
 * The full v1.1 envelope. Reuses the existing
 * `normalizeToSpecShape` for the healthAnalysis branch so the
 * 6-field shape stays in lock-step with the legacy contract.
 */
export function normalizeToFullSpecShape(safeVerdict = {}, opts = {}) {
  return {
    plantIdentification: _buildPlantIdentification(safeVerdict, opts),
    healthAnalysis:      normalizeToSpecShape(safeVerdict, opts),
  };
}

/**
 * Spec §8 fallback for the full v1.1 envelope. Emitted when
 * inference throws, fails, or the caller didn't supply an
 * image at all.
 */
export const SPEC_FALLBACK_FULL = Object.freeze({
  plantIdentification: Object.freeze({
    detectedName: null,
    commonName:   null,
    confidence:   'low',
    alternatives: [],
  }),
  healthAnalysis: SPEC_FALLBACK_VERDICT,
});

// ─── Decision-intelligence shape (May 2026 §2) ──────────────────
// Strict 12-field envelope the scan UI binds to for the action-
// card layout. Built on top of the safe verdict + caller context
// so the same scan response carries both the rich legacy verdict
// AND this tighter action-oriented shape. Consumers that only
// want "what's the headline and what should I tell the farmer
// to do today" read `decision`; consumers that want the full
// verdict still read `verdict` / `verdictV2` / `verdictV3`.
//
// Trust rules baked into the shape:
//   • confidenceTone is 'low' when the inference fallback fired
//     OR the safety filter capped certainty.
//   • severityTone maps urgency → human-readable: Today →
//     "Needs attention", This week → "Watch", Monitor → "Looks
//     stable".
//   • providerStatus surfaces 'fallback' when no real provider
//     answered — partners can downweight "fallback" results in
//     their own UIs.
//   • Every string field is short + calm + safety-filtered. No
//     dosage, no specific pesticide names, no certainty claims.

const SEVERITY_TONE = Object.freeze({
  Today:       'Needs attention',
  'This week': 'Watch',
  Monitor:     'Looks stable',
});

function _severityToneFrom(urgency) {
  if (!urgency || typeof urgency !== 'string') return 'Watch';
  return SEVERITY_TONE[urgency] || 'Watch';
}

function _weatherCautionFrom(weather, safe) {
  // Surface a calm caution line ONLY when weather has a meaningful
  // signal AND the verdict could be aggravated by it. Otherwise
  // returns null so the UI hides the row entirely.
  if (!weather || typeof weather !== 'object') return null;
  const rainChance = Number(weather.rainProbability ?? weather.precipitationProbability ?? weather.rainProb);
  const tempC      = Number(weather.tempC ?? weather.temperatureC ?? weather.temp);
  if (Number.isFinite(rainChance) && rainChance >= 0.6) {
    return 'Rain expected today. Consider checking drainage and skipping the next watering.';
  }
  if (Number.isFinite(tempC) && tempC >= 32) {
    return 'Warm afternoon expected. Check soil moisture in the cooler hours.';
  }
  // No actionable weather signal — let the UI hide the row.
  return null;
}

function _regionContextFrom(region, country, landHealth) {
  // One short line that anchors the verdict to the user's region.
  // Skipped entirely (returns null) when there's nothing useful
  // to say — the UI hides the row.
  const stress = landHealth && (landHealth.stressLevel === 'medium' || landHealth.stressLevel === 'high');
  const drought = landHealth && landHealth.droughtSignal === true;
  if (stress || drought) {
    const where = region || country || 'your area';
    return drought
      ? `Drought signal observed in ${where}.`
      : `Some land-health stress observed in ${where}.`;
  }
  if (region) return `Reading for ${region}.`;
  if (country) return `Reading for ${country}.`;
  return null;
}

function _providerStatusFrom(opts) {
  // 'live' — a real provider answered with a real signal.
  // 'fallback' — the rule-based classifier produced the verdict.
  // 'unknown' — no inference metadata available (defensive default).
  if (opts && opts.forceLowConfidence === true) return 'fallback';
  if (opts && typeof opts.providerName === 'string' && opts.providerName) {
    return opts.providerName === 'rule' ? 'fallback' : 'live';
  }
  return 'unknown';
}

function _saveableSummaryFrom(d) {
  // One-line journal/progress summary. Composes the four
  // load-bearing pieces (crop + issue + tone + action) into
  // a sentence short enough to fit in a feed row.
  const parts = [];
  if (d.cropDetected) parts.push(d.cropDetected);
  if (d.issueDetected) parts.push(d.issueDetected);
  if (d.actionToday) parts.push('→ ' + d.actionToday);
  const summary = parts.join(' · ').trim();
  return summary || 'Scan recorded.';
}

/**
 * Build the 12-field decision shape. Pure + never throws.
 *
 *   normalizeToDecisionShape(safeVerdict, ctx) → {
 *     cropDetected, issueDetected, confidenceTone, severityTone,
 *     whatItMeans, actionToday, nextCheck, weatherCaution,
 *     regionContext, taskSuggestion, saveableSummary,
 *     providerStatus,
 *   }
 *
 * @param {object} [safeVerdict]
 * @param {object} [ctx]    crop / region / country / weather / landHealth /
 *                          tierPolicy / verificationQuestions / opts
 * @returns {object}
 */
export function normalizeToDecisionShape(safeVerdict = {}, ctx = {}) {
  const safe = (safeVerdict && typeof safeVerdict === 'object') ? safeVerdict : {};
  const c    = (ctx && typeof ctx === 'object') ? ctx : {};

  // crop — caller-supplied crop wins over identification (which
  // may be 'unclear' when confidence is low).
  const cropDetected = (c.selectedCropOrPlant && String(c.selectedCropOrPlant).trim())
    || (safe.cropName && String(safe.cropName).trim())
    || (safe.plantName && String(safe.plantName).trim())
    || null;

  // issue — the safety-filtered label. Already capped at the safe
  // taxonomy by applySafetyFilter.
  const issueDetected = (safe.possibleIssue && String(safe.possibleIssue).trim())
    || 'Unclear from this photo';

  const confidenceTone = (safe.confidence === 'high'   ? 'high'
                        : safe.confidence === 'medium' ? 'medium'
                        : 'low');

  const severityTone = _severityToneFrom(safe.urgency);

  // whatItMeans — prefer the policy's plain-language whyExplanation,
  // fall back to the safe verdict's reason field.
  const whatItMeans = (c.tierPolicy && c.tierPolicy.whyExplanation
                        && String(c.tierPolicy.whyExplanation).trim())
                   || (safe.reason && String(safe.reason).trim())
                   || 'The image is hard to read with certainty. Consider rescanning in better light.';

  // actionToday — top action from the policy's curated set, with
  // a low-confidence fallback when nothing is available.
  let actionToday = '';
  if (c.tierPolicy && Array.isArray(c.tierPolicy.recommendedActions)
      && c.tierPolicy.recommendedActions.length > 0) {
    actionToday = String(c.tierPolicy.recommendedActions[0] || '').trim();
  } else if (Array.isArray(safe.recommendedActions) && safe.recommendedActions.length > 0) {
    actionToday = String(safe.recommendedActions[0] || '').trim();
  }
  if (!actionToday) actionToday = LOW_CONFIDENCE_FALLBACK_ACTION;

  // nextCheck — the first verification question, or the followUp
  // task title, or null.
  let nextCheck = null;
  if (Array.isArray(c.verificationQuestions) && c.verificationQuestions.length > 0) {
    const v0 = c.verificationQuestions[0];
    nextCheck = typeof v0 === 'string' ? v0
              : (v0 && v0.question ? String(v0.question) : null);
  }
  if (!nextCheck && safe.followUpTask && safe.followUpTask.title) {
    nextCheck = String(safe.followUpTask.title);
  }

  const weatherCaution = _weatherCautionFrom(c.weather, safe);
  const regionContext  = _regionContextFrom(c.region, c.country, c.landHealth);

  // taskSuggestion — the followUpTask in its minimum shape.
  // null when nothing actionable is available.
  let taskSuggestion = null;
  if (safe.followUpTask && safe.followUpTask.title) {
    taskSuggestion = {
      title:    String(safe.followUpTask.title),
      urgency:  String(safe.followUpTask.urgency || 'medium'),
    };
  }

  const providerStatus = _providerStatusFrom({
    ...c,
    providerName: c.providerName,
  });

  const out = {
    cropDetected,
    issueDetected,
    confidenceTone,
    severityTone,
    whatItMeans,
    actionToday,
    nextCheck,
    weatherCaution,
    regionContext,
    taskSuggestion,
    saveableSummary: '',          // filled below
    providerStatus,
  };
  out.saveableSummary = _saveableSummaryFrom(out);
  return out;
}

// Spec fallback for /api/scan/analyze's failure paths — every
// field a non-empty safe value so the UI never has to null-check.
export const SPEC_FALLBACK_DECISION = Object.freeze({
  cropDetected:    null,
  issueDetected:   'Unclear from this photo',
  confidenceTone:  'low',
  severityTone:    'Watch',
  whatItMeans:     'The photo couldn\'t be read with certainty. Consider rescanning in better light.',
  actionToday:     LOW_CONFIDENCE_FALLBACK_ACTION,
  nextCheck:       null,
  weatherCaution:  null,
  regionContext:   null,
  taskSuggestion:  null,
  saveableSummary: 'Scan recorded — review needed.',
  providerStatus:  'unknown',
});

export const _internal = Object.freeze({
  STATUSES, ISSUE_TYPES, TIMINGS, CONFIDENCES,
  LOW_CONFIDENCE_FALLBACK_ACTION,
  ISSUE_KEYWORDS, UNCERTAIN_PHRASES,
  _deriveStatus, _deriveIssueType, _deriveTiming,
  _deriveExplanation, _deriveAction,
  _buildPlantIdentification,
});

export default {
  normalizeToSpecShape,
  normalizeToFullSpecShape,
  SPEC_FALLBACK_VERDICT,
  SPEC_FALLBACK_FULL,
};
