/**
 * hybridScanEngine.js — context-aware refinement of the
 * image-only scan result.
 *
 * Combines five signals into one safer, action-based verdict:
 *   1. imageResult     — output of analyzeScan (existing engine)
 *   2. plantName / cropName
 *   3. activeExperience ('garden' | 'farm')
 *   4. country / region
 *   5. weather + recent tasks + scan history
 *
 *   import { hybridAnalyze } from '../core/hybridScanEngine.js';
 *   const refined = hybridAnalyze({
 *     imageResult, plantName, cropName,
 *     activeExperience, country, region,
 *     weather, recentTasks, scanHistory,
 *   });
 *
 * Strict rules
 *   * Pure function — no I/O, no React, no side effects.
 *   * Never throws. Every input branch is wrapped + falls
 *     through to a safe default ("Needs closer inspection").
 *   * NEVER emits "confirmed disease" / "guaranteed" / "exact
 *     dosage" language. The whole category set is action-
 *     framed: every value starts with "Possible ", "Looks ",
 *     "Needs ", or "Unknown".
 *   * Always returns a follow-up task + disclaimer so the
 *     caller can render an action without conditional logic.
 *
 * Coexists with `src/core/scanDetectionEngine.js` (which owns
 * the rule-based image classifier). This engine is the
 * SECOND-pass refinement: scanDetectionEngine produces the
 * image-only verdict, hybridAnalyze layers context on top.
 */

// Land Intelligence engine — provides the scale + risk + extra
// actions layer per the land-intelligence spec. Imported eagerly
// because both modules are pure helpers with no cross-imports;
// no circular-import risk.
import { landIntelligenceEngine } from './landIntelligenceEngine.js';

// ── Safe issue taxonomy (spec §2) ─────────────────────────────
export const ISSUES = Object.freeze({
  LOOKS_HEALTHY:                'Looks healthy',
  NEEDS_CLOSER_INSPECTION:      'Needs closer inspection',
  POSSIBLE_PEST_DAMAGE:         'Possible pest damage',
  POSSIBLE_FUNGAL_STRESS:       'Possible fungal stress',
  POSSIBLE_NUTRIENT_DEFICIENCY: 'Possible nutrient deficiency',
  POSSIBLE_WATER_STRESS:        'Possible water stress',
  POSSIBLE_HEAT_STRESS:         'Possible heat stress',
  POSSIBLE_TRANSPLANT_SHOCK:    'Possible transplant shock',
  UNKNOWN:                      'Unknown issue',
});

const ALLOWED_ISSUES = new Set(Object.values(ISSUES));

const URGENCY = Object.freeze({
  TODAY:     'Today',
  THIS_WEEK: 'This week',
  MONITOR:   'Monitor',
});

const DISCLAIMER =
  'Farroway provides guidance based on available information. '
  + 'Results are not guaranteed. For severe or spreading issues, '
  + 'contact a local expert.';

// ── Symptom detection from the image-only result ──────────────
//
// The existing engine emits a free-form `possibleIssue` string +
// optional `meta.symptoms` array. We look at both: any keyword
// match flips a flag. Detection is intentionally permissive —
// false positives just trigger "Needs closer inspection" via
// the rule pipeline below, never a wrong-confident verdict.
function _detectSymptoms(imageResult) {
  const out = {
    spots: false, yellow: false, holes: false, wilt: false,
    discoloration: false, unclear: false, healthy: false,
  };
  if (!imageResult || typeof imageResult !== 'object') {
    out.unclear = true;
    return out;
  }
  const text = String(imageResult.possibleIssue || '').toLowerCase();
  const symptoms = Array.isArray(imageResult.meta?.symptoms)
    ? imageResult.meta.symptoms.map((s) => String(s || '').toLowerCase())
    : [];
  const haystack = `${text} ${symptoms.join(' ')}`;

  if (/spot|leaf\s*spot|black\s*spot/.test(haystack))      out.spots = true;
  if (/yellow|chloros/.test(haystack))                      out.yellow = true;
  if (/hole|chew|nibble|insect|pest/.test(haystack))        out.holes = true;
  if (/wilt|droop|limp/.test(haystack))                      out.wilt = true;
  if (/brown|burn|scorch|crisp/.test(haystack))              out.discoloration = true;
  if (/unclear|blurry|dark|too\s*close|cannot/.test(haystack)) out.unclear = true;
  if (/healthy|looks?\s+(ok|fine|good)/.test(haystack))      out.healthy = true;

  // No detected symptoms + low confidence → unclear.
  const lowConfidence = String(imageResult.confidence || '').toLowerCase() === 'low';
  if (!out.spots && !out.yellow && !out.holes && !out.wilt
      && !out.discoloration && !out.healthy && lowConfidence) {
    out.unclear = true;
  }
  return out;
}

