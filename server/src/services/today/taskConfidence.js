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

/** Should a low-confidence task become a "check first" safer version? */
export function shouldUseCheckFirst(task, confidence) {
  if (!confidence) return false;
  if (confidence.level !== 'low') return false;
  const intent = String(task?.intent || task?.code || '').toLowerCase();
  // Low-confidence planting / drainage / field prep → check-first.
  return /plant|drain|prep|clear/.test(intent)
    || confidence.reasons?.includes('conflict_land_vs_stage');
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
  if (!task || !confidence) return task;
  const level = confidence.level || 'medium';
  const out = {
    ...task,
    confidence: { level, score: confidence.score },
  };

  // ─── key-driven variants ─────────────────────────────
  const titleKey  = task.titleKey;
  const detailKey = task.detailKey;
  if (titleKey) {
    const variantKey = `${titleKey}.${level}`;
    out.titleKey = variantKey;
    if (t) {
      const translated = t(variantKey);
      out.title = translated && translated !== variantKey ? translated : (t(titleKey) || task.title);
    }
  }
  if (detailKey) {
    const variantKey = `${detailKey}.${level}`;
    out.detailKey = variantKey;
    if (t) {
      const translated = t(variantKey);
      out.detail = translated && translated !== variantKey ? translated : (t(detailKey) || task.detail);
    }
  }

  // ─── string-driven hedging fallback ─────────────────
  if (!titleKey && task.title) {
    out.title = hedgeTitle(task.title, level);
  }
  if (!detailKey && task.detail) {
    out.detail = hedgeDetail(task.detail, level);
  }

  // ─── check-first override for low-confidence risky intents ─
  if (shouldUseCheckFirst(task, confidence)) {
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
};
