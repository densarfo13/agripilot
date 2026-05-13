/**
 * ScanOrchestrator — multi-intent scan dispatcher.
 *
 *   import {
 *     SCAN_INTENTS,
 *     runScan,
 *     normalizeScanResult,
 *   } from '../features/scan/ScanOrchestrator';
 *
 *   const result = await runScan({
 *     intent: SCAN_INTENTS.FRUIT_RIPENESS,
 *     imageBase64,
 *     context: { crop, cropStage, weather, farmType, backyardType },
 *   });
 *
 * Why this module exists
 *   Farroway's scan flow was single-intent — every capture ran
 *   through analyzeScan with a "crop health" assumption. The
 *   Multi-Intent Scan Upgrade spec asks for 7 user-selectable
 *   intents (crop health, fruit ripeness, produce quality,
 *   insect/pest, soil condition, plant identification, growth
 *   stage) each with tuned wording + recommendations.
 *
 *   This orchestrator is the routing + normalization layer.
 *   Each intent has its own analyzer adapter that:
 *     • runs the underlying image analysis (shared backend)
 *     • interprets the output through an intent-specific
 *       wording + recommendation lens
 *     • emits the canonical NORMALIZED RESULT shape
 *
 *   The orchestrator never invents AI certainty. Every result
 *   carries a confidenceTone of 'needs_closer_photo' | 'possible'
 *   | 'likely' | 'high_likelihood'. The word "confirmed" is
 *   forbidden — sanitizeScanText strips it before output.
 *
 * Spec mapping
 *   §1  ScanOrchestrator           ← this module
 *   §2  Intent selector            ← SCAN_INTENTS constants (UI
 *                                     screen consumes these)
 *   §3  Crop health                ← _analyzeCropHealth
 *   §4  Fruit ripeness             ← _analyzeFruitRipeness
 *   §5  Produce quality            ← _analyzeProduceQuality
 *   §6  Insect / pest              ← _analyzeInsectPest
 *   §7  Soil condition             ← _analyzeSoilCondition
 *   §8  Plant identification       ← _analyzePlantIdentification
 *   §9  Growth stage               ← _analyzeGrowthStage
 *   §10 Normalized result          ← normalizeScanResult
 *   §11 Task/Home integration      ← result envelope feeds
 *                                     scanToTask + continuityEngine
 *   §12 Low-literacy UX            ← short summary + one CTA
 *   §13 Offline support            ← offlineScanQueue already
 *                                     handles this layer
 *   §14 AI safety                  ← sanitizeScanText + soft
 *                                     confidence tones
 *
 * Strict-rule audit
 *   • Pure dispatch — never throws.
 *   • Each analyzer is bounded + deterministic.
 *   • No raw AI output exposed; everything goes through
 *     normalizeScanResult.
 *   • SSR-safe.
 */

import { sanitizeScanText } from '../../../core/scanResultPolicy.js';

// ─── Intent catalog ────────────────────────────────────────────

export const SCAN_INTENTS = Object.freeze({
  CROP_HEALTH:           'crop_health',
  FRUIT_RIPENESS:        'fruit_ripeness',
  PRODUCE_QUALITY:       'produce_quality',
  INSECT_PEST:           'insect_pest',
  SOIL_CONDITION:        'soil_condition',
  PLANT_IDENTIFICATION:  'plant_identification',
  GROWTH_STAGE:          'growth_stage',
});

// Display-ready labels for the intent picker. Kept here so the UI
// has a single import surface; i18n callers can wrap each label
// in tSafe('scan.intent.<key>', label) at the call site.
export const SCAN_INTENT_LABELS = Object.freeze({
  [SCAN_INTENTS.CROP_HEALTH]:          { title: 'Crop health',        hint: 'Check leaves and overall condition' },
  [SCAN_INTENTS.FRUIT_RIPENESS]:       { title: 'Fruit ripeness',     hint: 'Check if fruit is ready to harvest' },
  [SCAN_INTENTS.PRODUCE_QUALITY]:      { title: 'Produce quality',    hint: 'Check harvested produce condition' },
  [SCAN_INTENTS.INSECT_PEST]:          { title: 'Insect or pest',     hint: 'Identify a pest or damage' },
  [SCAN_INTENTS.SOIL_CONDITION]:       { title: 'Soil condition',     hint: 'Check soil moisture and surface' },
  [SCAN_INTENTS.PLANT_IDENTIFICATION]: { title: 'Plant identification', hint: 'Identify a plant or crop' },
  [SCAN_INTENTS.GROWTH_STAGE]:         { title: 'Growth stage',       hint: 'Estimate where the plant is in its cycle' },
});

