/**
 * scanDiagnosisNormalizer.js — progressive-certainty diagnosis
 * normalizer for the Scan Disease/Pest spec.
 *
 *   const dx = normalizeDiagnosis(rawScanResult);
 *   // → {
 *   //     cropDetected,
 *   //     conditionCategory,
 *   //     possibleDiseaseOrPest,
 *   //     confidenceLevel,
 *   //     confidencePercent,
 *   //     certaintyLanguage,
 *   //     severity,
 *   //     whyFarrowayThinksThis,
 *   //     actionToday,
 *   //     nextCheck,
 *   //     preventionTip,
 *   //     weatherContext,
 *   //     taskSuggestion,
 *   //     safetyNote,
 *   //   }
 *
 * Why this layer
 * ──────────────
 *   The existing decision envelope (scanResultNormalizer.js) emits
 *   qualitative confidence (low / medium / high). The
 *   Disease/Pest spec demands PERCENT BANDS with progressive
 *   wording rules:
 *
 *     < 50%   "Plant type unclear" / "Possible stress, but more
 *             detail is needed"           (disease name HIDDEN)
 *     50–75%  "Possible" / "May indicate" / "Needs review"
 *     75–90%  "Likely" / "Strong signs of"
 *     90%+    "High likelihood of"
 *
 *   It also mandates:
 *     • broad CONDITION CATEGORY shown before disease name
 *       (Fungal stress / Pest damage / Nutrient stress / Water
 *        stress / Heat stress / Leaf damage / Unknown)
 *     • disease/pest name HIDDEN when confidence < 50%
 *     • safety phrases ONLY from a curated safe list — never
 *       specific pesticide names
 *
 *   This module is the boundary that enforces all three. It sits
 *   above scanResultNormalizer (which doesn't know percent bands)
 *   and below the UI (which doesn't know the spec's wording
 *   gating rules).
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Disease name field returns null when confidence < 50%
 *     (gated even if API supplied a name — spec rule).
 *   • safetyNote is composed from a frozen safe-phrase library;
 *     specific pesticide recommendations are never emitted.
 *   • Banned words ("confirmed", "definitely", "guaranteed") are
 *     defensively replaced anywhere they leak from the engine.
 */

import { hasForbiddenWording } from './confidenceLanguage.js';

// ─── Confidence bands ────────────────────────────────────────

export const CONFIDENCE_BANDS = Object.freeze({
  VERY_LOW:  'very_low',     // < 50% — disease name hidden
  POSSIBLE:  'possible',     // 50-75% — "Possible …"
  LIKELY:    'likely',       // 75-90% — "Likely …"
  HIGH:      'high',         // 90+% — "High likelihood of …"
});

// Certainty-language phrase library per band. Every phrase is
// audited against the spec's banned wording.
const _CERTAINTY_PHRASES = Object.freeze({
  very_low: 'Plant type unclear — try a closer photo',
  possible: 'Possible',
  likely:   'Likely',
  high:     'High likelihood of',
});

// Map percent → band.
function _percentToBand(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return CONFIDENCE_BANDS.VERY_LOW;
  if (pct >= 90) return CONFIDENCE_BANDS.HIGH;
  if (pct >= 75) return CONFIDENCE_BANDS.LIKELY;
  if (pct >= 50) return CONFIDENCE_BANDS.POSSIBLE;
  return CONFIDENCE_BANDS.VERY_LOW;
}

// Map qualitative confidence (low/medium/high) → percent. Used when
// the engine only provided the qualitative tone (no model
// percentage was attached).
function _qualitativeToPercent(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'high')   return 85;
  if (s === 'medium') return 65;
  if (s === 'low')    return 35;
  return null;
}

// ─── Condition categories ────────────────────────────────────

