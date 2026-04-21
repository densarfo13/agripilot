/**
 * farmerSignalEngine.js — cross-source risk signal aggregator.
 *
 * Purpose:
 *   The existing engines each look at one surface:
 *     - healthTriageEngine  → symptom-only triage
 *     - reminderEngine      → weather + today-readiness
 *     - issueStore          → raw issue history
 *     - dailyTaskEngine     → upcoming + overdue tasks
 *
 *   A real "is this farm in trouble?" read needs to combine them.
 *   This module is that combiner. It never claims a specific disease,
 *   never prescribes a treatment, and is fully deterministic.
 *
 *   getFarmerSignals({
 *     farm, tasks, completions, issues, regionProfile, weather,
 *     symptomReport?, imageMeta?, now?,
 *   }) → {
 *     signalScore:        0..100,
 *     riskLevel:          'low' | 'medium' | 'high',
 *     likelyCategory:     'pest' | 'disease' | 'nutrient_deficiency'
 *                          | 'water_stress' | 'physical_damage' | 'unknown',
 *     likelyCategoryKey,  // i18n key, e.g. 'signal.category.disease'
 *     likelyCategoryFallback, // English fallback ("Possible disease risk")
 *     confidenceLevel:    'low' | 'medium' | 'high',
 *     reasons:            Array<{ rule, detail }>,
 *     suggestedActionKey,
 *     suggestedActionFallback,
 *     requiresReview:     boolean,
 *     severityTone:       'info' | 'warn' | 'danger',
 *     farmType,                    // echoed / defaulted to small_farm
 *   }
 *
 * Safety:
 *   • output uses the same category vocabulary as healthTriageEngine
 *   • wording is safe-hedged ("possible", "likely", "may be")
 *   • never auto-prescribes pesticides / dosages
 *   • `unknown` + requiresReview=true is a valid, useful answer
 */

import { triageFarmHealthIssue, CATEGORY_LABELS, NEXT_STEPS } from '../issues/healthTriageEngine.js';

// ─── Scoring constants ───────────────────────────────────────────
export const SCORE_WEIGHTS = Object.freeze({
  SYMPTOM_PRESENT:        20,   // farmer took the time to describe a problem
  SYMPTOM_MULTI_MATCH:    15,   // triage produced ≥ medium confidence
  PHOTO_PRESENT:          10,   // evidence-quality booster (not diagnosis)
  EXTENT_MANY_PLANTS:     15,   // widespread → outbreak shape
  MISSED_TASKS_FEW:       10,   // 2 missed tasks of a relevant type
  MISSED_TASKS_MANY:      20,   // 3+ missed → care pattern failing
  WEATHER_STRESS:         15,   // excessive heat / drought / heavy rain
  REPEAT_UNRESOLVED:      15,   // ≥2 unresolved same-category issues (14d)
});

// Band edges (spec §3). Backyard uses a gentler "high" threshold to
// avoid false alarms; commercial uses a lower threshold to trigger
// proactive warnings earlier.
const DEFAULT_BAND_HIGH = 60;
const DEFAULT_BAND_MEDIUM = 30;

// Category keyword taxonomy for turning free-form task ids/titles and
// issue types into a signal bucket. Matched as substrings (case
// insensitive) — if the engine's input shape ever changes, we degrade
// gracefully rather than crash.
const TASK_CATEGORY_KEYWORDS = Object.freeze({
  irrigation:      ['water', 'irrig', 'drain', 'moisture'],
  pest_inspection: ['pest', 'inspect', 'scout'],
  fertilizer:      ['fertil', 'feed', 'nutrient', 'manure'],
  weeding:         ['weed'],
  disease_check:   ['disease', 'mold', 'fungus', 'rot'],
});

const WEATHER_STRESS_STATUSES = new Set([
  'excessive_heat', 'low_rain', 'dry_ahead',
  'heavy_rain', 'rain_expected', 'rain_coming', 'standing_water',
]);

// ─── Small helpers ───────────────────────────────────────────────
function lower(s) { return String(s || '').toLowerCase(); }
function isFiniteNum(x) { return Number.isFinite(x); }

function countMatches(needles, haystack) {
  const h = lower(haystack);
  if (!h) return 0;
  let n = 0;
  for (const needle of needles) if (h.includes(needle)) n += 1;
  return n;
}

