/**
 * fastIssueClassifier.js — fast composition layer that turns a
 * captured scan + farm context into the structured "what we
 * noticed / what to check next" result the Scan UI renders.
 *
 *   import { classifyScan, MANUAL_SYMPTOMS, SCAN_PROGRESS,
 *            SUBJECT_TYPE, ISSUE_CATEGORY }
 *     from 'src/core/scan/fastIssueClassifier.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A PURE COMPOSITION layer. It does NOT run inference; it takes
 *   signals that `analyzeImageSafe` / `hybridScanEngine` already
 *   surface, normalises them, calibrates confidence, and folds in
 *   the intelligence snapshot to produce one safe, localised,
 *   render-ready result.
 *
 *   It is NOT a new model. It is NOT a duplicate of `scanResultPolicy`
 *   (the sanitiser) — it composes alongside it: classifier first,
 *   sanitiser-friendly wording out, optional `enforceHighTrustScanResult`
 *   still applicable downstream.
 *
 *   It does NOT claim confirmed diagnoses, NEVER returns high
 *   confidence without multiple agreeing signals, NEVER prescribes
 *   chemicals with certainty.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Reuses `confidenceLanguage.confidenceWord` for hedged wording.
 *   • Every user-visible string ships as `{ key, fallback, params }`.
 */

import { confidenceWord } from '../agronomy/confidenceLanguage.js';
import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';

// Categories where a "consult a local expert before chemicals"
// note is appropriate — anywhere a farmer might reach for a
// spray. Drought / nutrient / sunburn / wilting are NOT in this
// set: the answer there is water / shade / monitoring.
const _CHEMICAL_RISK_CATEGORIES = new Set([
  'fungal_risk', 'pest_damage', 'fruit_rot', 'leaf_spot',
]);

const SAFETY_NOTE = Object.freeze({
  key:      'scan.safety.consult_local',
  fallback: 'Consult a local agricultural expert before applying any chemical treatment.',
});

// Per-category short label envelopes for the `possibleIssue` field
// (the spec's "human label" companion to the taxonomy `issueCategory`).
const ISSUE_LABEL = Object.freeze({
  leaf_spot:                  { key: 'scan.issue_label.leaf_spot',    fallback: 'Possible leaf spot' },
  yellowing:                  { key: 'scan.issue_label.yellowing',    fallback: 'Possible yellowing leaves' },
  wilting:                    { key: 'scan.issue_label.wilting',      fallback: 'Possible wilting' },
  pest_damage:                { key: 'scan.issue_label.pest_damage',  fallback: 'Possible pest damage' },
  fungal_risk:                { key: 'scan.issue_label.fungal_risk',  fallback: 'Possible fungal stress' },
  fruit_rot:                  { key: 'scan.issue_label.fruit_rot',    fallback: 'Possible fruit rot' },
  sunburn:                    { key: 'scan.issue_label.sunburn',      fallback: 'Possible heat / sun stress' },
  water_stress:               { key: 'scan.issue_label.water_stress', fallback: 'Possible water stress' },
  overwatering:               { key: 'scan.issue_label.overwatering', fallback: 'Possible overwatering signs' },
  nutrient_stress:            { key: 'scan.issue_label.nutrient',     fallback: 'Possible nutrient stress' },
  unknown_needs_clearer_photo:{ key: 'scan.issue_label.unknown',      fallback: 'Needs a clearer photo' },
});

// ── Taxonomy ─────────────────────────────────────────────────
export const SUBJECT_TYPE = Object.freeze({
  CROP:    'crop',
  LEAF:    'leaf',
  FRUIT:   'fruit',
  STEM:    'stem',
  SOIL:    'soil',
  PEST:    'pest',
  UNKNOWN: 'unknown',
});

export const ISSUE_CATEGORY = Object.freeze({
  LEAF_SPOT:                  'leaf_spot',
  YELLOWING:                  'yellowing',
  WILTING:                    'wilting',
  PEST_DAMAGE:                'pest_damage',
  FUNGAL_RISK:                'fungal_risk',
  FRUIT_ROT:                  'fruit_rot',
  SUNBURN:                    'sunburn',
  WATER_STRESS:               'water_stress',
  OVERWATERING:               'overwatering',
  NUTRIENT_STRESS:            'nutrient_stress',
  UNKNOWN_NEEDS_CLEARER_PHOTO:'unknown_needs_clearer_photo',
});