// ── Weather signals ──────────────────────────────────────────
function _weatherSignals(weather) {
  const w = (weather && typeof weather === 'object') ? weather : {};
  const tempC      = Number(w.temperatureC ?? w.tempC ?? w.temp);
  const humidity   = Number(w.humidity ?? w.relativeHumidity);
  const rainMm     = Number(w.rainMm ?? w.precipitationMm ?? w.rain);
  const recentRain = Boolean(w.recentRain ?? w.rainedRecently);
  const soilWet    = String(w.soil || '').toLowerCase() === 'wet';
  const soilDry    = String(w.soil || '').toLowerCase() === 'dry';

  return {
    hot:        Number.isFinite(tempC) && tempC >= 30,
    cold:       Number.isFinite(tempC) && tempC <= 5,
    humid:      Number.isFinite(humidity) && humidity >= 70,
    rainy:      recentRain || (Number.isFinite(rainMm) && rainMm >= 5),
    soilWet:    soilWet || recentRain,
    soilDry,
    hasSignal:  Number.isFinite(tempC) || Number.isFinite(humidity)
                || Number.isFinite(rainMm) || recentRain
                || soilWet || soilDry,
  };
}

// ── Action templates ────────────────────────────────────────
const GARDEN_BY_ISSUE = Object.freeze({
  [ISSUES.POSSIBLE_FUNGAL_STRESS]: [
    'Remove visibly affected leaves and bin them (don\u2019t compost).',
    'Water at the base of the plant, not the leaves.',
    'Improve airflow — space plants apart, prune crowded growth.',
    'Avoid watering in the evening so leaves dry before night.',
  ],
  [ISSUES.POSSIBLE_WATER_STRESS]: [
    'Water only if the top 2 cm of soil feels dry.',
    'Move container plants out of harsh sun if leaves are wilting.',
    'Check that pot drainage holes aren\u2019t blocked.',
    'Mulch the soil surface to slow evaporation.',
  ],
  [ISSUES.POSSIBLE_HEAT_STRESS]: [
    'Move container plants to partial shade for the next few days.',
    'Water in the early morning, not midday.',
    'Mulch the soil to keep roots cooler.',
  ],
  [ISSUES.POSSIBLE_PEST_DAMAGE]: [
    'Check under leaves and along stems for insects.',
    'Remove any obviously damaged leaves.',
    'If pests are confirmed, only use a locally approved home-garden pest-control option labelled for plants of this type, and follow the label.',
    'Avoid commercial-strength sprays on home plants.',
  ],
  [ISSUES.POSSIBLE_NUTRIENT_DEFICIENCY]: [
    'Add a balanced liquid feed at half the labeled strength.',
    'Check that drainage isn\u2019t flushing nutrients away too fast.',
    'Compost / aged manure helps if soil is poor.',
  ],
  [ISSUES.POSSIBLE_TRANSPLANT_SHOCK]: [
    'Keep the plant out of direct sun for a few days.',
    'Water lightly but keep soil consistently moist.',
    'Avoid feeding until new growth appears.',
  ],
  [ISSUES.NEEDS_CLOSER_INSPECTION]: [
    'Retake the photo in better light, focused on the affected area.',
    'Check under leaves for insects or webbing.',
    'Check whether soil is too dry or too wet.',
    'Monitor whether the issue spreads.',
  ],
  [ISSUES.LOOKS_HEALTHY]: [
    'Keep checking your plant daily.',
    'Water only when the top of the soil feels dry.',
  ],
  [ISSUES.UNKNOWN]: [
    'Retake the photo in better light, focused on the affected area.',
    'Monitor whether the issue spreads to other plants.',
  ],
});

