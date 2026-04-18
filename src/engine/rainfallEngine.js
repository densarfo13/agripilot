/**
 * Rainfall Guidance Engine — converts 7-day forecast into farmer actions.
 *
 * Pure function: forecast data in, structured guidance out.
 * No React, no API calls, no side effects.
 *
 * Input: { days[], cropStage, crop, isNew }
 *   where days = [{ date, rainMm, rainProbability, tempMin, tempMax }]
 *
 * Output: { summary, alerts[], dailyRain[], totalRainMm, dryDays, wetDays }
 *   where each alert = { key: i18n key, severity, icon, params }
 *   and summary = { key: i18n key, type: 'dry'|'wet'|'mixed'|'unknown' }
 *
 * Rules (all deterministic, no AI):
 *   1. Week total > 50mm       → heavy rain week warning
 *   2. Tomorrow rain > 70%     → rain likely tomorrow
 *   3. Next 3 days all dry     → dry stretch, irrigate
 *   4. 5+ dry days             → drought risk
 *   5. Rain after dry stretch  → good planting window
 *   6. Tomorrow rain + crop in planting stage → delay planting
 *   7. Rain expected + irrigation planned → skip irrigation
 *   8. Good week + planting stage → good time to plant
 */

// ─── Thresholds ──────────────────────────────────────────────
const RAIN_LIKELY_PROB = 60;       // % — above this, rain is "likely"
const RAIN_CERTAIN_PROB = 80;      // % — above this, rain is "expected"
const RAIN_HEAVY_DAY_MM = 20;     // mm — heavy rain in one day
const RAIN_HEAVY_WEEK_MM = 50;    // mm — heavy rain total for the week
const DRY_DAY_THRESHOLD_MM = 1;   // mm — below this counts as a dry day
const DROUGHT_RISK_DAYS = 5;      // consecutive dry days = drought risk
const DRY_STRETCH_DAYS = 3;       // 3 dry days = time to irrigate

// ─── Stages where planting advice is relevant ───────────────
const PLANTING_STAGES = new Set(['planning', 'land_preparation', 'planting']);
const GROWTH_STAGES = new Set(['germination', 'vegetative', 'flowering', 'fruiting']);
const HARVEST_STAGES = new Set(['harvest', 'post_harvest']);

/**
 * Analyze 7-day forecast and produce farmer-friendly guidance.
 *
 * @param {Object} input
 * @param {Array}  input.days        — forecast days from weatherForecastService
 * @param {string} [input.cropStage] — current crop lifecycle stage
 * @param {string} [input.crop]      — crop type
 * @param {boolean} [input.isNew]    — new farmer flag
 * @returns {Object} Rainfall guidance
 */
