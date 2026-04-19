/**
 * taskConfidence.js — simple rule-based confidence layer that sits
 * between the unified Today task and the final render.
 *
 *   scoreTaskConfidence(ctx) → { level, score, reasons[] }
 *   applyConfidenceWording(task, confidence, t?) → modified task
 *
 * The score is internal. It never shows up in the UI as "82%"; the
 * wording adapter translates it into direct / softer / cautious
 * copy via i18n keys (confidence.title.*, confidence.why.*) that
 * the page resolves through t().
 *
 * Rule surface:
 *   start at 50
 *   add/subtract points per signal
 *   ≥75 HIGH, ≥45 MEDIUM, <45 LOW
 *   cross-signal conflict drops 30
 *
 * Keep this boring on purpose — the whole point is to be
 * explainable in one screen.
 */

const MEDIUM_THRESHOLD = 45;
const HIGH_THRESHOLD   = 75;

const LAND_BLOCKER_TYPES = new Set([
  'uncleared_land', 'weeds_present', 'wet_soil', 'stones_present', 'unprepared_ridges',
]);

const CAMERA_CLEAR = new Set([
  'pest_detected', 'disease_detected', 'nutrient_deficiency_detected',
]);

const CAMERA_UNCERTAIN = new Set([
  'unknown_issue', 'low_light', 'blurry',
]);

/**
 * scoreTaskConfidence — coarse rule-based scorer. Each ctx field is
 * optional; missing data never throws, it just lowers confidence.
 *
 * @param {Object} ctx
 * @param {string} [ctx.cropStage]       e.g. 'planting' | 'growing' | 'off_season'
 * @param {Object} [ctx.landProfile]     { blocker, source: 'question'|'photo',
 *                                         moisture, weeds, cleared }
 * @param {Object} [ctx.weatherNow]      output of weather engine
 * @param {Object} [ctx.cameraTask]      { type: 'pest_detected' | 'unknown_issue' | … }
 * @param {string} [ctx.countryCode]
 * @param {Array}  [ctx.recentEvents]    recent-action summary (optional)
 * @param {string} [ctx.taskIntent]      'plant' | 'water' | 'drain' | 'clear' | 'scout' …
 */