const FARM_BY_ISSUE = Object.freeze({
  [ISSUES.POSSIBLE_FUNGAL_STRESS]: [
    'Scout 5\u201310 nearby rows for the same symptoms.',
    'Record the affected area in your field log.',
    'Avoid spraying during high wind or heat.',
    'Review local extension guidance before applying any chemicals.',
  ],
  [ISSUES.POSSIBLE_WATER_STRESS]: [
    'Check irrigation coverage in the affected block.',
    'Note recent rainfall — adjust the schedule accordingly.',
    'Scout the surrounding area to see how widespread the issue is.',
  ],
  [ISSUES.POSSIBLE_HEAT_STRESS]: [
    'Avoid spraying or fertilizing during peak heat.',
    'Plan irrigation for early morning to limit evaporation.',
    'Check the rest of the field for similar wilting.',
  ],
  [ISSUES.POSSIBLE_PEST_DAMAGE]: [
    'Scout nearby rows for spread.',
    'Record the affected field area.',
    'Review local extension guidance before any chemical action.',
    'Avoid spraying during high wind.',
  ],
  [ISSUES.POSSIBLE_NUTRIENT_DEFICIENCY]: [
    'Pull a soil sample from the affected zone for testing.',
    'Compare with a healthy area as a control.',
    'Review your fertilizer schedule before adjusting rates.',
  ],
  [ISSUES.POSSIBLE_TRANSPLANT_SHOCK]: [
    'Check that root contact with soil is good across the block.',
    'Maintain consistent soil moisture for the next 7\u201310 days.',
  ],
  [ISSUES.NEEDS_CLOSER_INSPECTION]: [
    'Scout nearby rows for similar signs.',
    'Retake the photo in better light, focused on the affected leaf.',
    'Record the affected field area for follow-up.',
    'Check the field again tomorrow morning.',
  ],
  [ISSUES.LOOKS_HEALTHY]: [
    'Continue routine scouting on schedule.',
    'Keep an eye on weather + irrigation timing.',
  ],
  [ISSUES.UNKNOWN]: [
    'Scout nearby rows for similar signs.',
    'Retake the photo in better light if possible.',
    'Check the field again tomorrow morning.',
  ],
});

// ── Rule pipeline (spec §3) ──────────────────────────────────
//
// First-match wins. Earlier rules are stricter (need both image
// AND weather to fire); later rules degrade to image-only or
// finally to the catch-all "Needs closer inspection".
function _resolveIssue(symptoms, weather) {
  // Healthy signal in image overrides everything.
  if (symptoms.healthy && !symptoms.spots && !symptoms.yellow
      && !symptoms.holes && !symptoms.wilt) {
    return { issue: ISSUES.LOOKS_HEALTHY, contextSupport: 'image' };
  }

  // Unclear image → safe fallback.
  if (symptoms.unclear) {
    return { issue: ISSUES.NEEDS_CLOSER_INSPECTION, contextSupport: null };
  }

  // Spots + (humid OR rainy) → fungal.
  if (symptoms.spots && (weather.humid || weather.rainy)) {
    return { issue: ISSUES.POSSIBLE_FUNGAL_STRESS, contextSupport: 'weather' };
  }

  // Yellow leaves + (wet soil OR recent rain) → water stress (over).
  if (symptoms.yellow && (weather.soilWet || weather.rainy)) {
    return { issue: ISSUES.POSSIBLE_WATER_STRESS, contextSupport: 'weather' };
  }

  // Wilt + dry soil + hot → water stress (under).
  if ((symptoms.wilt || symptoms.discoloration)
      && weather.soilDry && weather.hot) {
    return { issue: ISSUES.POSSIBLE_WATER_STRESS, contextSupport: 'weather' };
  }

  // Heat + discoloration with no other signal → heat stress.
  if (weather.hot && symptoms.discoloration && !symptoms.spots) {
    return { issue: ISSUES.POSSIBLE_HEAT_STRESS, contextSupport: 'weather' };
  }

  // Image-only fallthroughs.
  if (symptoms.holes) {
    return { issue: ISSUES.POSSIBLE_PEST_DAMAGE, contextSupport: 'image' };
  }
  if (symptoms.spots) {
    return { issue: ISSUES.POSSIBLE_FUNGAL_STRESS, contextSupport: 'image' };
  }
  if (symptoms.yellow) {
    return { issue: ISSUES.POSSIBLE_NUTRIENT_DEFICIENCY, contextSupport: 'image' };
  }
  if (symptoms.wilt) {
    return { issue: ISSUES.POSSIBLE_WATER_STRESS, contextSupport: 'image' };
  }

  // Nothing matched → safe default.
  return { issue: ISSUES.NEEDS_CLOSER_INSPECTION, contextSupport: null };
}