/**
 * categoriseTask — best-effort bucket for a task-like object. Looks
 * at explicit `.category`, `.type`, `.bucket`, then falls back to
 * keyword matching on id / title / titleKey.
 */
function categoriseTask(task) {
  if (!task || typeof task !== 'object') return null;
  const explicit = lower(task.category || task.type || task.bucket);
  if (explicit in TASK_CATEGORY_KEYWORDS) return explicit;
  const corpus = `${task.id || ''} ${task.title || ''} ${task.titleKey || ''}`;
  for (const [bucket, needles] of Object.entries(TASK_CATEGORY_KEYWORDS)) {
    if (countMatches(needles, corpus) > 0) return bucket;
  }
  return null;
}

/**
 * Count missed tasks per category. A task is "missed" if it carries
 * `overdue === true` / `isOverdue === true`, or if `missedCount`/
 * `missedTimes` is a positive number (we treat that as the number of
 * windows it was skipped — caps at 5 so a single stale record can't
 * drown the scoring).
 */
function missedByCategory(tasks) {
  const out = {
    irrigation: 0, pest_inspection: 0, fertilizer: 0,
    weeding:    0, disease_check:  0,
    _total: 0,
  };
  if (!Array.isArray(tasks)) return out;
  for (const t of tasks) {
    if (!t || typeof t !== 'object') continue;
    const cat = categoriseTask(t);
    if (!cat) continue;
    let misses = 0;
    if (t.overdue === true || t.isOverdue === true) misses += 1;
    const n = Number(t.missedCount != null ? t.missedCount : t.missedTimes);
    if (isFiniteNum(n) && n > 0) misses += Math.min(5, Math.max(0, Math.round(n)));
    if (misses === 0) continue;
    out[cat] = (out[cat] || 0) + misses;
    out._total += misses;
  }
  return out;
}

/**
 * Count unresolved issues for this farm in the last 14 days, bucketed
 * by (normalised) issue type. Issues whose status is 'resolved' are
 * ignored; anything else counts as "still pressing".
 */
function unresolvedIssueHistory({ issues, farmId, now }) {
  const out = { byType: {}, total: 0 };
  if (!Array.isArray(issues)) return out;
  const cutoff = (now || Date.now()) - 14 * 24 * 3600 * 1000;
  for (const iss of issues) {
    if (!iss || typeof iss !== 'object') continue;
    if (farmId && iss.farmId && iss.farmId !== farmId) continue;
    if (lower(iss.status) === 'resolved') continue;
    const ts = Number(iss.createdAt || iss.timestamp || 0);
    if (isFiniteNum(ts) && ts > 0 && ts < cutoff) continue;
    const type = lower(iss.issueType || iss.type || 'other');
    out.byType[type] = (out.byType[type] || 0) + 1;
    out.total += 1;
  }
  return out;
}

function weatherIsStressful(weather) {
  if (!weather || typeof weather !== 'object') return false;
  const st = lower(weather.status);
  return WEATHER_STRESS_STATUSES.has(st);
}