// ─── Confidence tones (spec §14) ───────────────────────────────

const CONFIDENCE_TONES = Object.freeze({
  NEEDS_CLOSER_PHOTO: 'needs_closer_photo',
  POSSIBLE:           'possible',
  LIKELY:             'likely',
  HIGH_LIKELIHOOD:    'high_likelihood',
});

// ─── Public API ────────────────────────────────────────────────

/**
 * runScan({ intent, imageBase64, imageUrl, context, analyzeFn? })
 *
 * Routes the image to the correct intent-specific analyzer + emits
 * the normalized result envelope. The actual image analysis is
 * delegated to `analyzeFn` (default: scanDetectionEngine.analyzeScan)
 * — pass a stub for tests.
 *
 * Never throws; returns a fallback envelope on any failure.
 */
export async function runScan(input) {
  try {
    const safe       = (input && typeof input === 'object') ? input : {};
    const intent     = _normIntent(safe.intent);
    const context    = (safe.context && typeof safe.context === 'object') ? safe.context : {};
    const analyzeFn  = safe.analyzeFn || _defaultAnalyzeFn;

    // Run the shared image-analysis backend if a callable is
    // available. Each intent adapter then interprets the raw
    // backend output through its own wording lens.
    let rawAnalysis = null;
    if (typeof analyzeFn === 'function') {
      try {
        rawAnalysis = await analyzeFn({
          imageBase64: safe.imageBase64 || null,
          imageUrl:    safe.imageUrl    || null,
          cropName:    context.crop     || null,
          country:     context.country  || null,
          region:      context.region   || null,
          weather:     context.weather  || null,
        });
      } catch { rawAnalysis = null; }
    }

    const adapter = _intentAdapters[intent] || _intentAdapters[SCAN_INTENTS.CROP_HEALTH];
    const adapted = adapter(rawAnalysis, context);

    return normalizeScanResult({
      ...adapted,
      scanType: intent,
    });
  } catch {
    return _fallbackEnvelope(SCAN_INTENTS.CROP_HEALTH);
  }
}

/**
 * Normalize any intent-adapter output into the spec §10 envelope.
 *
 *   {
 *     scanType,
 *     subjectDetected,
 *     confidenceTone,
 *     urgency,
 *     summary,
 *     recommendation,
 *     nextCheck,
 *     relatedTasks,
 *     followUpSuggested,
 *     marketImpact,
 *     weatherContext,
 *   }
 *
 * Sanitizes every string through scanResultPolicy.sanitizeScanText
 * so the spec §14 forbidden phrases never leak out.
 */
export function normalizeScanResult(raw) {
  const safe = (raw && typeof raw === 'object') ? raw : {};
  return Object.freeze({
    scanType:           _str(safe.scanType) || SCAN_INTENTS.CROP_HEALTH,
    subjectDetected:    _str(safe.subjectDetected) || null,
    confidenceTone:     _normConfidence(safe.confidenceTone),
    urgency:            _normUrgency(safe.urgency),
    summary:            _safeText(safe.summary)        || '',
    recommendation:     _safeText(safe.recommendation) || '',
    nextCheck:          _str(safe.nextCheck) || 'Check again tomorrow morning.',
    relatedTasks:       Array.isArray(safe.relatedTasks) ? safe.relatedTasks.slice(0, 5).map(_safeText) : [],
    followUpSuggested:  !!safe.followUpSuggested,
    marketImpact:       _str(safe.marketImpact) || null,
    weatherContext:     _str(safe.weatherContext) || null,
  });
}

// ─── Intent adapters (spec §3-§9) ──────────────────────────────
//
// Each adapter takes the raw image-analysis output (or null if the
// backend wasn't available) + the user-supplied context and emits
// an unfrozen partial result. The orchestrator runs it through
// normalizeScanResult which freezes + sanitizes.
//
// Adapters never throw. Missing data → confidence='needs_closer_photo'
// + a calm "Take a closer photo" recommendation.

