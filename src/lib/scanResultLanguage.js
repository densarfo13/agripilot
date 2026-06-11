/**
 * scanResultLanguage.js — category-aware calm scan-result language.
 *
 *   const strings = composeScanResultStrings(scanResult);
 *   //  → {
 *   //      category:    'crop' | 'garden' | 'grass' | 'unclear' | 'non_plant',
 *   //      status:      'Plant area may need attention',
 *   //      urgency:     { tone: 'YELLOW', label: 'Monitor' },
 *   //      noticed:     'This leaf pattern looks worth a closer look.',
 *   //      action:      'Check lower leaves in good light.',
 *   //      whyUnclear:  null | 'Lighting made detection difficult.',
 *   //      nextCheck:   'Check again tomorrow morning.',
 *   //      retakeHint:  null | 'Try a closer photo of one leaf.',
 *   //    }
 *
 * Why a category-aware language module
 * ────────────────────────────────────
 *   The intelligence stack already enforces "no fake X" and emits
 *   calm phrasings via agronomistReply + nextBestActionNormalizer +
 *   confidenceLanguage. What it doesn't do today is ADAPT the
 *   wording to what the camera actually saw:
 *
 *     • "Crop leaf condition may need review" — fine for a maize farmer
 *     • Same string for a backyard tomato user reads enterprise-y
 *     • Same string for a grass photo is wrong (grass is not a "crop")
 *     • Same string for a hand or chair photo is misleading
 *
 *   This module is the single category-detector + wording-adapter
 *   so every scan-result surface reads from one source. It does
 *   NOT add a new ML model — it infers category from existing
 *   fields the engine already populates (decision.cropDetected,
 *   result.category, result.mlStatus).
 *
 * Strict-rule audit
 *   • Pure functions. Never throw.
 *   • Non-plant detection returns "Plant type unclear" with a
 *     gentle retake hint — never fakes a diagnosis (spec §7).
 *   • Urgency uses ONLY the four spec tones: GREEN / YELLOW /
 *     ORANGE / RED. Wording stays calm at every level — RED
 *     reads "Urgent review recommended" (the spec example),
 *     never "DANGER" / "CRITICAL."
 *   • Sanitised against forbidden patterns via confidenceLanguage's
 *     hasForbiddenWording().
 */

import { hasForbiddenWording } from './confidenceLanguage.js';
// Sprint #190 — translation completeness. tSafe reads the active
// locale at call time, so pure helpers re-resolve on language
// switch without React context.
import { tSafe } from '../i18n/tSafe.js';

// ─── Categories ───────────────────────────────────────────────

export const SCAN_CATEGORIES = Object.freeze({
  CROP:      'crop',
  GARDEN:    'garden',
  GRASS:     'grass',
  UNCLEAR:   'unclear',
  NON_PLANT: 'non_plant',
});

export const URGENCY_TONES = Object.freeze({
  GREEN:  'GREEN',     // stable / healthy / no action needed
  YELLOW: 'YELLOW',    // monitor / check later / low concern
  ORANGE: 'ORANGE',    // attention needed / inspect today
  RED:    'RED',       // urgent review recommended
});

// ─── Helpers ──────────────────────────────────────────────────

function _safeStr(v) {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
}

function _lower(v) {
  return _safeStr(v) ? _safeStr(v).toLowerCase() : null;
}

// Crops recognised as farm-scale (vs garden hobby plants). The
// list is conservative — anything not on it falls to 'garden'
// by default when the experience hint is 'backyard'.
const _FARM_CROPS = new Set([
  'maize', 'corn', 'rice', 'cassava', 'yam', 'plantain', 'banana',
  'cocoa', 'coffee', 'sorghum', 'millet', 'wheat', 'soybean', 'cotton',
  'groundnut', 'peanut', 'sugarcane',
]);