export function scoreTaskConfidence(ctx = {}) {
  let score = 50;
  const reasons = [];

  // ─── A. LAND SIGNAL QUALITY ───────────────────────────
  const land = ctx.landProfile || null;
  if (land) {
    const blocker = String(land.blocker || '').toLowerCase();
    const source  = String(land.source || '').toLowerCase();
    if (LAND_BLOCKER_TYPES.has(blocker)) {
      // Question-driven is stronger than photo-only — farmers
      // consciously answered a question, which is the highest-trust
      // signal we have.
      if (source === 'question' || !source) {
        score += 25;
        reasons.push('land_blocker_explicit');
      } else if (source === 'photo') {
        score += 15;
        reasons.push('land_blocker_photo');
      }
    }
    if (land.weeds === true)       { score += 20; reasons.push('weeds_present'); }
    if (land.cleared === false)    { score += 10; reasons.push('uncleared_confirmed'); }
    // Wet soil is positive evidence for clearing / draining / field
    // prep. For planting it's the opposite — let the conflict rule
    // below handle it rather than double-crediting it here.
    if (land.moisture === 'wet') {
      const _intentCheck = String(ctx.taskIntent || '').toLowerCase();
      if (_intentCheck !== 'plant') {
        score += 20; reasons.push('wet_soil');
      }
    }
    if (land.moisture === 'unknown' || land.moisture === undefined) {
      score -= 10; reasons.push('land_moisture_missing');
    }
  } else {
    score -= 15;
    reasons.push('land_missing');
  }

  // ─── B. WEATHER SIGNAL QUALITY ────────────────────────
  const weather = ctx.weatherNow || null;
  if (weather) {
    const rainHigh = weather.rainRisk === 'high' || Number(weather.rainMmNext24h) >= 25;
    const heatHigh = weather.heatRisk === 'high' || Number(weather.tempHighC) >= 35;
    const intent = String(ctx.taskIntent || '').toLowerCase();

    if ((intent === 'plant' || intent === 'drain') && rainHigh) {
      score += 15; reasons.push('weather_supports_action');
    } else if (intent === 'water' && heatHigh) {
      score += 10; reasons.push('weather_supports_watering');
    } else if ((intent === 'plant' || intent === 'harvest') && weather.rainRisk === 'low' && weather.heatRisk !== 'high') {
      score += 5;  reasons.push('weather_neutral_favorable');
    }
  } else {
    score -= 10;
    reasons.push('weather_missing');
  }

  // ─── C. STAGE CONFIDENCE ─────────────────────────────
  const stage = String(ctx.cropStage || '').toLowerCase();
  if (stage && stage !== 'unknown' && stage !== 'off_season') {
    score += 10; reasons.push('stage_resolved');
  } else if (stage === 'off_season' || stage === 'approximate') {
    score -= 20; reasons.push('stage_off_season');
  } else {
    score -= 10; reasons.push('stage_missing');
  }

  // ─── D. CAMERA SIGNAL QUALITY ─────────────────────────
  const camType = String(ctx.cameraTask?.type || '').toLowerCase();
  if (camType) {
    if (CAMERA_CLEAR.has(camType))          { score += 10; reasons.push('camera_clear'); }
    else if (CAMERA_UNCERTAIN.has(camType)) { score -= 15; reasons.push('camera_uncertain'); }
  }

  // ─── E. CONFLICTS — strong penalty ───────────────────
  // e.g. land says wet but weather+stage say "plant now"
  const plantingIntent = (String(ctx.taskIntent || '').toLowerCase() === 'plant'
                          || stage === 'planting');
  const landWet = land?.moisture === 'wet';
  const landBlocker = LAND_BLOCKER_TYPES.has(String(land?.blocker || '').toLowerCase());
  const weatherNeg = weather && (weather.rainRisk === 'high' || weather.heatRisk === 'high');
  if (plantingIntent && (landWet || landBlocker) && !weatherNeg) {
    score -= 30; reasons.push('conflict_land_vs_stage');
  } else if (plantingIntent && landWet && weather?.rainRisk === 'high') {
    // Both negative — no conflict, just consistently risky.
    score -= 10; reasons.push('compound_wet_risk');
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= HIGH_THRESHOLD ? 'high'
              : score >= MEDIUM_THRESHOLD ? 'medium'
              : 'low';
  return { level, score, reasons };
}

// ─── Intent classification ───────────────────────────────
// Risky intents have real downside if done at the wrong time
// (wrong-planting = wasted seed, wrong-drain = erosion, etc.).
// Low-risk / observational intents don't need protective
// wording — a farmer observing pests at low confidence still
// just needs to go look; we don't want to make that awkward
// with "Check whether you should check your plants".
const RISKY_INTENTS = new Set([
  'plant', 'drain', 'prep', 'clear',
  'fertilize', 'spray', 'harvest',
]);

const LOW_RISK_INTENTS = new Set([
  'scout', 'inspect', 'observe', 'review', 'check_status',
  'water',   // water mistakes self-correct quickly — leave direct
]);

// Confidence reasons that justify forcing a check-first override
// when the intent is risky AND the level is low. We keep this
// tight and explicit — broadening it in the future means adding
// a reason here, not loosening the match regex.
const CHECK_FIRST_REASONS = new Set([
  'conflict_land_vs_stage',
  'conflict_weather_vs_land',
  'stale_offline_state',
  'weak_camera_signal',
  'camera_uncertain',
  'compound_wet_risk',
]);

/** True when the intent is in the risky set (exact match, not regex). */
export function isRiskyIntent(intent) {
  if (!intent) return false;
  return RISKY_INTENTS.has(String(intent).toLowerCase());
}

/** True when any reason justifies check-first. Tolerates null/undefined. */
export function hasConflictReason(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return false;
  for (const r of reasons) {
    if (r && CHECK_FIRST_REASONS.has(String(r))) return true;
  }
  return false;
}

/**
 * normalizeConfidence — coerce any shape into a predictable
 * `{ level, score, reasons }` with safe defaults. Never throws.
 * Returns null ONLY when the input is null/undefined — so
 * callers can distinguish "no confidence info at all" from
 * "confidence info, missing fields".
 */
export function normalizeConfidence(confidence) {
  if (confidence == null) return null;
  if (typeof confidence !== 'object') return null;
  const rawLevel = String(confidence.level || '').toLowerCase();
  const level = rawLevel === 'high' || rawLevel === 'medium' || rawLevel === 'low'
    ? rawLevel
    : 'medium';
  const score = Number.isFinite(confidence.score) ? Number(confidence.score) : null;
  const reasons = Array.isArray(confidence.reasons) ? confidence.reasons : [];
  return { level, score, reasons };
}

/**
 * shouldUseCheckFirst — predicate for swapping a task for its
 * "check first" variant. Production contract:
 *
 *   • always returns an explicit boolean (never undefined)
 *   • null/undefined confidence → false
 *   • level !== 'low' → false
 *   • risky intent (plant/drain/clear/etc.) + a real conflict /
 *     uncertainty reason → true
 *   • risky intent alone at low confidence → false
 *     (we don't force check-first just because the task is
 *     planting — we need a CONCRETE reason to suspect the
 *     action will go wrong)
 *   • low-risk intent (scout/inspect/water) → false regardless
 *
 * This avoids both the overconfident "imperative action at low
 * confidence" failure mode AND the over-cautious "wrap every
 * low-confidence task in a reminder" failure mode.
 */
export function shouldUseCheckFirst(task, confidence) {
  const c = normalizeConfidence(confidence);
  if (!c)                    return false;
  if (c.level !== 'low')     return false;

  const intent = String(task?.intent || task?.code || '').toLowerCase();
  if (!intent)               return false;
  if (LOW_RISK_INTENTS.has(intent)) return false;
  if (!isRiskyIntent(intent))      return false;
  return hasConflictReason(c.reasons);
}

/**
 * shouldUseSoftWhy — predicate for the wording adapter: should
 * the "why" line carry hedging language? True when confidence is
 * LOW or MEDIUM on a risky intent. Always boolean.
 */
export function shouldUseSoftWhy(task, confidence) {
  const c = normalizeConfidence(confidence);
  if (!c) return false;
  if (c.level === 'high') return false;
  const intent = String(task?.intent || task?.code || '').toLowerCase();
  if (LOW_RISK_INTENTS.has(intent)) return false;
  return true;
}

/**
 * shouldUseStateFirst — predicate for flipping the display mode
 * to state-first when the task is low-confidence AND risky. Low-
 * risk observational tasks keep their direct framing.
 */
export function shouldUseStateFirst(task, confidence) {
  const c = normalizeConfidence(confidence);
  if (!c) return false;
  if (c.level !== 'low') return false;
  const intent = String(task?.intent || task?.code || '').toLowerCase();
  if (LOW_RISK_INTENTS.has(intent)) return false;
  return isRiskyIntent(intent);
}

/**
 * applyConfidenceWording — adapt a task's title + detail based on
 * confidence. Returns a new task; never mutates input.
 *
 * If the task carries i18n keys (task.titleKey / task.detailKey)
 * we append the confidence tier: `...high` / `...medium` / `...low`
 * so translations can vary by tier. If the variant isn't present,
 * we fall back to the base key.
 *
 * If the task has plain strings (server-provided), we keep them but
 * prefix a gentle hedge for medium / low so the copy never leaks
 * overconfidence even when translations aren't yet filled.
 */
export function applyConfidenceWording(task, confidence, t = null) {
  if (!task) return task;
  const c = normalizeConfidence(confidence);
  if (!c) return task;

  const level = c.level;
  const out = {
    ...task,
    confidence: { level, score: c.score },
  };

  // Low-risk / observational tasks should NOT have their titles
  // softened into awkward double-hedges ("Check whether you
  // should check your plants"). Identify them up front.
  const intent = String(task.intent || task.code || '').toLowerCase();
  const isLowRisk = LOW_RISK_INTENTS.has(intent);

  // ─── key-driven variants ─────────────────────────────
  const titleKey  = task.titleKey;
  const detailKey = task.detailKey;
  if (titleKey) {
    // Low-risk tasks keep their direct i18n key — no tier suffix.
    const variantKey = isLowRisk ? titleKey : `${titleKey}.${level}`;
    out.titleKey = variantKey;
    if (t) {
      const translated = t(variantKey);
      out.title = translated && translated !== variantKey
        ? translated
        : (t(titleKey) || task.title);
    }
  }
  if (detailKey) {
    const variantKey = isLowRisk ? detailKey : `${detailKey}.${level}`;
    out.detailKey = variantKey;
    if (t) {
      const translated = t(variantKey);
      out.detail = translated && translated !== variantKey
        ? translated
        : (t(detailKey) || task.detail);
    }
  }

  // ─── string-driven hedging fallback ─────────────────
  // Low-risk tasks keep their original title/detail; risky
  // tasks get tier-appropriate hedging. HIGH always keeps the
  // original copy (short-circuit inside hedgeTitle/hedgeDetail).
  if (!titleKey && task.title) {
    out.title = isLowRisk ? task.title : hedgeTitle(task.title, level);
  }
  if (!detailKey && task.detail) {
    out.detail = isLowRisk ? task.detail : hedgeDetail(task.detail, level);
  }

  // ─── check-first override ────────────────────────────
  // Only fires when BOTH (a) level is low, (b) intent is risky,
  // and (c) a concrete conflict/uncertainty reason is present.
  // See shouldUseCheckFirst for the full contract.
  if (shouldUseCheckFirst(task, c)) {
    out.checkFirst = true;
    out.titleKey = 'confidence.checkFirst.title';
    if (t) {
      const check = t('confidence.checkFirst.title');
      if (check && check !== 'confidence.checkFirst.title') out.title = check;
    }
  }

  return out;
}

// ─── plain-string hedging (fallback path) ─────────────────
function hedgeTitle(title, level) {
  if (level === 'high') return title;
  const lower = String(title).toLowerCase();
  if (level === 'medium') {
    // "Clear your field this week" → "Your field may need more clearing"
    if (/^clear your field/i.test(title)) return 'Your field may need more clearing';
    if (/^prepare drainage/i.test(title)) return 'Your field may need drainage before rain';
    if (/^water your/i.test(title))       return `You may need to ${lower}`;
    if (/^plant /i.test(title))           return `It may be a good time to ${lower}`;
    // Generic softener — prepend "may" phrasing.
    return `You may want to ${lower}`;
  }
  // low
  if (/^clear/i.test(title))     return 'Check whether your field still needs clearing';
  if (/^prepare drainage/i.test(title)) return 'Check whether water may stay on your field after rain';
  if (/^plant /i.test(title))    return 'Check if the soil is ready before planting';
  if (/^water your/i.test(title)) return 'Check if your crop needs water today';
  return `Check your field before ${lower.replace(/^(water|plant|clear|prepare)/i, (m) => m.toLowerCase())}`;
}

function hedgeDetail(detail, level) {
  if (level === 'high') return detail;
  const prefix = level === 'medium' ? 'It may be that ' : 'It looks like ';
  return `${prefix}${String(detail).charAt(0).toLowerCase()}${String(detail).slice(1)}`;
}

export const _internal = {
  MEDIUM_THRESHOLD, HIGH_THRESHOLD, LAND_BLOCKER_TYPES,
  CAMERA_CLEAR, CAMERA_UNCERTAIN, hedgeTitle, hedgeDetail,
  RISKY_INTENTS, LOW_RISK_INTENTS, CHECK_FIRST_REASONS,
};