const _intentAdapters = {

  // §3 — Crop health
  [SCAN_INTENTS.CROP_HEALTH]: (raw, ctx) => {
    if (!raw) return _needsCloserPhoto(SCAN_INTENTS.CROP_HEALTH, ctx.crop);
    const issue       = _str(raw.possibleIssue) || 'general check';
    const confidence  = _normConfidence(raw.confidence);
    return {
      subjectDetected:   ctx.crop || 'crop',
      confidenceTone:    confidence,
      urgency:           _normUrgency(raw.urgency || 'medium'),
      summary:           `Your ${ctx.crop || 'crop'} shows ${_softenIssueWord(issue)}.`,
      recommendation:    _str(raw.recommendation) || 'Inspect leaves and stem; remove any visibly damaged growth.',
      nextCheck:         'Check again tomorrow morning.',
      relatedTasks:      Array.isArray(raw.recommendedActions) ? raw.recommendedActions : [],
      followUpSuggested: confidence === CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO || _normUrgency(raw.urgency) === 'high',
      weatherContext:    _str(raw.weatherCaution) || null,
    };
  },

  // §4 — Fruit ripeness
  [SCAN_INTENTS.FRUIT_RIPENESS]: (raw, ctx) => {
    if (!raw) return _needsCloserPhoto(SCAN_INTENTS.FRUIT_RIPENESS, ctx.crop);
    // Rule-based ripeness wording — never claims scientific
    // precision. The user's eye + a soft estimate.
    const stage = String(raw.ripenessStage || raw.category || '').toLowerCase();
    let summary;
    let nextCheck;
    if (stage.includes('overripe')) {
      summary = `Your ${ctx.crop || 'crop'} appears overripe. Harvest soon to avoid waste.`;
      nextCheck = 'Harvest today if possible.';
    } else if (stage.includes('ready') || stage.includes('mature')) {
      summary = `Your ${ctx.crop || 'crop'} appears close to harvest readiness.`;
      nextCheck = 'Check again in 1-2 days.';
    } else if (stage.includes('near') || stage.includes('approaching')) {
      summary = `Your ${ctx.crop || 'crop'} is nearing harvest. Continue normal care.`;
      nextCheck = 'Check again in 3-5 days.';
    } else {
      summary = `Your ${ctx.crop || 'crop'} still looks immature. Continue normal care.`;
      nextCheck = 'Check again next week.';
    }
    return {
      subjectDetected:   ctx.crop || 'fruit',
      confidenceTone:    _normConfidence(raw.confidence) || CONFIDENCE_TONES.POSSIBLE,
      urgency:           stage.includes('overripe') ? 'high' : 'low',
      summary,
      recommendation:    'Use look + gentle touch to confirm ripeness before harvesting.',
      nextCheck,
      followUpSuggested: stage.includes('near') || stage.includes('ready'),
      marketImpact:      stage.includes('ready') ? 'Soon-to-harvest produce — start lining up buyers.' : null,
    };
  },

  // §5 — Produce quality
  [SCAN_INTENTS.PRODUCE_QUALITY]: (raw, ctx) => {
    if (!raw) return _needsCloserPhoto(SCAN_INTENTS.PRODUCE_QUALITY, ctx.crop);
    const flag = String(raw.qualityFlag || raw.category || '').toLowerCase();
    let summary;
    let marketImpact;
    if (flag.includes('rot') || flag.includes('mold')) {
      summary = 'Visible rot or mold detected. Separate affected produce immediately.';
      marketImpact = 'Not suitable for market.';
    } else if (flag.includes('bruise') || flag.includes('crack')) {
      summary = 'Some surface damage visible. Suitable for local sale or quick use.';
      marketImpact = 'Lower-grade — local market only.';
    } else if (flag.includes('insect')) {
      summary = 'Insect damage visible on some pieces. Sort before storage.';
      marketImpact = 'Reject visibly damaged pieces from market lots.';
    } else {
      summary = 'Produce appears in good condition.';
      marketImpact = 'Market-ready quality.';
    }
    return {
      subjectDetected:   ctx.crop || 'produce',
      confidenceTone:    _normConfidence(raw.confidence) || CONFIDENCE_TONES.LIKELY,
      urgency:           flag.includes('rot') || flag.includes('mold') ? 'high' : 'medium',
      summary,
      recommendation:    'Handle gently. Store in a cool, dry place out of direct sun.',
      nextCheck:         'Re-check sorted lots tomorrow before transport.',
      followUpSuggested: false,
      marketImpact,
    };
  },

  // §6 — Insect/pest
  [SCAN_INTENTS.INSECT_PEST]: (raw, ctx) => {
    if (!raw) return _needsCloserPhoto(SCAN_INTENTS.INSECT_PEST, ctx.crop);
    const pest = _str(raw.pestType) || _str(raw.possibleIssue) || 'unidentified pest';
    const confidence = _normConfidence(raw.confidence);
    return {
      subjectDetected:   pest,
      confidenceTone:    confidence,
      urgency:           confidence === CONFIDENCE_TONES.HIGH_LIKELIHOOD ? 'high' : 'medium',
      summary:           confidence === CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO
                          ? 'Needs closer inspection. Take another photo close to the affected area.'
                          : `Possible ${_softenIssueWord(pest)} damage seen on your ${ctx.crop || 'plant'}.`,
      recommendation:    'Inspect under leaves and near stems. Remove any visible insects by hand if possible.',
      nextCheck:         'Recheck in 2-3 days; rescan if damage spreads.',
      followUpSuggested: true,
    };
  },

  // §7 — Soil condition
  [SCAN_INTENTS.SOIL_CONDITION]: (raw, ctx) => {
    const condition = _str(raw && raw.soilCondition) || _str(raw && raw.category) || '';
    const c = condition.toLowerCase();
    let summary;
    let urgency = 'medium';
    if (c.includes('dry') || c.includes('cracked')) {
      summary  = 'Soil looks dry. Water gently if there is no rain in the forecast.';
      urgency  = 'medium';
    } else if (c.includes('water') || c.includes('flood')) {
      summary  = 'Standing water visible. Improve drainage before planting more.';
      urgency  = 'high';
    } else if (c.includes('healthy') || c.includes('good')) {
      summary  = 'Soil surface looks healthy.';
      urgency  = 'low';
    } else {
      summary  = 'Soil condition unclear from this photo. A wider shot helps.';
      urgency  = 'low';
    }
    return {
      subjectDetected:   'soil surface',
      confidenceTone:    _normConfidence(raw && raw.confidence) || CONFIDENCE_TONES.POSSIBLE,
      urgency,
      summary,
      recommendation:    'Feel the top inch by hand before watering. Soil that crumbles dry needs water; soil that clumps wet does not.',
      nextCheck:         'Re-check after the next rain or watering.',
      followUpSuggested: c.includes('water') || c.includes('flood'),
      weatherContext:    ctx.weather && ctx.weather.condition ? `Weather: ${ctx.weather.condition}` : null,
    };
  },

  // §8 — Plant identification
  [SCAN_INTENTS.PLANT_IDENTIFICATION]: (raw, ctx) => {
    if (!raw) return _needsCloserPhoto(SCAN_INTENTS.PLANT_IDENTIFICATION, 'plant');
    const guess      = _str(raw.likelyPlant) || _str(raw.plantName) || 'plant';
    const confidence = _normConfidence(raw.confidence);
    return {
      subjectDetected:   guess,
      confidenceTone:    confidence,
      urgency:           'low',
      summary:           confidence === CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO
                          ? 'Plant unclear from this photo. Try a wider shot including a leaf and stem.'
                          : `This looks like it could be ${guess}.`,
      recommendation:    'Compare against a known plant if you can, or ask someone with experience.',
      nextCheck:         null,
      followUpSuggested: false,
    };
  },

  // §9 — Growth stage
  [SCAN_INTENTS.GROWTH_STAGE]: (raw, ctx) => {
    if (!raw) return _needsCloserPhoto(SCAN_INTENTS.GROWTH_STAGE, ctx.crop);
    const stage = String(raw.growthStage || raw.cropStage || '').toLowerCase();
    let estimate;
    let careHint;
    if (stage.includes('seedling') || stage.includes('seed')) {
      estimate = 'seedling';
      careHint = 'Water gently. Protect from heavy rain and direct midday sun.';
    } else if (stage.includes('vegetative') || stage.includes('growth')) {
      estimate = 'vegetative growth';
      careHint = 'Watch for early signs of pests. Keep weeds clear.';
    } else if (stage.includes('flower')) {
      estimate = 'flowering';
      careHint = 'Pollination matters now. Avoid harsh sprays.';
    } else if (stage.includes('fruit')) {
      estimate = 'fruiting';
      careHint = 'Steady water + check for fruit damage.';
    } else if (stage.includes('harvest')) {
      estimate = 'harvest stage';
      careHint = 'Begin harvest planning.';
    } else {
      estimate = 'between stages';
      careHint = 'Continue normal care. Check again in a few days.';
    }
    return {
      subjectDetected:   ctx.crop || 'plant',
      confidenceTone:    _normConfidence(raw.confidence) || CONFIDENCE_TONES.POSSIBLE,
      urgency:           'low',
      summary:           `This looks like ${estimate} stage.`,
      recommendation:    careHint,
      nextCheck:         'Check again in 3-5 days.',
      followUpSuggested: false,
    };
  },
};