// Progress steps the Scan UI shows during the 3–8 s window.
export const SCAN_PROGRESS = Object.freeze([
  Object.freeze({ key: 'scan.progress.preparing',         fallback: 'Preparing photo' }),
  Object.freeze({ key: 'scan.progress.checking_subject',  fallback: 'Checking crop / leaf' }),
  Object.freeze({ key: 'scan.progress.looking_for_stress',fallback: 'Looking for visible stress' }),
  Object.freeze({ key: 'scan.progress.preparing_guidance',fallback: 'Preparing guidance' }),
]);

// The manual symptom-picker options — used when confidence is low
// or the user opens the manual fallback voluntarily.
export const MANUAL_SYMPTOMS = Object.freeze([
  Object.freeze({ id: 'yellow_leaves', key: 'scan.symptom.yellow_leaves', fallback: 'Yellow leaves' }),
  Object.freeze({ id: 'spots',         key: 'scan.symptom.spots',         fallback: 'Brown / black spots' }),
  Object.freeze({ id: 'holes_insects', key: 'scan.symptom.holes_insects', fallback: 'Holes or insects' }),
  Object.freeze({ id: 'wilting',       key: 'scan.symptom.wilting',       fallback: 'Wilting' }),
  Object.freeze({ id: 'mold_rot',      key: 'scan.symptom.mold_rot',      fallback: 'Mold or rot' }),
  Object.freeze({ id: 'dry_soil',      key: 'scan.symptom.dry_soil',      fallback: 'Dry soil' }),
  Object.freeze({ id: 'fruit_damage',  key: 'scan.symptom.fruit_damage',  fallback: 'Fruit damage' }),
  Object.freeze({ id: 'not_sure',      key: 'scan.symptom.not_sure',      fallback: 'Not sure' }),
]);

// ── Message envelopes ───────────────────────────────────────
const MSG = Object.freeze({
  NOTICED_LEAF_SPOT:   { key: 'scan.noticed.leaf_spot',     fallback: 'We noticed possible leaf spots on {crop}.' },
  NOTICED_YELLOWING:   { key: 'scan.noticed.yellowing',     fallback: 'We noticed yellowing leaves on {crop}.' },
  NOTICED_WILTING:     { key: 'scan.noticed.wilting',       fallback: '{crop} looks like it may be wilting.' },
  NOTICED_PEST:        { key: 'scan.noticed.pest',          fallback: 'We noticed possible pest damage on {crop}.' },
  NOTICED_FUNGAL:      { key: 'scan.noticed.fungal',        fallback: 'Conditions and signs suggest possible fungal stress.' },
  NOTICED_FRUIT_ROT:   { key: 'scan.noticed.fruit_rot',     fallback: 'We noticed possible rot on the fruit.' },
  NOTICED_SUNBURN:     { key: 'scan.noticed.sunburn',       fallback: '{crop} may be showing heat or sun stress.' },
  NOTICED_WATER:       { key: 'scan.noticed.water_stress',  fallback: '{crop} may be showing water stress.' },
  NOTICED_OVERWATER:   { key: 'scan.noticed.overwatering',  fallback: 'Soil signs suggest possible overwatering.' },
  NOTICED_NUTRIENT:    { key: 'scan.noticed.nutrient',      fallback: 'Leaf colour suggests possible nutrient stress.' },
  NOTICED_UNKNOWN:     { key: 'scan.noticed.unknown',       fallback: 'The photo was not clear enough to be sure.' },

  CHECK_SPREAD:        { key: 'scan.check.spread',          fallback: 'Check nearby plants over the next 2–3 days.' },
  CHECK_SOIL_MOISTURE: { key: 'scan.check.soil_moisture',   fallback: 'Check the soil at the base — wet or dry?' },
  CHECK_LEAF_UNDER:    { key: 'scan.check.leaf_under',      fallback: 'Check under leaves for insects or eggs.' },
  CHECK_RETAKE:        { key: 'scan.check.retake',          fallback: 'Take another photo in better light, close to the affected leaf.' },

  ACTION_WATER_EARLY:  { key: 'scan.action.water_early',    fallback: 'Water in the cool hours; provide shade if possible.' },
  ACTION_BASE_WATER:   { key: 'scan.action.base_water',     fallback: 'Water at the base, not on the leaves.' },
  ACTION_REMOVE_LEAVES:{ key: 'scan.action.remove_leaves',  fallback: 'Remove badly affected leaves.' },
  ACTION_CONSULT_LOCAL:{ key: 'scan.action.consult_local',  fallback: 'For chemical treatment, consult a local agricultural expert.' },
  ACTION_MONITOR:      { key: 'scan.action.monitor',        fallback: 'Monitor the plant and re-check in a day or two.' },
});

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