export const CONDITION_CATEGORIES = Object.freeze({
  FUNGAL:    'Fungal stress',
  PEST:      'Pest damage',
  NUTRIENT:  'Nutrient stress',
  WATER:     'Water stress',
  HEAT:      'Heat stress',
  LEAF:      'Leaf damage',
  HEALTHY:   'No issue detected',
  UNKNOWN:   'Unknown',
});

// Keyword → category mapping. Conservative — anything not on the
// list defaults to "Leaf damage" (the safest generic category
// when SOMETHING is wrong but we can't categorise).
const _CATEGORY_KEYWORDS = Object.freeze({
  fungal:   ['fungal', 'fungus', 'mildew', 'blight', 'rust', 'rot', 'mold', 'mould', 'septoria', 'anthracnose'],
  pest:     ['pest', 'aphid', 'mite', 'caterpillar', 'beetle', 'worm', 'larva', 'borer', 'weevil', 'whitefly', 'thrip'],
  nutrient: ['nutrient', 'deficiency', 'nitrogen', 'phosphorus', 'potassium', 'iron', 'magnesium', 'chlorosis'],
  water:    ['drought', 'water stress', 'wilting', 'wilt', 'underwater', 'overwater', 'waterlog'],
  heat:     ['heat stress', 'sunscald', 'sunburn', 'heatwave'],
  leaf:     ['leaf damage', 'leaf spot', 'spots', 'discoloration', 'yellowing', 'curling'],
});

function _inferCategory(safeIssue, safeCategory) {
  const text = `${safeIssue || ''} ${safeCategory || ''}`.toLowerCase();
  if (!text.trim()) return CONDITION_CATEGORIES.UNKNOWN;
  if (text.includes('healthy') || text.includes('no_issue') || text.includes('no issue')) {
    return CONDITION_CATEGORIES.HEALTHY;
  }
  for (const key of Object.keys(_CATEGORY_KEYWORDS)) {
    for (const kw of _CATEGORY_KEYWORDS[key]) {
      if (text.includes(kw)) {
        switch (key) {
          case 'fungal':   return CONDITION_CATEGORIES.FUNGAL;
          case 'pest':     return CONDITION_CATEGORIES.PEST;
          case 'nutrient': return CONDITION_CATEGORIES.NUTRIENT;
          case 'water':    return CONDITION_CATEGORIES.WATER;
          case 'heat':     return CONDITION_CATEGORIES.HEAT;
          case 'leaf':     return CONDITION_CATEGORIES.LEAF;
        }
      }
    }
  }
  return CONDITION_CATEGORIES.LEAF;   // safest default when "something noticed"
}

// ─── Safety-phrase library ───────────────────────────────────

const _SAFE_TREATMENT_PHRASES = Object.freeze([
  'Inspect affected leaves',
  'Avoid overhead watering',
  'Remove heavily damaged leaves',
  'Consult a local agronomist before applying chemicals',
]);

// Pick a safety phrase based on category. Always returns a curated
// safe phrase — never a specific pesticide name.
function _safetyNoteFor(category) {
  switch (category) {
    case CONDITION_CATEGORIES.FUNGAL:
      return 'Avoid overhead watering. Consult a local agronomist before applying chemicals.';
    case CONDITION_CATEGORIES.PEST:
      return 'Inspect affected leaves. Consult a local agronomist before applying chemicals.';
    case CONDITION_CATEGORIES.LEAF:
      return 'Remove heavily damaged leaves and dispose of them away from healthy plants.';
    case CONDITION_CATEGORIES.WATER:
    case CONDITION_CATEGORIES.HEAT:
    case CONDITION_CATEGORIES.NUTRIENT:
      return 'Inspect affected plants. Consult a local agronomist before applying chemicals.';
    case CONDITION_CATEGORIES.HEALTHY:
      return null;
    default:
      return 'Inspect the area in good light. Consult a local agronomist if symptoms spread.';
  }
}

// ─── Banned wording defensive guard ──────────────────────────