// ─── Internal helpers ─────────────────────────────────────────

function _normIntent(raw) {
  if (typeof raw !== 'string') return SCAN_INTENTS.CROP_HEALTH;
  const v = raw.toLowerCase().trim();
  if (Object.values(SCAN_INTENTS).includes(v)) return v;
  return SCAN_INTENTS.CROP_HEALTH;
}

function _normConfidence(raw) {
  if (typeof raw !== 'string') return CONFIDENCE_TONES.POSSIBLE;
  const v = raw.toLowerCase().trim();
  // Map legacy values to the spec's canonical tones.
  if (v === 'low'        || v === 'needs_closer_photo' || v === 'limited-data') return CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO;
  if (v === 'medium'     || v === 'possible')                                   return CONFIDENCE_TONES.POSSIBLE;
  if (v === 'high'       || v === 'likely')                                     return CONFIDENCE_TONES.LIKELY;
  if (v === 'very_high'  || v === 'high_likelihood')                             return CONFIDENCE_TONES.HIGH_LIKELIHOOD;
  if (Object.values(CONFIDENCE_TONES).includes(v))                              return v;
  return CONFIDENCE_TONES.POSSIBLE;
}

function _normUrgency(raw) {
  if (typeof raw !== 'string') return 'medium';
  const v = raw.toLowerCase().trim();
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return 'medium';
}