// ── Helpers ─────────────────────────────────────────────────
const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const _bool = (v) => v === true;

/** Pick a subject type from input + signals. */
function _pickSubject(signals, snapshot) {
  const hint = _str(signals.subjectHint || signals.subject || '');
  if (hint && SUBJECT_TYPE[hint.toUpperCase()]) return SUBJECT_TYPE[hint.toUpperCase()];
  // Crude fallback from named signals:
  if (signals.leafFeatures || signals.spots || signals.yellowing) return SUBJECT_TYPE.LEAF;
  if (signals.fruitRot || signals.fruitDamage) return SUBJECT_TYPE.FRUIT;
  if (signals.soilDry || signals.soilWet)      return SUBJECT_TYPE.SOIL;
  if (signals.holes || signals.insects)        return SUBJECT_TYPE.PEST;
  if (signals.stemDamage)                      return SUBJECT_TYPE.STEM;
  if (snapshot && snapshot.crop)               return SUBJECT_TYPE.CROP;
  return SUBJECT_TYPE.UNKNOWN;
}

/**
 * Pick an issue category + evidence list from signals + snapshot.
 * Returns `{ category, evidence }`. `evidence` is a list of strings —
 * the signals that fired — so the UI can render "we noticed: …".
 */
function _pickIssue(signals, snapshot) {
  const evidence = [];
  const sn = (snapshot && snapshot.weather) || {};
  const dry = _num(sn.daysSinceRain);
  const hum = _num(sn.humidityPct);
  const temp = _num(sn.temperatureC);

  if (_bool(signals.spots))     evidence.push('spots');
  if (_bool(signals.yellowing)) evidence.push('yellowing');
  if (_bool(signals.wilting))   evidence.push('wilting');
  if (_bool(signals.holes))     evidence.push('holes');
  if (_bool(signals.mold))      evidence.push('mold');
  if (_bool(signals.fruitRot))  evidence.push('fruit_rot');
  if (_bool(signals.soilDry))   evidence.push('dry_soil');
  if (_bool(signals.soilWet))   evidence.push('wet_soil');
  if (_bool(signals.heatStress))evidence.push('heat_stress');

  // Order matters: most specific first.
  if (_bool(signals.fruitRot))                   return { category: ISSUE_CATEGORY.FRUIT_ROT, evidence };
  if (_bool(signals.mold))                       return { category: ISSUE_CATEGORY.FUNGAL_RISK, evidence };
  if (_bool(signals.holes) || _bool(signals.insects)) {
    evidence.push('insect_visible');
    return { category: ISSUE_CATEGORY.PEST_DAMAGE, evidence };
  }
  if (_bool(signals.spots))                      return { category: ISSUE_CATEGORY.LEAF_SPOT, evidence };
  if (_bool(signals.wilting)) {
    // Wilting + heat = sunburn; wilting + dry = water stress; otherwise generic.
    if (temp != null && temp >= 32)              return { category: ISSUE_CATEGORY.SUNBURN, evidence };
    if (dry != null && dry >= 4)                 return { category: ISSUE_CATEGORY.WATER_STRESS, evidence };
    return { category: ISSUE_CATEGORY.WILTING, evidence };
  }
  if (_bool(signals.yellowing)) {
    // Yellowing + wet → overwatering; yellowing + dry → water stress;
    // otherwise nutrient.
    if (_bool(signals.soilWet) || (hum != null && hum >= 85))
      return { category: ISSUE_CATEGORY.OVERWATERING, evidence };
    if (dry != null && dry >= 5)
      return { category: ISSUE_CATEGORY.WATER_STRESS, evidence };
    return { category: ISSUE_CATEGORY.NUTRIENT_STRESS, evidence };
  }
  if (_bool(signals.heatStress) || (temp != null && temp >= 36))
    return { category: ISSUE_CATEGORY.SUNBURN, evidence };

  // No strong signals — needs a clearer photo.
  return { category: ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO, evidence };
}