const _BANNED_PATTERNS = Object.freeze([
  /\bconfirmed\b/i,
  /\bdefinitely\b/i,
  /\bguaranteed\b/i,
  /\bcertain(?:ly)?\b/i,
]);

function _stripBanned(text) {
  if (!text) return text;
  let out = String(text);
  for (const re of _BANNED_PATTERNS) {
    if (re.test(out)) {
      // Replace the banned word with calm equivalent.
      out = out
        .replace(/\bconfirmed\b/ig, 'noticed')
        .replace(/\bdefinitely\b/ig, 'likely')
        .replace(/\bguaranteed\b/ig, 'likely')
        .replace(/\bcertainly\b/ig, 'likely')
        .replace(/\bcertain\b/ig, 'likely');
    }
  }
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _safePercent(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.min(100, Math.round(v)));
  }
  return fallback != null ? fallback : null;
}

// ─── Disease-name composer (gated by confidence band) ───────

/**
 * Compose the "possibleDiseaseOrPest" string per the spec's gating
 * rules. Returns null when confidence is very_low — disease names
 * are HIDDEN below 50% per spec §4.
 *
 *   high       "High likelihood of early blight"
 *   likely     "Likely aphid damage" / "Strong signs of mildew"
 *   possible   "Possible early blight"
 *   very_low   null  (hide)
 */
