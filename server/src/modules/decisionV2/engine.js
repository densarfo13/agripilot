/**
 * decisionV2/engine.js — priority-ladder decision engine that
 * wraps AI Task Engine v1 and adds soil/satellite/region/scan
 * signals + confidence + sourceSignals + persistence-ready
 * shape.
 *
 *   const decision = decideToday(context);
 *
 * @param  {object} context — output of buildDecisionContext()
 * @return {object} envelope:
 *   {
 *     primaryAction:   string,     // short title
 *     primaryCta:      string,     // verb-matched CTA
 *     reason:          string,     // one-line context
 *     priority:        number,     // 1-8 (lower = higher priority)
 *     confidence:      'low'|'medium'|'high',
 *     sourceSignals:   string[],   // ['rain', 'soil_dry', ...]
 *     tomorrowHook:    string,
 *     ruleId:          string,     // diagnostic
 *     userType:        'farmer'|'backyard',
 *     fallback:        boolean,
 *     // Plus everything the v1 engine emits (ctaLabel,
 *     // estimatedTime, safetyNote, localizedText, etc.)
 *   }
 *
 * Priority ladder (spec §5 — only ONE primary action returned)
 *   1. Scan issue              (recent scan = needs_attention)
 *   2. Severe weather          (heavy rain / heat / cold)
 *   3. Soil risk               (low moisture + hot weather, etc.)
 *   4. Region pest/disease     (high regional risk)
 *   5. Satellite stress        (high vegetation stress)
 *   6. Growth stage default    (per-stage v1 template)
 *   7. Last-action de-dupe     (skip if just done)
 *   8. General daily check     (fallback)
 *
 * Strict-rule audit
 *   • Pure function — no I/O.
 *   • Never throws; bad input falls through to step 8.
 *   • Reuses v1 engine for steps 2/6/8 — no duplicate rule logic.
 *   • SourceSignals + confidence are PURE diagnostics; user-
 *     facing strings come from the v1 engine + locale templates.
 */

import { generateTodayTask } from '../aiTask/engine.js';

const PRIORITY = Object.freeze({
  SCAN_ISSUE:      1,
  SEVERE_WEATHER:  2,
  SOIL_RISK:       3,
  REGION_RISK:     4,
  SATELLITE_RISK:  5,
  STAGE_DEFAULT:   6,
  LAST_ACTION:     7,
  GENERAL:         8,
});

// Window during which a watering/irrigation completion suppresses
// new water-prompts. Spec §6: "If user watered within 12 hours →
// skip watering now."
const WATER_DEDUPE_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * decideToday(context) → decision envelope.
 */