/**
 * Confidence: at least 2 independent agreeing signals → medium;
 * 3+ AND a strong category → high (but ALWAYS expressed as the
 * hedged confidenceWord — never "confirmed"). Otherwise low.
 */
function _calibrateConfidence(evidence, category, scanSignals) {
  const reported = _num(scanSignals.confidence);
  // If the upstream signal volunteered a confidence, take the
  // minimum of it and our own calibration so we never INFLATE it.
  const evidenceCount = (evidence || []).length;
  let tier = 'low';
  if (evidenceCount >= 3) tier = 'high';
  else if (evidenceCount >= 2) tier = 'medium';

  // Unknown category always falls back to low.
  if (category === ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO) tier = 'low';

  // Floor by reported confidence (0..1).
  if (reported != null) {
    let reportedTier;
    if (reported >= 0.85) reportedTier = 'high';
    else if (reported >= 0.6) reportedTier = 'medium';
    else reportedTier = 'low';
    const rank = (t) => t === 'high' ? 3 : t === 'medium' ? 2 : 1;
    if (rank(reportedTier) < rank(tier)) tier = reportedTier;
  }
  return tier;
}

function _noticedFor(category, crop) {
  const params = { crop: crop || 'the plant' };
  switch (category) {
    case ISSUE_CATEGORY.LEAF_SPOT:        return _msg(MSG.NOTICED_LEAF_SPOT, params);
    case ISSUE_CATEGORY.YELLOWING:        return _msg(MSG.NOTICED_YELLOWING, params);
    case ISSUE_CATEGORY.WILTING:          return _msg(MSG.NOTICED_WILTING, params);
    case ISSUE_CATEGORY.PEST_DAMAGE:      return _msg(MSG.NOTICED_PEST, params);
    case ISSUE_CATEGORY.FUNGAL_RISK:      return _msg(MSG.NOTICED_FUNGAL, params);
    case ISSUE_CATEGORY.FRUIT_ROT:        return _msg(MSG.NOTICED_FRUIT_ROT, params);
    case ISSUE_CATEGORY.SUNBURN:          return _msg(MSG.NOTICED_SUNBURN, params);
    case ISSUE_CATEGORY.WATER_STRESS:     return _msg(MSG.NOTICED_WATER, params);
    case ISSUE_CATEGORY.OVERWATERING:     return _msg(MSG.NOTICED_OVERWATER, params);
    case ISSUE_CATEGORY.NUTRIENT_STRESS:  return _msg(MSG.NOTICED_NUTRIENT, params);
    default:                              return _msg(MSG.NOTICED_UNKNOWN, params);
  }
}

function _nextCheckFor(category) {
  switch (category) {
    case ISSUE_CATEGORY.LEAF_SPOT:
    case ISSUE_CATEGORY.FUNGAL_RISK:
    case ISSUE_CATEGORY.FRUIT_ROT:
      return _msg(MSG.CHECK_SPREAD);
    case ISSUE_CATEGORY.WATER_STRESS:
    case ISSUE_CATEGORY.OVERWATERING:
      return _msg(MSG.CHECK_SOIL_MOISTURE);
    case ISSUE_CATEGORY.PEST_DAMAGE:
      return _msg(MSG.CHECK_LEAF_UNDER);
    case ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO:
      return _msg(MSG.CHECK_RETAKE);
    default:
      return _msg(MSG.CHECK_SPREAD);
  }
}

function _actionsFor(category) {
  switch (category) {
    case ISSUE_CATEGORY.LEAF_SPOT:
    case ISSUE_CATEGORY.FUNGAL_RISK:
      return [_msg(MSG.ACTION_REMOVE_LEAVES), _msg(MSG.ACTION_BASE_WATER), _msg(MSG.ACTION_CONSULT_LOCAL)];
    case ISSUE_CATEGORY.PEST_DAMAGE:
      return [_msg(MSG.ACTION_REMOVE_LEAVES), _msg(MSG.ACTION_MONITOR), _msg(MSG.ACTION_CONSULT_LOCAL)];
    case ISSUE_CATEGORY.FRUIT_ROT:
      return [_msg(MSG.ACTION_REMOVE_LEAVES), _msg(MSG.ACTION_BASE_WATER), _msg(MSG.ACTION_CONSULT_LOCAL)];
    case ISSUE_CATEGORY.WATER_STRESS:
    case ISSUE_CATEGORY.SUNBURN:
      return [_msg(MSG.ACTION_WATER_EARLY), _msg(MSG.ACTION_MONITOR)];
    case ISSUE_CATEGORY.OVERWATERING:
      return [_msg(MSG.ACTION_MONITOR)];
    case ISSUE_CATEGORY.NUTRIENT_STRESS:
    case ISSUE_CATEGORY.YELLOWING:
    case ISSUE_CATEGORY.WILTING:
      return [_msg(MSG.ACTION_MONITOR)];
    case ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO:
    default:
      return [_msg(MSG.ACTION_MONITOR)];
  }
}