const _GARDEN_PLANTS = new Set([
  'tomato', 'tomatoes', 'pepper', 'peppers', 'lettuce', 'kale',
  'spinach', 'cucumber', 'eggplant', 'basil', 'mint', 'rose',
  'orchid', 'succulent', 'cactus', 'fern', 'houseplant',
]);

const _GRASS_HINTS = new Set([
  'grass', 'lawn', 'turf', 'sod',
]);

// ─── Category detection ───────────────────────────────────────

/**
 * Infer a scan-category from the result envelope.
 *
 *   - 'non_plant' when the engine's category said 'non_plant' or
 *     the verdict explicitly says no plant detected
 *   - 'grass'     when crop name matches a grass-hint word
 *   - 'crop'      when crop name is on the farm-crops list OR the
 *                  experience hint is 'farm'
 *   - 'garden'    when experience hint is 'backyard' OR plant is
 *                  on the garden-plants list
 *   - 'unclear'   when low confidence + nothing else fits
 *
 * @param {object} result   — scan result envelope (any of the
 *                             standard shapes we emit)
 * @returns {'crop'|'garden'|'grass'|'unclear'|'non_plant'}
 */
export function getScanCategory(result) {
  if (!result || typeof result !== 'object') return SCAN_CATEGORIES.UNCLEAR;

  const cat = _lower(result.category);
  if (cat === 'non_plant' || cat === 'no_plant_detected') return SCAN_CATEGORIES.NON_PLANT;

  const decision = (result.decision && typeof result.decision === 'object') ? result.decision : {};
  const crop = _lower(decision.cropDetected) || _lower(result.cropName) || _lower(result.crop);
  const experience = _lower(result.experience);

  if (crop) {
    for (const g of _GRASS_HINTS) {
      if (crop.includes(g)) return SCAN_CATEGORIES.GRASS;
    }
    if (_FARM_CROPS.has(crop)) return SCAN_CATEGORIES.CROP;
    if (_GARDEN_PLANTS.has(crop)) return SCAN_CATEGORIES.GARDEN;
  }

  if (experience === 'farm' || experience === 'farmer')   return SCAN_CATEGORIES.CROP;
  if (experience === 'backyard' || experience === 'garden') return SCAN_CATEGORIES.GARDEN;

  // Low-confidence fallback.
  if (_lower(result.confidence) === 'low'
      || cat === 'needs_review'
      || cat === 'unclear') return SCAN_CATEGORIES.UNCLEAR;

  return SCAN_CATEGORIES.UNCLEAR;
}

// ─── Status string per category ──────────────────────────────

/**
 * Return the calm short-status phrase per spec §1/§2 examples.
 *
 * @param {object} result
 * @param {string} [category]   — pre-computed; defaults to getScanCategory(result)
 * @returns {string}
 */
export function getCalmStatus(result, category) {
  const cat = category || getScanCategory(result);
  // Sprint #190 — i18n completeness: every grower-facing status
  // string routes through tSafe so language switches re-resolve.
  switch (cat) {
    case SCAN_CATEGORIES.CROP:
      return tSafe('scan.calm.crop', 'Leaf condition may need review');
    case SCAN_CATEGORIES.GARDEN:
      return tSafe('scan.calm.garden', 'This plant may need attention');
    case SCAN_CATEGORIES.GRASS:
      return tSafe('scan.calm.grass', 'This area may need a closer look');
    case SCAN_CATEGORIES.NON_PLANT:
      return tSafe('scan.calm.nonPlant', 'Try scanning a leaf, fruit, or plant stem');
    case SCAN_CATEGORIES.UNCLEAR:
    default:
      return tSafe('scan.calm.unclear', 'More detail needed');
  }
}

// ─── Urgency tone ────────────────────────────────────────────