export function decideToday(context) {
  const ctx = _normalize(context);
  const sourceSignals = [];

  // Build the input the v1 engine consumes.
  const v1Input = {
    userType:          ctx.userType,
    crop:              ctx.cropOrPlant,
    stage:             ctx.growthStage,
    country:           ctx.locationCountry,
    region:            ctx.locationRegion,
    coordinates:       (ctx.lat != null && ctx.lng != null)
      ? { lat: ctx.lat, lng: ctx.lng } : undefined,
    weather:           ctx.weather && ctx.weather.summary,
    rainfallForecast:  ctx.weather && ctx.weather.rainfallMm,
    temperature:       ctx.weather && ctx.weather.temperature,
    language:          ctx.language || 'en',
  };

  // ─── Priority 1: scan issue ────────────────────────────
  // A recent scan flagged an issue → override every other rule.
  if (ctx.scan && ctx.scan.lastStatus === 'needs_attention') {
    sourceSignals.push('recent_scan');
    if (ctx.scan.lastIssueType) {
      sourceSignals.push(`scan_${ctx.scan.lastIssueType}`);
    }
    return _buildEnvelope({
      ctx,
      v1Input,
      ruleOverride: 'scan_followup',
      priority: PRIORITY.SCAN_ISSUE,
      sourceSignals,
      confidence: 'high',  // we have a real signal
      // The v1 engine doesn't have a `scan_followup` template, so
      // we synthesise the wording here. Short, action-first.
      titleOverride: ctx.userType === 'backyard'
        ? 'Check affected leaves'
        : 'Inspect crop area from scan',
      reasonOverride: 'Recent scan found a possible issue.',
      ctaOverride: 'Inspect now \u2713',
    });
  }

  // ─── Priority 2: severe weather ────────────────────────
  // Delegate to v1 engine — it already covers heavy rain /
  // heat stress / cold stress / dry irrigation.
  const v1ResultProbe = generateTodayTask(v1Input);
  if (_isSevereWeatherRule(v1ResultProbe.ruleId)) {
    // Last-action dedupe runs BEFORE the severe-weather return
    // when the rule is water-related and the user just watered.
    // Spec §6: "If user watered within 12 hours → skip watering."
    const wantsWaterNow = (
      v1ResultProbe.ruleId === 'dry_irrigation'
      || v1ResultProbe.ruleId === 'heat_stress_warning'
    );
    if (wantsWaterNow
        && ctx.lastActions
        && ctx.lastActions.lastWateredAt) {
      const ago = Date.now() - new Date(ctx.lastActions.lastWateredAt).getTime();
      if (ago >= 0 && ago < WATER_DEDUPE_WINDOW_MS) {
        sourceSignals.push('recently_watered');
        return _buildEnvelope({
          ctx,
          v1Input,
          ruleOverride: 'recently_watered',
          priority: PRIORITY.LAST_ACTION,
          sourceSignals,
          confidence: 'high',
          titleOverride: 'Skip watering now',
          reasonOverride: 'You watered recently.',
          ctaOverride: 'Done \u2713',
        });
      }
    }
    sourceSignals.push(_weatherSignalFor(v1ResultProbe.ruleId));
    return _buildEnvelope({
      ctx,
      v1Input,
      ruleOverride: v1ResultProbe.ruleId,
      v1Result: v1ResultProbe,
      priority: PRIORITY.SEVERE_WEATHER,
      sourceSignals,
      // High confidence when weather provided real numbers,
      // medium when only a `summary` string drove the rule.
      confidence: (Number.isFinite(v1Input.rainfallForecast)
                  || Number.isFinite(v1Input.temperature))
        ? 'high' : 'medium',
    });
  }

  // ─── Priority 3: soil risk ─────────────────────────────
  // "low moisture + hot weather" → check soil early.
  // "low moisture + sunny" → water deeply.
  if (ctx.soil && ctx.soil.moistureLevel === 'low') {
    sourceSignals.push('soil_dry');
    const isHot = ctx.weather && (
      ctx.weather.summary === 'hot'
      || (Number.isFinite(ctx.weather.temperature) && ctx.weather.temperature >= 30)
    );
    if (isHot) sourceSignals.push('weather_hot');
    return _buildEnvelope({
      ctx,
      v1Input,
      ruleOverride: 'soil_dry',
      priority: PRIORITY.SOIL_RISK,
      sourceSignals,
      confidence: ctx.soil.source === 'manual' ? 'medium' : 'high',
      titleOverride: ctx.userType === 'backyard'
        ? 'Check soil early'
        : 'Inspect soil moisture',
      reasonOverride: isHot
        ? 'Soil is dry and the day is hot.'
        : 'Soil is dry — water deeply if needed.',
      ctaOverride: 'Check now \u2713',
    });
  }

  // ─── Priority 4: region risk ───────────────────────────
  if (ctx.region) {
    if (ctx.region.pestRisk === 'high') {
      sourceSignals.push('region_pest_risk');
      return _buildEnvelope({
        ctx,
        v1Input,
        ruleOverride: 'region_pest_risk',
        priority: PRIORITY.REGION_RISK,
        sourceSignals,
        confidence: 'medium',
        titleOverride: ctx.userType === 'backyard'
          ? 'Inspect leaves today'
          : 'Scout for pests today',
        reasonOverride: 'Pest risk is elevated in your area.',
        ctaOverride: 'Inspect now \u2713',
      });
    }
    if (ctx.region.diseaseRisk === 'high') {
      sourceSignals.push('region_disease_risk');
      return _buildEnvelope({
        ctx,
        v1Input,
        ruleOverride: 'region_disease_risk',
        priority: PRIORITY.REGION_RISK,
        sourceSignals,
        confidence: 'medium',
        titleOverride: ctx.userType === 'backyard'
          ? 'Look at leaves for spots'
          : 'Scout for disease symptoms',
        reasonOverride: 'Disease risk is elevated in your area.',
        ctaOverride: 'Inspect now \u2713',
      });
    }
  }

  // ─── Priority 5: satellite stress ──────────────────────
  if (ctx.satellite && ctx.satellite.stressLevel === 'high') {
    sourceSignals.push('satellite_stress');
    return _buildEnvelope({
      ctx,
      v1Input,
      ruleOverride: 'satellite_stress',
      priority: PRIORITY.SATELLITE_RISK,
      sourceSignals,
      confidence: 'medium',
      titleOverride: ctx.userType === 'backyard'
        ? 'Check stressed area'
        : 'Inspect stressed area',
      // User-facing wording per spec §8: "Some crop stress may
      // be present" — NOT "NDVI anomaly detected".
      reasonOverride: ctx.userType === 'backyard'
        ? 'Some plant stress may be present.'
        : 'Some crop stress may be present.',
      ctaOverride: 'Inspect now \u2713',
    });
  }

  // ─── Priority 7: last-action dedupe ────────────────────
  // Before we fall through to the v1 stage default, check
  // whether the v1 result is a water-related rule AND the user
  // already watered within the last 12h. If so, suppress.
  const wantsToSuggestWater = (
    v1ResultProbe.ruleId === 'dry_irrigation'
    || v1ResultProbe.ruleId === 'heat_stress_warning'
  );
  if (wantsToSuggestWater
      && ctx.lastActions
      && ctx.lastActions.lastWateredAt) {
    const ago = Date.now() - new Date(ctx.lastActions.lastWateredAt).getTime();
    if (ago < WATER_DEDUPE_WINDOW_MS) {
      sourceSignals.push('recently_watered');
      return _buildEnvelope({
        ctx,
        v1Input,
        ruleOverride: 'recently_watered',
        priority: PRIORITY.LAST_ACTION,
        sourceSignals,
        confidence: 'high',
        titleOverride: 'Skip watering now',
        reasonOverride: 'You watered recently.',
        ctaOverride: 'Done \u2713',
      });
    }
  }

  // ─── Priority 6: stage default (v1 result as-is) ───────
  // Falls through to the v1 envelope when no higher-priority
  // signal fired. Add a sourceSignal so the operator can see
  // which stage drove it.
  if (v1ResultProbe.ruleId.startsWith('stage_')) {
    sourceSignals.push(v1ResultProbe.ruleId);
    return _buildEnvelope({
      ctx,
      v1Input,
      ruleOverride: v1ResultProbe.ruleId,
      v1Result: v1ResultProbe,
      priority: PRIORITY.STAGE_DEFAULT,
      sourceSignals,
      confidence: 'medium',
    });
  }

  // ─── Priority 8: general fallback ──────────────────────
  // profile_missing / fallback_check — low confidence.
  sourceSignals.push('general_check');
  return _buildEnvelope({
    ctx,
    v1Input,
    v1Result: v1ResultProbe,
    ruleOverride: v1ResultProbe.ruleId,
    priority: PRIORITY.GENERAL,
    sourceSignals,
    confidence: 'low',
  });
}