// ── Confidence (spec §6) ─────────────────────────────────────
function _confidence(symptoms, weather, contextSupport, imageResult) {
  if (symptoms.unclear) return 'low';
  if (contextSupport === 'weather') return 'high';
  if (contextSupport === 'image' && weather.hasSignal) return 'medium';
  if (contextSupport === 'image') return 'medium';
  // Honor a high-confidence image-only verdict when nothing
  // overrode it (very rare with our permissive detection).
  const c = String(imageResult?.confidence || '').toLowerCase();
  if (c === 'high') return 'medium';
  return 'low';
}

// ── Reason text — short, factual, never overconfident ────────
function _reason(symptoms, weather, issue) {
  const parts = [];
  if (symptoms.spots)         parts.push('spots visible on leaves');
  if (symptoms.yellow)        parts.push('yellowing visible');
  if (symptoms.holes)         parts.push('holes / chew marks visible');
  if (symptoms.wilt)          parts.push('drooping or wilting visible');
  if (symptoms.discoloration) parts.push('discolored areas visible');
  if (symptoms.healthy && parts.length === 0) parts.push('no obvious damage');

  if (weather.humid)   parts.push('humid weather');
  if (weather.rainy)   parts.push('recent rain');
  if (weather.soilWet) parts.push('wet soil');
  if (weather.soilDry) parts.push('dry soil');
  if (weather.hot)     parts.push('hot weather');

  if (parts.length === 0) {
    return `Image is unclear or context is missing — flagged as ${issue}.`;
  }
  return `Based on ${parts.join(' + ')}.`;
}

// ── Urgency mapping ─────────────────────────────────────────
function _urgency(issue) {
  if (issue === ISSUES.LOOKS_HEALTHY) return URGENCY.MONITOR;
  if (issue === ISSUES.NEEDS_CLOSER_INSPECTION) return URGENCY.TODAY;
  if (issue === ISSUES.POSSIBLE_FUNGAL_STRESS
      || issue === ISSUES.POSSIBLE_PEST_DAMAGE) {
    return URGENCY.TODAY;
  }
  return URGENCY.THIS_WEEK;
}

// ── Follow-up task (spec §7) ────────────────────────────────
function _followUpTask(activeExperience, plantOrCropName) {
  const isGarden = activeExperience === 'garden';
  if (isGarden) {
    return {
      id:         'hybrid_followup_garden',
      title:      plantOrCropName
                    ? `Check your ${plantOrCropName} again tomorrow`
                    : 'Check this plant again tomorrow',
      reason:     'See if the issue has changed or spread.',
      urgency:    'medium',
      actionType: 'inspect',
    };
  }
  return {
    id:         'hybrid_followup_farm',
    title:      'Scout nearby crop area tomorrow',
    reason:     'Confirm whether the issue is contained or spreading.',
    urgency:    'medium',
    actionType: 'inspect',
  };
}

// ── Public API ──────────────────────────────────────────────
/**
 * hybridAnalyze(input) → refined verdict.
 *
 * @param {object} input
 * @param {object} input.imageResult       output of analyzeScan
 * @param {string} [input.plantName]       garden context label
 * @param {string} [input.cropName]        farm context label
 * @param {'garden'|'farm'|string} [input.activeExperience]
 * @param {string} [input.country]
 * @param {string} [input.region]
 * @param {object} [input.weather]         { temperatureC, humidity, rainMm, soil, recentRain }
 * @param {'container'|'bed'|'ground'|'unknown'} [input.growingSetup]
 *   Backyard growing-setup spec \u00a76 \u2014 personalises the scan
 *   action list for garden users (pot vs bed vs ground). Ignored
 *   when activeExperience is 'farm'.
 * @param {Array}  [input.recentTasks]     reserved \u2014 future signal
 * @param {Array}  [input.scanHistory]     reserved \u2014 future signal
 * @returns {{
 *   possibleIssue: string,
 *   confidence:    'low'|'medium'|'high',
 *   reason:        string,
 *   recommendedActions: string[],
 *   urgency:       string,
 *   followUpTask:  object,
 *   disclaimer:    string,
 *   contextType:   'garden'|'farm'|'generic',
 * }}
 */