// Sprint #190 — labels resolve at LOOKUP time (function, not a
// frozen module-scope map) so a language switch mid-session
// re-resolves; a frozen constant would capture boot language.
function _urgencyLabel(tone) {
  switch (tone) {
    case 'GREEN':  return tSafe('scan.urgency.stable',    'Looks stable');
    case 'YELLOW': return tSafe('scan.urgency.monitor',   'Monitor');
    case 'ORANGE': return tSafe('scan.urgency.attention', 'Attention needed');
    case 'RED':    return tSafe('scan.urgency.urgent',    'Urgent review recommended');
    default:       return tSafe('scan.urgency.monitor',   'Monitor');
  }
}
const _URGENCY_LABEL = Object.freeze({
  get GREEN()  { return _urgencyLabel('GREEN'); },
  get YELLOW() { return _urgencyLabel('YELLOW'); },
  get ORANGE() { return _urgencyLabel('ORANGE'); },
  get RED()    { return _urgencyLabel('RED'); },
});

/**
 * Map a scan result's severity + confidence + category to one of
 * the four spec urgency tones.
 *
 * Rules:
 *   • non_plant → GREEN (no actionable signal — calm)
 *   • severity 'high'   → RED (or ORANGE for unclear category)
 *   • severity 'medium' → ORANGE
 *   • severity 'low'    → YELLOW
 *   • severity 'healthy' / no_issue → GREEN
 *   • confidence 'low' across the board → YELLOW (the scan itself
 *     is uncertain — calm hold, not escalation)
 *
 * @param {object} result
 * @param {string} [category]
 * @returns {{ tone: string, label: string }}
 */
export function getUrgencyTone(result, category) {
  const cat = category || getScanCategory(result);
  if (cat === SCAN_CATEGORIES.NON_PLANT) {
    return { tone: URGENCY_TONES.GREEN, label: _URGENCY_LABEL.GREEN };
  }

  if (!result || typeof result !== 'object') {
    return { tone: URGENCY_TONES.YELLOW, label: _URGENCY_LABEL.YELLOW };
  }

  const decision = (result.decision && typeof result.decision === 'object') ? result.decision : {};
  const severity = _lower(decision.severityTone) || _lower(result.severity) || _lower(result.category);
  const confidence = _lower(decision.confidenceTone) || _lower(result.confidence);

  // Healthy / no_issue → GREEN
  if (severity === 'healthy' || severity === 'no_issue' || severity === 'no_issue_detected') {
    return { tone: URGENCY_TONES.GREEN, label: _URGENCY_LABEL.GREEN };
  }

  // High severity → RED (escalate cleanly)
  if (severity === 'high') {
    return { tone: URGENCY_TONES.RED, label: _URGENCY_LABEL.RED };
  }

  // Medium severity → ORANGE
  if (severity === 'medium' || severity === 'moderate') {
    return { tone: URGENCY_TONES.ORANGE, label: _URGENCY_LABEL.ORANGE };
  }

  // Low severity → YELLOW
  if (severity === 'low' || severity === 'mild') {
    return { tone: URGENCY_TONES.YELLOW, label: _URGENCY_LABEL.YELLOW };
  }

  // Low confidence + nothing else → YELLOW (calm hold)
  if (confidence === 'low') {
    return { tone: URGENCY_TONES.YELLOW, label: _URGENCY_LABEL.YELLOW };
  }

  // Default → YELLOW (the calmest non-stable state)
  return { tone: URGENCY_TONES.YELLOW, label: _URGENCY_LABEL.YELLOW };
}

// ─── Uncertainty "why" composer ──────────────────────────────

/**
 * When the result's confidence is low, return ONE calm sentence
 * explaining why detection was difficult. Returns null when the
 * result was clear (no uncertainty to explain) — caller skips the
 * block cleanly.
 *
 * Reads from `result.imageQuality` when present (the preflight's
 * stats: low luminance, low sharpness, etc.) and falls back to
 * generic phrasing when no quality stats survived.
 *
 * @param {object} result
 * @returns {string|null}
 */