// ─── Helpers ─────────────────────────────────────────────

function _normalize(c) {
  const r = c && typeof c === 'object' ? c : {};
  return {
    userType:        r.userType === 'backyard' ? 'backyard' : 'farmer',
    cropOrPlant:     r.cropOrPlant || null,
    growthStage:     r.growthStage || null,
    locationCountry: r.locationCountry || null,
    locationRegion:  r.locationRegion || null,
    lat:             Number.isFinite(r.lat) ? r.lat : null,
    lng:             Number.isFinite(r.lng) ? r.lng : null,
    weather:         r.weather || null,
    soil:            r.soil || null,
    satellite:       r.satellite || null,
    region:          r.region || null,
    scan:            r.scan || null,
    lastActions:     r.lastActions || null,
    language:        r.language || 'en',
    farmId:          r.farmId || null,
  };
}

function _isSevereWeatherRule(ruleId) {
  return ruleId === 'heavy_rain_warning'
      || ruleId === 'heat_stress_warning'
      || ruleId === 'cold_stress_warning'
      || ruleId === 'dry_irrigation';
}

function _weatherSignalFor(ruleId) {
  switch (ruleId) {
    case 'heavy_rain_warning':  return 'rain';
    case 'heat_stress_warning': return 'heat';
    case 'cold_stress_warning': return 'cold';
    case 'dry_irrigation':      return 'soil_dry';
    default:                    return 'weather';
  }
}

/**
 * _buildEnvelope({...}) → final decision envelope.
 *
 * When `v1Result` is supplied, fields that aren't overridden
 * inherit from it (so v1's localised wording / CTA / safety
 * note carry through). When the v1Result isn't supplied,
 * we run v1 ourselves to get the fallback strings.
 */
function _buildEnvelope({
  ctx, v1Input, v1Result, ruleOverride, priority, sourceSignals,
  confidence, titleOverride, reasonOverride, ctaOverride,
}) {
  const base = v1Result || generateTodayTask(v1Input);
  return {
    primaryAction: titleOverride || base.todayTaskTitle,
    primaryCta:    ctaOverride   || base.ctaLabel || 'Check now \u2713',
    reason:        reasonOverride || base.taskReason,
    priority,
    confidence,
    sourceSignals: Array.isArray(sourceSignals) ? sourceSignals : [],
    tomorrowHook:  base.nextRecommendedTask || 'Check again tomorrow morning',
    // Keep diagnostics + the full v1 envelope so the frontend
    // can render the existing TodayTaskCard without a rewrite.
    ruleId:        ruleOverride || base.ruleId,
    userType:      ctx.userType,
    fallback:      base.fallback === true || priority === PRIORITY.GENERAL,
    // Pass-through fields the existing card already reads.
    estimatedTime:   base.estimatedTime,
    safetyNote:      base.safetyNote,
    completionPrompt: base.completionPrompt,
    nextRecommendedTask: base.nextRecommendedTask,
    localizedText:   base.localizedText,
    ctaLabel:        ctaOverride || base.ctaLabel,
    language:        base.language,
    generatedAt:     new Date().toISOString(),
  };
}

export const _internal = Object.freeze({
  PRIORITY,
  WATER_DEDUPE_WINDOW_MS,
  _normalize,
  _isSevereWeatherRule,
  _weatherSignalFor,
});

export default decideToday;