export function hybridAnalyze(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};
  const symptoms = _detectSymptoms(safe.imageResult);
  const weather  = _weatherSignals(safe.weather);
  const { issue, contextSupport } = _resolveIssue(symptoms, weather);
  const confidence = _confidence(symptoms, weather, contextSupport, safe.imageResult);

  const exp = String(safe.activeExperience || '').toLowerCase();
  const isGarden = exp === 'garden' || exp === 'backyard';
  const contextType = isGarden ? 'garden' : (exp === 'farm' ? 'farm' : 'generic');
  const actionsTable = isGarden ? GARDEN_BY_ISSUE : FARM_BY_ISSUE;
  let recommendedActions = (actionsTable[issue] || actionsTable[ISSUES.NEEDS_CLOSER_INSPECTION]).slice();

  // Land Intelligence — append scale-aware actions per spec §5
  // and risk-driven enrichment per spec §6. Pure function; never
  // throws. We dedupe case-insensitively so the scale extras
  // don't double up on existing garden/farm advice.
  let scaleType = isGarden ? 'small' : null;
  let riskProfile = [];
  try {
    const land = landIntelligenceEngine({
      sizeSqFt:         safe.sizeSqFt || (safe.imageResult?.sizeSqFt) || null,
      country:          safe.country  || null,
      region:           safe.region   || null,
      cropName:         safe.cropName || safe.plantName || null,
      plantName:        safe.plantName || null,
      activeExperience: isGarden ? 'garden' : (exp === 'farm' ? 'farm' : null),
      weather:          safe.weather  || null,
    });
    scaleType = land.scaleType;
    riskProfile = land.riskProfile;
    const seen = new Set(recommendedActions.map((s) => String(s || '').trim().toLowerCase()));
    for (const a of [...land.scanContextAdjustment, ...land.suggestedActions]) {
      const k = String(a || '').trim().toLowerCase();
      if (k && !seen.has(k)) {
        recommendedActions.push(a);
        seen.add(k);
      }
    }
  } catch { /* land enrichment is best-effort \u2014 ignore */ }

  // Backyard growing-setup spec \u00a76 \u2014 garden-only scan action
  // enrichment. When the user told us they grow in a pot / bed /
  // ground, append the matching action so the scan output reads
  // like the app understands their setup. Hard-capped at 3
  // total recommendedActions per spec ("Keep actions max 3").
  if (isGarden && typeof safe.growingSetup === 'string') {
    const SETUP_ACTIONS = {
      container: [
        'Check pot drainage',
        'Avoid letting water sit in the container',
      ],
      bed: [
        'Check nearby plants for similar signs',
        'Improve airflow between plants',
      ],
      ground: [
        'Check soil around the plant',
        'Remove nearby weeds if present',
      ],
    };
    const setup = String(safe.growingSetup).toLowerCase();
    const extras = SETUP_ACTIONS[setup] || [];
    if (extras.length > 0) {
      const seen = new Set(recommendedActions.map((s) => String(s || '').trim().toLowerCase()));
      for (const a of extras) {
        if (recommendedActions.length >= 3) break;
        const k = String(a || '').trim().toLowerCase();
        if (k && !seen.has(k)) {
          recommendedActions.push(a);
          seen.add(k);
        }
      }
      // Trim to 3 in case prior land-enrichment pushed past the
      // cap; keep the head of the list (issue-specific +
      // setup-specific actions sit at the front).
      recommendedActions = recommendedActions.slice(0, 3);
    }
  }

  const plantOrCrop = isGarden
    ? (safe.plantName || safe.cropName || null)
    : (safe.cropName  || safe.plantName || null);

  return {
    possibleIssue: ALLOWED_ISSUES.has(issue) ? issue : ISSUES.NEEDS_CLOSER_INSPECTION,
    confidence,
    reason:        _reason(symptoms, weather, issue),
    recommendedActions,
    urgency:       _urgency(issue),
    followUpTask:  _followUpTask(isGarden ? 'garden' : 'farm', plantOrCrop),
    disclaimer:    DISCLAIMER,
    contextType,
    // Land context surfaced for callers that want to render
    // additional UI (e.g. "Scout nearby rows" badge for large
    // farms). Both fields are present even when land data is
    // missing — scaleType defaults to 'small'/null per the
    // engine's internal fallback.
    scaleType,
    riskProfile,
  };
}

export const _internal = Object.freeze({
  _detectSymptoms,
  _weatherSignals,
  _resolveIssue,
  _confidence,
  GARDEN_BY_ISSUE,
  FARM_BY_ISSUE,
  DISCLAIMER,
});

export default hybridAnalyze;