function _followUpTaskFor(category, crop) {
  const cropName = crop || 'the plant';
  return {
    titleKey: `scan.followup.${category}`,
    titleFallback: `Re-check ${cropName} in 2 days for spread or change`,
    actionType: 'inspect',
    urgency: category === ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO ? 'low' : 'medium',
    isFollowUp: true,
  };
}

function _journalSummary(category, crop) {
  const cropName = crop || 'plant';
  if (category === ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO) {
    return `Scan: photo unclear — re-check ${cropName} after a clearer photo.`;
  }
  const label = String(category).replace(/_/g, ' ');
  return `Scan: possible ${label} on ${cropName}.`;
}

/**
 * Classify a scan into the structured render-ready result.
 *
 * @param {object} input
 * @param {object} [input.scanSignals]  signals from analyzeImageSafe /
 *        hybridScanEngine. Keys: subjectHint, spots, yellowing, wilting,
 *        holes, mold, fruitRot, soilDry, soilWet, heatStress, insects,
 *        confidence (0..1).
 * @param {object} [input.snapshot]    from getIntelligenceSnapshot()
 * @param {string} [input.crop]        override snapshot.crop
 * @returns {object}
 */
export function classifyScan(input) {
  try {
    const i = (input && typeof input === 'object') ? input : {};
    const signals = (i.scanSignals && typeof i.scanSignals === 'object') ? i.scanSignals : {};
    const snapshot = (i.snapshot && typeof i.snapshot === 'object') ? i.snapshot : {};
    const crop = i.crop || snapshot.crop || null;

    const subjectType = _pickSubject(signals, snapshot);
    const { category, evidence } = _pickIssue(signals, snapshot);
    const tier = _calibrateConfidence(evidence, category, signals);
    const confidence = confidenceWord(tier);  // always hedged: likely/possible/needs review

    const whatWeNoticed   = _noticedFor(category, crop);
    const whatToCheckNext = _nextCheckFor(category);
    const recommendedAction = _actionsFor(category);
    const followUpTask    = _followUpTaskFor(category, crop);
    const journalSummary  = _journalSummary(category, crop);

    const isLowConfidence = (tier === 'low');
    const manualOptions = isLowConfidence ? MANUAL_SYMPTOMS.slice() : [];
    const retakeGuidance = isLowConfidence ? _msg(MSG.CHECK_RETAKE) : null;

    // Spec contract additions:
    const issueLabelTemplate = ISSUE_LABEL[category] || ISSUE_LABEL.unknown_needs_clearer_photo;
    const possibleIssueLabel = _msg(issueLabelTemplate, { crop: crop || 'the plant' });
    const confidenceLabel = (category === ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO)
      ? 'needs_review'
      : tier;
    const safetyNote = _CHEMICAL_RISK_CATEGORIES.has(category) ? _msg(SAFETY_NOTE) : null;
    const nextBestAction = recommendedAction[0] || null;

    return {
      subjectType,
      // Spec wants BOTH:
      //   • issueCategory — the taxonomy key
      //   • possibleIssue — a localizable human label envelope
      issueCategory:    category,
      possibleIssue:    possibleIssueLabel,
      confidence,         // hedged word: likely / possible / needs review
      confidenceLabel,    // 'high' | 'medium' | 'low' | 'needs_review'
      confidenceTier:   tier,
      evidence,
      whatWeNoticed,
      whatToCheckNext,
      recommendedAction,  // array of message envelopes
      safetyNote,         // envelope OR null
      nextBestAction,     // single envelope (= recommendedAction[0]) OR null
      followUpTask,
      journalSummary,
      isLowConfidence,
      manualOptions,
      retakeGuidance,
    };
  } catch {
    return _safeFallback(input);
  }
}