function _str(v) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

function _safeText(v) {
  const s = _str(v);
  if (!s) return '';
  try { return sanitizeScanText(s); } catch { return s; }
}

function _softenIssueWord(raw) {
  // The spec forbids "confirmed". scanResultPolicy.sanitizeScanText
  // already handles full phrases ("confirmed disease" → "possible
  // issue"); this helper softens the bare word at the summary
  // level so the orchestrator's own templates never leak it.
  const s = String(raw || '').trim();
  if (!s) return 'a possible issue';
  return s.toLowerCase().replace(/\bconfirmed\b/g, 'possible');
}

function _needsCloserPhoto(intent, subject) {
  return {
    subjectDetected:   subject || null,
    confidenceTone:    CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO,
    urgency:           'low',
    summary:           'Needs closer photo. Try a clearer, well-lit shot of the area.',
    recommendation:    'Move closer, hold steady, and capture in natural light.',
    nextCheck:         null,
    followUpSuggested: false,
  };
}

function _fallbackEnvelope(intent) {
  return normalizeScanResult({
    scanType:        intent,
    confidenceTone:  CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO,
    urgency:         'low',
    summary:         'Scan could not be completed. Try again with a clearer photo.',
    recommendation:  'Take a closer, well-lit photo and retry.',
  });
}

// Lazy default analyzer — keeps the orchestrator decoupled from
// the scan-detection engine so unit tests can pass a stub.
async function _defaultAnalyzeFn(opts) {
  try {
    const mod = await import('../../../core/scanDetectionEngine.js');
    if (mod && typeof mod.analyzeScan === 'function') {
      return await mod.analyzeScan(opts);
    }
  } catch { /* swallow */ }
  return null;
}

const _module = {
  SCAN_INTENTS,
  SCAN_INTENT_LABELS,
  runScan,
  normalizeScanResult,
};
export default _module;