export function getUncertaintyReason(result) {
  if (!result || typeof result !== 'object') return null;
  const decision = (result.decision && typeof result.decision === 'object') ? result.decision : {};
  const confidence = _lower(decision.confidenceTone) || _lower(result.confidence);
  if (confidence !== 'low') return null;

  // Preflight stats — when present, pick the strongest signal.
  const q = (result.imageQuality && typeof result.imageQuality === 'object')
    ? result.imageQuality
    : (result.stats && typeof result.stats === 'object' ? result.stats : null);
  if (q) {
    const lum = typeof q.luminance === 'number' ? q.luminance : null;
    const sharp = typeof q.sharpness === 'number' ? q.sharpness : null;
    if (lum !== null && lum < 0.2) return 'Lighting made detection difficult.';
    if (lum !== null && lum > 0.95) return 'The photo was washed out.';
    if (sharp !== null && sharp < 0.3) return 'Leaf detail was limited — the photo looked soft.';
  }

  // Generic fallback — one calm sentence.
  return 'Leaf detail was limited.';
}

// ─── Retake hint composer ────────────────────────────────────

/**
 * Visual retake hint when image quality was weak. Returns null
 * when the photo was clear.
 *
 * @param {object} result
 * @returns {string|null}
 */
export function getRetakeHint(result) {
  if (!result || typeof result !== 'object') return null;
  const category = getScanCategory(result);
  if (category === SCAN_CATEGORIES.NON_PLANT) {
    return 'Try focusing on one leaf or plant area.';
  }
  const q = (result.imageQuality && typeof result.imageQuality === 'object')
    ? result.imageQuality
    : (result.stats && typeof result.stats === 'object' ? result.stats : null);
  if (q) {
    const lum = typeof q.luminance === 'number' ? q.luminance : null;
    const sharp = typeof q.sharpness === 'number' ? q.sharpness : null;
    if (lum !== null && lum < 0.2)    return 'Try again in brighter light.';
    if (lum !== null && lum > 0.95)   return 'Move away from direct sunlight.';
    if (sharp !== null && sharp < 0.3) return 'Try a closer photo of one leaf.';
  }
  return null;
}

// ─── Composite helper ────────────────────────────────────────

/**
 * Compose every farmer-facing string the spec's §9 result structure
 * requires. Single-call helper for ScanResultCard adoption.
 *
 * @param {object} result
 * @returns {object}
 */
export function composeScanResultStrings(result) {
  const category = getScanCategory(result);
  const status = getCalmStatus(result, category);
  const urgency = getUrgencyTone(result, category);
  const whyUnclear = getUncertaintyReason(result);
  const retakeHint = getRetakeHint(result);

  // Pull noticed/action/nextCheck from the existing decision
  // envelope when present (the engine already populates them
  // calmly). Fall back to category-aware defaults.
  const decision = (result && result.decision && typeof result.decision === 'object')
    ? result.decision
    : {};

  const noticed = _safeStr(decision.whatItMeans)
              || _safeStr(decision.issueDetected)
              || _safeStr(result && result.possibleIssue)
              || status;

  const action = _safeStr(decision.actionToday)
             || (category === SCAN_CATEGORIES.NON_PLANT
                  ? 'Try scanning a leaf, fruit, or plant stem.'
                  : 'Take a closer look in good light today.');

  const nextCheck = _safeStr(decision.nextCheck) || 'Check again tomorrow morning.';

  // Defensive sanitiser pass — anything from the engine that
  // somehow contains forbidden technical wording gets replaced
  // with the calm category-aware status.
  const safeNoticed = hasForbiddenWording(noticed) ? status : noticed;
  const safeAction  = hasForbiddenWording(action) ? 'Take a closer look in good light today.' : action;

  return Object.freeze({
    category,
    status,
    urgency,
    noticed:    safeNoticed,
    action:     safeAction,
    whyUnclear,
    nextCheck,
    retakeHint,
  });
}

export default {
  SCAN_CATEGORIES,
  URGENCY_TONES,
  getScanCategory,
  getCalmStatus,
  getUrgencyTone,
  getUncertaintyReason,
  getRetakeHint,
  composeScanResultStrings,
};
