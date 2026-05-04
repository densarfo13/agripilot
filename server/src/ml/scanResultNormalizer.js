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