// Canonicalise farmType the same way farmTypeBehavior does, but kept
// inline to keep this module free of cross-deps (behavior helper can
// still call *this* one without a cycle).
function _tier(farmType) {
  const s = lower(farmType);
  if (s === 'backyard' || s === 'home_food' || s === 'home' || s === 'backyard_home') return 'backyard';
  if (s === 'commercial' || s === 'commercial_farm' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

function bandFor(score, tier) {
  // Backyard nudges the "high" line up so a single weather+photo
  // combo does not scare a hobby grower. Commercial nudges it down
  // so operational teams see the warning sooner.
  const high = tier === 'backyard' ? 65 : tier === 'commercial' ? 55 : DEFAULT_BAND_HIGH;
  const medium = DEFAULT_BAND_MEDIUM;
  if (score >= high) return 'high';
  if (score >= medium) return 'medium';
  return 'low';
}

function toneFor(riskLevel) {
  if (riskLevel === 'high')   return 'danger';
  if (riskLevel === 'medium') return 'warn';
  return 'info';
}

// Confidence ladder helpers.
const CONF_ORDER = ['low', 'medium', 'high'];
function bumpConfidence(level, steps = 1) {
  const idx = Math.max(0, CONF_ORDER.indexOf(level));
  return CONF_ORDER[Math.min(CONF_ORDER.length - 1, idx + steps)];
}
function capConfidence(level, max) {
  const idx = Math.max(0, CONF_ORDER.indexOf(level));
  const cap = Math.max(0, CONF_ORDER.indexOf(max));
  return CONF_ORDER[Math.min(idx, cap)];
}

// ─── Category biasing (spec §4) ──────────────────────────────────
/**
 * Given a base category (from symptom triage, or null) and the
 * surrounding evidence, nudge the category toward the one the
 * non-symptom evidence best supports. Never overrides a STRONG
 * symptom signal — we only move when the base is 'unknown' or the
 * base was inferred from a single weak signal.
 */
function biasCategory({
  baseCategory, baseConfidence,
  weather, missed, unresolved, extent, symptomReport,
}) {
  // Strong symptom evidence wins — only refine when we have little.
  const canOverride = !baseCategory
    || baseCategory === 'unknown'
    || baseConfidence === 'low';

  const wStatus = lower(weather && weather.status);
  const wet = wStatus === 'heavy_rain' || wStatus === 'rain_expected' || wStatus === 'rain_coming' || wStatus === 'standing_water';
  const dry = wStatus === 'excessive_heat' || wStatus === 'low_rain' || wStatus === 'dry_ahead';

  // Strong "many plants + wet weather" → disease even without a
  // symptom — it's the classic outbreak shape.
  if (canOverride && wet && (extent === 'many_plants' || extent === 'most_of_farm')) {
    return 'disease';
  }
  // Dry weather + wilting-like symptoms → water stress.
  if (canOverride && dry && (missed.irrigation >= 1 || baseCategory === 'unknown')) {
    return 'water_stress';
  }
  // Pest inspection missed ≥2× + any pest symptom mention → pest.
  if (canOverride && missed.pest_inspection >= 2) return 'pest';
  // Repeated unresolved disease-like issues → disease leans.
  if (canOverride && ((unresolved.byType.disease || 0)
                    + (unresolved.byType.pest || 0)) >= 2) {
    const topType = (unresolved.byType.disease || 0) >= (unresolved.byType.pest || 0)
      ? 'disease' : 'pest';
    return topType;
  }
  // Nothing strong; if we had a base category, keep it. If we didn't
  // and there's no symptom report at all, stay 'unknown'.
  if (baseCategory && baseCategory !== 'unknown') return baseCategory;
  return symptomReport ? baseCategory || 'unknown' : 'unknown';
}

// ─── Main entry ──────────────────────────────────────────────────
/**
 * getFarmerSignals — aggregate every surface we know about into one
 * explainable snapshot. Safe on any missing input.
 */
export function getFarmerSignals({
  farm           = null,
  tasks          = [],
  completions    = [],    // reserved for future "completed vs scheduled" use
  issues         = [],
  regionProfile  = null,  // reserved — used by callers feeding neighbours
  weather        = null,
  symptomReport  = null,
  imageMeta      = null,
  now            = null,
} = {}) {
  // `completions` + `regionProfile` are accepted today for future use
  // without breaking the call site; lint helpers are intentional.
  void completions; void regionProfile;

  const farmType = _tier((farm && farm.farmType) || null);
  const reasons  = [];
  let score = 0;

  // ── A. Symptom report ───────────────────────────────────────────
  let triage = null;
  let baseCategory = null;
  let baseConfidence = 'low';
  if (symptomReport && typeof symptomReport === 'object') {
    triage = triageFarmHealthIssue({
      crop:              (farm && (farm.crop || farm.cropType)) || symptomReport.crop || null,
      region:            (farm && (farm.location || farm.stateCode)) || null,
      symptoms:          symptomReport.symptoms || [],
      affectedPart:      symptomReport.affectedPart || null,
      extent:            symptomReport.extent || null,
      duration:          symptomReport.duration || null,
      weather,
      description:       symptomReport.description || '',
      recentFarmReports: symptomReport.recentFarmReports || 0,
    });
    baseCategory   = triage.predictedCategory;
    baseConfidence = triage.confidenceLevel;
    score += SCORE_WEIGHTS.SYMPTOM_PRESENT;
    reasons.push({ rule: 'symptom_present',
                   detail: `Symptom report provided (+${SCORE_WEIGHTS.SYMPTOM_PRESENT})` });
    if (baseConfidence === 'medium' || baseConfidence === 'high') {
      score += SCORE_WEIGHTS.SYMPTOM_MULTI_MATCH;
      reasons.push({ rule: 'symptom_multi_match',
                     detail: `Multiple matching symptoms for ${baseCategory} (+${SCORE_WEIGHTS.SYMPTOM_MULTI_MATCH})` });
    }
  }

  // ── B. Photo presence ──────────────────────────────────────────
  const hasPhoto = !!(imageMeta && (imageMeta.url || imageMeta.dataUrl
                                 || imageMeta.filename || imageMeta.present === true));
  if (hasPhoto) {
    score += SCORE_WEIGHTS.PHOTO_PRESENT;
    reasons.push({ rule: 'photo_attached',
                   detail: `Photo attached (+${SCORE_WEIGHTS.PHOTO_PRESENT})` });
  }

  // ── C. Extent bonus (many plants) ─────────────────────────────
  const extent = lower(symptomReport && symptomReport.extent);
  if (extent === 'many_plants' || extent === 'most_of_farm') {
    score += SCORE_WEIGHTS.EXTENT_MANY_PLANTS;
    reasons.push({ rule: 'extent_widespread',
                   detail: `Many plants affected (+${SCORE_WEIGHTS.EXTENT_MANY_PLANTS})` });
  }

  // ── D. Missed tasks ────────────────────────────────────────────
  const missed = missedByCategory(tasks);
  if (missed._total >= 3) {
    score += SCORE_WEIGHTS.MISSED_TASKS_MANY;
    reasons.push({ rule: 'missed_tasks_many',
                   detail: `3+ missed routine tasks (+${SCORE_WEIGHTS.MISSED_TASKS_MANY})` });
  } else if (missed._total >= 2) {
    score += SCORE_WEIGHTS.MISSED_TASKS_FEW;
    reasons.push({ rule: 'missed_tasks_few',
                   detail: `Repeated missed tasks (+${SCORE_WEIGHTS.MISSED_TASKS_FEW})` });
  }

  // ── E. Weather stress ─────────────────────────────────────────
  if (weatherIsStressful(weather)) {
    score += SCORE_WEIGHTS.WEATHER_STRESS;
    reasons.push({ rule: 'weather_stress',
                   detail: `Weather pressure (${lower(weather.status)}) +${SCORE_WEIGHTS.WEATHER_STRESS}` });
  }

  // ── F. Repeated unresolved issues ──────────────────────────────
  const unresolved = unresolvedIssueHistory({
    issues, farmId: farm && farm.id, now: now || Date.now(),
  });
  const repeatingType = Object.entries(unresolved.byType)
    .sort((a, b) => b[1] - a[1])[0];
  if (repeatingType && repeatingType[1] >= 2) {
    score += SCORE_WEIGHTS.REPEAT_UNRESOLVED;
    reasons.push({ rule: 'repeat_unresolved',
                   detail: `Repeated unresolved ${repeatingType[0]} issues (+${SCORE_WEIGHTS.REPEAT_UNRESOLVED})` });
  }

  if (score > 100) score = 100;

  // ── Category inference ─────────────────────────────────────────
  let likelyCategory = biasCategory({
    baseCategory, baseConfidence,
    weather, missed, unresolved, extent, symptomReport,
  });

  // ── Confidence inference ───────────────────────────────────────
  // Start from triage (if any), else 'low'. Nudge upward when
  // independent signals corroborate; cap when signals are thin.
  let confidenceLevel = baseConfidence;

  if (!symptomReport) {
    // Without a symptom report the best we can do is weather + missed
    // tasks + history. Be modest about certainty.
    const corroborating =
      (weatherIsStressful(weather) ? 1 : 0)
      + (missed._total >= 2 ? 1 : 0)
      + (unresolved.total >= 2 ? 1 : 0);
    confidenceLevel = corroborating >= 2 ? 'medium' : 'low';
  } else {
    if (hasPhoto && likelyCategory !== 'unknown') {
      confidenceLevel = bumpConfidence(confidenceLevel, 1);
      reasons.push({ rule: 'photo_corroborates', detail: 'Photo present with clear category' });
    }
    const wStatus = lower(weather && weather.status);
    const weatherMatchesCategory =
         (likelyCategory === 'disease'       && (wStatus === 'heavy_rain' || wStatus === 'rain_expected' || wStatus === 'standing_water'))
      || (likelyCategory === 'water_stress'  && (wStatus === 'excessive_heat' || wStatus === 'low_rain' || wStatus === 'dry_ahead'))
      || (likelyCategory === 'pest'          && (wStatus === 'ok' || wStatus === 'low_rain'));
    if (weatherMatchesCategory) {
      confidenceLevel = bumpConfidence(confidenceLevel, 1);
      reasons.push({ rule: 'weather_corroborates', detail: 'Weather pattern matches category' });
    }
    if (unresolved.total >= 2) {
      confidenceLevel = bumpConfidence(confidenceLevel, 1);
      reasons.push({ rule: 'history_corroborates', detail: 'Same farm has repeated open issues' });
    }
  }
  // Hard cap: "unknown" must never be high-confidence.
  if (likelyCategory === 'unknown') confidenceLevel = capConfidence(confidenceLevel, 'medium');
  if (likelyCategory === 'unknown' && score < 45) confidenceLevel = 'low';

  // ── Risk band (tier-aware) ─────────────────────────────────────
  const riskLevel = bandFor(score, farmType);

  // ── Review routing (spec §9) ───────────────────────────────────
  const seriousSymptoms = !!(symptomReport && Array.isArray(symptomReport.symptoms)
    && symptomReport.symptoms.some((s) =>
      ['mold_fungus', 'rotting', 'spreading'].includes(lower(s).replace(/\s+/g, '_'))));
  const seriousExtent = extent === 'most_of_farm';
  const requiresReview =
       riskLevel === 'high'
    || (confidenceLevel === 'low' && (seriousSymptoms || seriousExtent))
    || (unresolved.total >= 3)
    || (likelyCategory === 'unknown' && !!symptomReport)
    || (likelyCategory === 'disease' && (extent === 'many_plants' || seriousExtent));

  if (requiresReview) {
    reasons.push({ rule: 'officer_review_required',
                   detail: likelyCategory === 'unknown'
                     ? 'Signals are inconclusive — human review recommended'
                     : 'Severity, spread, or history warrants officer confirmation' });
  }

  // ── Farm-type copy adjustment (spec §11) ───────────────────────
  //   backyard   → trim noise, never echo alarmist "spread" copy
  //   commercial → add an operational nudge
  let trimmedReasons = reasons;
  if (farmType === 'backyard') {
    trimmedReasons = reasons.slice(0, 2);
  } else if (farmType === 'commercial') {
    trimmedReasons = reasons.slice(0, 6);
    if (riskLevel !== 'low') {
      trimmedReasons = trimmedReasons.concat([{
        rule: 'commercial_operations_hint',
        detail: 'Consider notifying operations lead and logging a field check.',
      }]);
    }
  }

  // ── Safe suggested next step (spec §7) ─────────────────────────
  const actionKeyOverrides = farmTypeActionOverride({
    farmType, likelyCategory, riskLevel, requiresReview,
  });
  const defaultNext = NEXT_STEPS[likelyCategory] || NEXT_STEPS.unknown;
  const nextKey      = actionKeyOverrides.key      || defaultNext.key;
  const nextFallback = actionKeyOverrides.fallback || defaultNext.en;

  const label = CATEGORY_LABELS[likelyCategory] || CATEGORY_LABELS.unknown;

  return Object.freeze({
    signalScore:             score,
    riskLevel,
    likelyCategory,
    likelyCategoryKey:       `signal.category.${likelyCategory}`,
    likelyCategoryFallback:  label.en,
    confidenceLevel,
    reasons:                 Object.freeze(trimmedReasons.map(Object.freeze)),
    suggestedActionKey:      nextKey,
    suggestedActionFallback: nextFallback,
    requiresReview:          !!requiresReview,
    severityTone:            toneFor(riskLevel),
    farmType,
    // Optional details for officer/admin surfaces — frozen so UI can't
    // mutate and callers can be sure the shape is stable.
    details: Object.freeze({
      missedByCategory: Object.freeze({ ...missed }),
      unresolvedByType: Object.freeze({ ...unresolved.byType }),
      unresolvedTotal:  unresolved.total,
      hasPhoto,
      triage,                           // full triage object when available
    }),
  });
}

/**
 * farmTypeActionOverride — per-tier safe next step.
 *
 * Backyard: plainer language, no "field officer" unless really needed.
 * Commercial: more operational wording ("schedule a field inspection").
 * Small farm: keep healthTriageEngine defaults.
 */
function farmTypeActionOverride({ farmType, likelyCategory, riskLevel, requiresReview }) {
  if (farmType === 'backyard') {
    if (likelyCategory === 'water_stress') {
      return { key: 'signal.next.backyard.water_stress',
               fallback: 'Check the soil and water gently in the morning.' };
    }
    if (likelyCategory === 'pest') {
      return { key: 'signal.next.backyard.pest',
               fallback: 'Look at nearby plants and remove any damaged leaves you see.' };
    }
    if (likelyCategory === 'disease') {
      return { key: 'signal.next.backyard.disease',
               fallback: 'Keep affected plants separate and watch them for a few days.' };
    }
    if (requiresReview) {
      return { key: 'signal.next.backyard.review',
               fallback: 'Share what you see with someone who can help review it.' };
    }
  }
  if (farmType === 'commercial') {
    if (riskLevel === 'high' || requiresReview) {
      return { key: 'signal.next.commercial.review',
               fallback: 'Schedule a field inspection and log findings in today\u2019s report.' };
    }
    if (likelyCategory === 'disease') {
      return { key: 'signal.next.commercial.disease',
               fallback: 'Isolate affected sections and check neighbouring blocks before operations resume.' };
    }
    if (likelyCategory === 'water_stress') {
      return { key: 'signal.next.commercial.water_stress',
               fallback: 'Verify irrigation schedule and soil moisture across sections.' };
    }
  }
  return { key: null, fallback: null };
}

// ─── Learning loop (spec §10) ────────────────────────────────────
/**
 * recordSignalOutcome — stores predicted vs confirmed after an
 * officer/admin closes an issue. Writes to localStorage under
 * `farroway.signalOutcomes` using the same offline-first pattern as
 * the rest of the app. Noop in non-browser environments.
 *
 *   recordSignalOutcome({
 *     issueId, farmId,
 *     predictedCategory, confirmedCategory,
 *     predictedConfidence, signalScore,
 *     outcome: 'correct' | 'incorrect' | 'partial',
 *     ts?,
 *   })
 */
const OUTCOME_KEY = 'farroway.signalOutcomes';

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function recordSignalOutcome(entry = {}) {
  if (!hasStorage()) return null;
  const record = {
    issueId:             entry.issueId || null,
    farmId:              entry.farmId || null,
    predictedCategory:   entry.predictedCategory || 'unknown',
    confirmedCategory:   entry.confirmedCategory || 'unknown',
    predictedConfidence: entry.predictedConfidence || 'low',
    signalScore:         Number.isFinite(entry.signalScore) ? entry.signalScore : null,
    outcome:             entry.outcome
      || (entry.predictedCategory === entry.confirmedCategory ? 'correct' : 'incorrect'),
    ts: entry.ts || Date.now(),
  };
  try {
    const raw = window.localStorage.getItem(OUTCOME_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(record);
    // Keep the last 500 — learning stats don't need more and storage
    // quota matters on low-end devices.
    const trimmed = list.slice(-500);
    window.localStorage.setItem(OUTCOME_KEY, JSON.stringify(trimmed));
    return record;
  } catch { return null; }
}

export function getSignalOutcomes({ farmId = null } = {}) {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(OUTCOME_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return farmId ? list.filter((r) => r && r.farmId === farmId) : list;
  } catch { return []; }
}

/**
 * getOutcomeStats — simple aggregate the admin dashboard can show
 * without extra math: counts of correct / incorrect / partial by
 * predicted category.
 */
export function getOutcomeStats({ farmId = null } = {}) {
  const rows = getSignalOutcomes({ farmId });
  const by = {};
  let total = 0; let correct = 0;
  for (const r of rows) {
    if (!r) continue;
    total += 1;
    if (r.outcome === 'correct') correct += 1;
    const cat = r.predictedCategory || 'unknown';
    by[cat] = by[cat] || { correct: 0, incorrect: 0, partial: 0, total: 0 };
    by[cat].total += 1;
    if (r.outcome === 'correct')   by[cat].correct += 1;
    else if (r.outcome === 'partial') by[cat].partial += 1;
    else by[cat].incorrect += 1;
  }
  return Object.freeze({
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    byCategory: Object.freeze(by),
  });
}

// ─── Internal (tests only) ───────────────────────────────────────
export const _internal = Object.freeze({
  _tier, bandFor, toneFor, categoriseTask, missedByCategory,
  unresolvedIssueHistory, weatherIsStressful, biasCategory,
  farmTypeActionOverride, TASK_CATEGORY_KEYWORDS, WEATHER_STRESS_STATUSES,
  OUTCOME_KEY,
});