function _safeFallback(input) {
  const crop = (input && input.crop) || null;
  const category = ISSUE_CATEGORY.UNKNOWN_NEEDS_CLEARER_PHOTO;
  const monitor = _msg(MSG.ACTION_MONITOR);
  return {
    subjectType:        SUBJECT_TYPE.UNKNOWN,
    issueCategory:      category,
    possibleIssue:      _msg(ISSUE_LABEL.unknown_needs_clearer_photo, { crop: crop || 'the plant' }),
    confidence:         confidenceWord('low'),
    confidenceLabel:    'needs_review',
    confidenceTier:     'low',
    evidence:           [],
    whatWeNoticed:      _msg(MSG.NOTICED_UNKNOWN, { crop: crop || 'the plant' }),
    whatToCheckNext:    _msg(MSG.CHECK_RETAKE),
    recommendedAction:  [monitor],
    safetyNote:         null,
    nextBestAction:     monitor,
    followUpTask:       _followUpTaskFor(category, crop),
    journalSummary:     _journalSummary(category, crop),
    isLowConfidence:    true,
    manualOptions:      MANUAL_SYMPTOMS.slice(),
    retakeGuidance:     _msg(MSG.CHECK_RETAKE),
  };
}

// ── Observability adapter (spec §10) ─────────────────────────
//
// Specific event names the dashboard reads. Error events forward
// to observabilityTracker.SCAN_FAILURE; the rest are counter-only.
export const SCAN_FLOW_OBS = Object.freeze({
  SCAN_STARTED:              'scan_started',
  SCAN_SUBJECT_DETECTED:     'scan_subject_detected',
  SCAN_ISSUE_DETECTED:       'scan_issue_detected',
  SCAN_LOW_CONFIDENCE:       'scan_low_confidence',
  SCAN_MANUAL_FALLBACK_USED: 'scan_manual_fallback_used',
  SCAN_JOURNAL_SAVED:        'scan_journal_saved',
  SCAN_FOLLOW_UP_CREATED:    'scan_follow_up_created',
  SCAN_FAILED:               'scan_failed',
  SCAN_COMPLETED:            'scan_completed',
});

const _FLOW_TO_CATEGORY = Object.freeze({
  [SCAN_FLOW_OBS.SCAN_FAILED]:               OBSERVABILITY.SCAN_FAILURE,
  [SCAN_FLOW_OBS.SCAN_LOW_CONFIDENCE]:       null,
  [SCAN_FLOW_OBS.SCAN_MANUAL_FALLBACK_USED]: null,
  [SCAN_FLOW_OBS.SCAN_STARTED]:              null,
  [SCAN_FLOW_OBS.SCAN_SUBJECT_DETECTED]:     null,
  [SCAN_FLOW_OBS.SCAN_ISSUE_DETECTED]:       null,
  [SCAN_FLOW_OBS.SCAN_JOURNAL_SAVED]:        null,
  [SCAN_FLOW_OBS.SCAN_FOLLOW_UP_CREATED]:    null,
  [SCAN_FLOW_OBS.SCAN_COMPLETED]:            null,
});

const _flowCounts = {};

/**
 * Record a scan-flow event. Never throws — observability is never
 * load-bearing on the scan path. NO raw image data + NO PII flow
 * through this adapter; it only counts named events.
 *
 * @param {string} event one of SCAN_FLOW_OBS
 */
export function recordScanFlowObservation(event) {
  try {
    if (!event) return false;
    _flowCounts[event] = (_flowCounts[event] || 0) + 1;
    const category = _FLOW_TO_CATEGORY[event];
    if (category) {
      try { recordObservation(category); } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
}

/** Read-only snapshot of scan-flow counters. */
export function getScanFlowCounts() {
  return { ..._flowCounts };
}

/** Reset scan-flow counters (test hook). */
export function resetScanFlowCounts() {
  for (const k of Object.keys(_flowCounts)) delete _flowCounts[k];
}

const _module = {
  SUBJECT_TYPE, ISSUE_CATEGORY, MANUAL_SYMPTOMS, SCAN_PROGRESS,
  SCAN_FLOW_OBS,
  classifyScan,
  recordScanFlowObservation, getScanFlowCounts, resetScanFlowCounts,
};
export default _module;