function _composeDiseaseName(rawName, band) {
  if (band === CONFIDENCE_BANDS.VERY_LOW) return null;
  const name = _safeStr(rawName);
  if (!name) return null;

  const lower = name.toLowerCase();
  switch (band) {
    case CONFIDENCE_BANDS.HIGH:
      return `High likelihood of ${lower}`;
    case CONFIDENCE_BANDS.LIKELY:
      return `Likely ${lower}`;
    case CONFIDENCE_BANDS.POSSIBLE:
    default:
      return `Possible ${lower}`;
  }
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Normalize a scan engine result into the disease/pest-aware
 * 14-field shape the spec requires.
 *
 * @param {object} rawResult           — engine return (decision envelope shape)
 * @param {object} [options]
 * @param {number} [options.confidencePercentOverride]
 *                                      — when the engine emits a real
 *                                        model percent, pass it here.
 * @returns {object} 14-field canonical diagnosis shape
 */
export function normalizeDiagnosis(rawResult, options) {
  const safe = (rawResult && typeof rawResult === 'object') ? rawResult : {};
  const opts = (options && typeof options === 'object') ? options : {};
  const decision = (safe.decision && typeof safe.decision === 'object') ? safe.decision : {};

  // ── Crop detected ──────────────────────────────────────────
  const cropDetected = _safeStr(decision.cropDetected)
                    || _safeStr(safe.cropName)
                    || _safeStr(safe.crop);

  // ── Confidence percent + band ──────────────────────────────
  const explicitPercent = _safePercent(opts.confidencePercentOverride);
  const enginePercent = _safePercent(safe.confidencePercent);
  const qualitative = decision.confidenceTone || safe.confidence;
  const confidencePercent = explicitPercent
                         ?? enginePercent
                         ?? _qualitativeToPercent(qualitative)
                         ?? 35;   // ultra-conservative default
  const band = _percentToBand(confidencePercent);
  const certaintyLanguage = _CERTAINTY_PHRASES[band];

  // ── Condition category (always shown before disease name) ──
  const rawIssue = _safeStr(decision.issueDetected) || _safeStr(safe.possibleIssue);
  const rawCategory = _safeStr(safe.category);
  const conditionCategory = _inferCategory(rawIssue, rawCategory);

  // ── Disease/pest name (HIDDEN when band === very_low) ──────
  const possibleDiseaseOrPest = _composeDiseaseName(rawIssue, band);

  // ── Severity ───────────────────────────────────────────────
  const severity = _safeStr(decision.severityTone)
                || _safeStr(safe.severity)
                || (conditionCategory === CONDITION_CATEGORIES.HEALTHY ? 'low' : 'medium');

  // ── Why Farroway thinks this ───────────────────────────────
  let whyFarrowayThinksThis = _safeStr(decision.whatItMeans)
                           || _safeStr(safe.hybridReason)
                           || (band === CONFIDENCE_BANDS.VERY_LOW
                                ? 'The photo did not give enough detail to be sure.'
                                : 'Visible patterns match this category of issue.');
  whyFarrowayThinksThis = _stripBanned(whyFarrowayThinksThis);

  // ── Action today ───────────────────────────────────────────
  let actionToday = _safeStr(decision.actionToday)
                 || (band === CONFIDENCE_BANDS.VERY_LOW
                      ? 'Try a closer photo in good light.'
                      : 'Take a closer look in good light today.');
  actionToday = _stripBanned(actionToday);

  // ── Next check ─────────────────────────────────────────────
  const nextCheck = _safeStr(decision.nextCheck) || 'Check again tomorrow morning.';

  // ── Prevention tip ─────────────────────────────────────────
  let preventionTip = null;
  switch (conditionCategory) {
    case CONDITION_CATEGORIES.FUNGAL:
      preventionTip = 'Improve airflow between plants and avoid wet leaves at night.';
      break;
    case CONDITION_CATEGORIES.PEST:
      preventionTip = 'Walk the field weekly and check the undersides of leaves.';
      break;
    case CONDITION_CATEGORIES.WATER:
      preventionTip = 'Water at dawn so leaves dry before midday heat.';
      break;
    case CONDITION_CATEGORIES.HEAT:
      preventionTip = 'Mulch the soil to keep roots cooler during peak heat.';
      break;
    case CONDITION_CATEGORIES.NUTRIENT:
      preventionTip = 'Rotate crops next season and consider a soil test.';
      break;
    default:
      preventionTip = null;
  }

  // ── Weather context (never fabricated) ─────────────────────
  const weatherContext = _safeStr(decision.weatherCaution);

  // ── Task suggestion ────────────────────────────────────────
  const taskTitle = band === CONFIDENCE_BANDS.VERY_LOW
    ? `Rescan ${cropDetected || 'crop'} with a closer photo`
    : `Inspect ${cropDetected || 'plant'} — ${conditionCategory.toLowerCase()}`;
  const taskSuggestion = Object.freeze({
    title:     taskTitle,
    actionType: band === CONFIDENCE_BANDS.VERY_LOW ? 'scan' : 'inspect',
    urgency:   severity === 'high' ? 'high' : (band === CONFIDENCE_BANDS.HIGH ? 'medium' : 'low'),
    reason:    whyFarrowayThinksThis,
  });

  // ── Safety note ────────────────────────────────────────────
  const safetyNote = _safetyNoteFor(conditionCategory);

  // ── Final defensive sanitiser (any leaked technical wording
  //    from the engine gets a soft clamp) ────────────────────
  const sanitisedWhy = hasForbiddenWording(whyFarrowayThinksThis)
    ? 'Visible patterns match this category of issue.'
    : whyFarrowayThinksThis;

  return Object.freeze({
    cropDetected,
    conditionCategory,
    possibleDiseaseOrPest,
    confidenceLevel:   band,
    confidencePercent,
    certaintyLanguage,
    severity,
    whyFarrowayThinksThis: sanitisedWhy,
    actionToday,
    nextCheck,
    preventionTip,
    weatherContext,
    taskSuggestion,
    safetyNote,
  });
}

/**
 * Read-only access to the safety-phrase library — useful for
 * settings UIs and tests asserting we don't drift from the curated
 * list.
 */
export function getSafeTreatmentPhrases() {
  return _SAFE_TREATMENT_PHRASES.slice();
}

export default {
  CONFIDENCE_BANDS,
  CONDITION_CATEGORIES,
  normalizeDiagnosis,
  getSafeTreatmentPhrases,
};