export function analyzeRainfall({ days = [], cropStage = '', crop = '', isNew = false } = {}) {
  if (!days || days.length === 0) {
    return {
      summary: { key: 'rainfall.noData', type: 'unknown' },
      alerts: [],
      dailyRain: [],
      totalRainMm: 0,
      dryDays: 0,
      wetDays: 0,
    };
  }

  // ─── Classify each day ───────────────────────────────
  const dailyRain = days.map((d, i) => {
    const isWet = d.rainMm >= DRY_DAY_THRESHOLD_MM || d.rainProbability >= RAIN_LIKELY_PROB;
    const isHeavy = d.rainMm >= RAIN_HEAVY_DAY_MM;
    return {
      date: d.date,
      rainMm: d.rainMm,
      rainProbability: d.rainProbability,
      tempMin: d.tempMin,
      tempMax: d.tempMax,
      isWet,
      isHeavy,
      dayIndex: i, // 0 = today, 1 = tomorrow, etc.
    };
  });

  const totalRainMm = dailyRain.reduce((sum, d) => sum + d.rainMm, 0);
  const wetDays = dailyRain.filter(d => d.isWet).length;
  const dryDays = dailyRain.length - wetDays;

  // Tomorrow's forecast (index 1)
  const tomorrow = dailyRain[1] || null;
  // Next 3 days (indices 1-3)
  const next3 = dailyRain.slice(1, 4);
  // Leading dry streak (from tomorrow)
  const leadingDryStreak = countLeadingDry(dailyRain.slice(1));

  const alerts = [];

  // ─── Rule 1: Heavy rain week ─────────────────────────
  if (totalRainMm >= RAIN_HEAVY_WEEK_MM) {
    alerts.push({
      key: 'rainfall.heavyWeek',
      severity: 'warning',
      icon: '\u{1F327}\u{FE0F}',
      params: { totalMm: Math.round(totalRainMm) },
    });
  }

  // ─── Rule 2: Rain likely tomorrow ────────────────────
  if (tomorrow) {
    if (tomorrow.rainProbability >= RAIN_CERTAIN_PROB) {
      alerts.push({
        key: 'rainfall.rainTomorrow',
        severity: 'caution',
        icon: '\u{1F327}\u{FE0F}',
        params: { chance: tomorrow.rainProbability, mm: Math.round(tomorrow.rainMm) },
      });
    } else if (tomorrow.rainProbability >= RAIN_LIKELY_PROB) {
      alerts.push({
        key: 'rainfall.rainLikelyTomorrow',
        severity: 'info',
        icon: '\u{1F326}\u{FE0F}',
        params: { chance: tomorrow.rainProbability },
      });
    }
  }

  // ─── Rule 3: Next 3 days all dry → irrigate ──────────
  const next3AllDry = next3.length >= 3 && next3.every(d => !d.isWet);
  if (next3AllDry) {
    alerts.push({
      key: 'rainfall.dryStretch',
      severity: 'caution',
      icon: '\u2600\u{FE0F}',
      params: {},
    });
  }

  // ─── Rule 4: 5+ dry days → drought risk ──────────────
  if (leadingDryStreak >= DROUGHT_RISK_DAYS) {
    alerts.push({
      key: 'rainfall.droughtRisk',
      severity: 'warning',
      icon: '\u{1F3DC}\u{FE0F}',
      params: { days: leadingDryStreak },
    });
  }

  // ─── Rule 5: Rain after dry stretch → planting window ─
  if (leadingDryStreak >= DRY_STRETCH_DAYS && PLANTING_STAGES.has(cropStage)) {
    // Find first wet day after dry streak
    const firstWetAfterDry = dailyRain.slice(1 + leadingDryStreak).find(d => d.isWet);
    if (firstWetAfterDry) {
      alerts.push({
        key: 'rainfall.plantingWindow',
        severity: 'success',
        icon: '\u{1F331}',
        params: { day: firstWetAfterDry.dayIndex },
      });
    }
  }

  // ─── Rule 6: Tomorrow rain + planting stage → delay ───
  if (tomorrow && tomorrow.isWet && tomorrow.isHeavy && PLANTING_STAGES.has(cropStage)) {
    alerts.push({
      key: 'rainfall.delayPlanting',
      severity: 'caution',
      icon: '\u23F3',
      params: {},
    });
  }

  // ─── Rule 7: Rain expected → skip irrigation ─────────
  if (tomorrow && tomorrow.rainProbability >= RAIN_LIKELY_PROB && GROWTH_STAGES.has(cropStage)) {
    alerts.push({
      key: 'rainfall.skipIrrigation',
      severity: 'info',
      icon: '\u{1F4A7}',
      params: {},
    });
  }

  // ─── Rule 8: Good planting conditions ─────────────────
  // Mild week + planting stage + some rain but not too much
  if (PLANTING_STAGES.has(cropStage) && wetDays >= 2 && wetDays <= 4 && totalRainMm < RAIN_HEAVY_WEEK_MM) {
    // Only if we didn't already flag delay
    const hasDelay = alerts.some(a => a.key === 'rainfall.delayPlanting');
    if (!hasDelay) {
      alerts.push({
        key: 'rainfall.goodToPlant',
        severity: 'success',
        icon: '\u{1F33E}',
        params: {},
      });
    }
  }

  // ─── Rule: Harvest risk from rain ─────────────────────
  if (HARVEST_STAGES.has(cropStage) && wetDays >= 4) {
    alerts.push({
      key: 'rainfall.harvestRainRisk',
      severity: 'caution',
      icon: '\u{1F33D}',
      params: {},
    });
  }

  // ─── Summary ─────────────────────────────────────────
  let summary;
  if (dryDays >= 6) {
    summary = { key: 'rainfall.summaryDry', type: 'dry' };
  } else if (wetDays >= 5) {
    summary = { key: 'rainfall.summaryWet', type: 'wet' };
  } else {
    summary = { key: 'rainfall.summaryMixed', type: 'mixed' };
  }

  return { summary, alerts, dailyRain, totalRainMm, dryDays, wetDays };
}

/**
 * Count consecutive dry days from the start of an array.
 */
function countLeadingDry(days) {
  let count = 0;
  for (const d of days) {
    if (d.isWet) break;
    count++;
  }
  return count;
}

/**
 * Get the single most important alert for a compact display.
 * Returns the highest-severity alert, or null.
 */
export function getTopAlert(alerts) {
  if (!alerts || alerts.length === 0) return null;
  const severityOrder = { warning: 0, caution: 1, info: 2, success: 3 };
  return [...alerts].sort((a, b) =>
    (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  )[0];
}
