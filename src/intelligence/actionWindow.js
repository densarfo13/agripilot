/**
 * actionWindow.js — predictive 3-day action timing.
 *
 *   getBestActionWindow({ farm, forecast, task })
 *     → {
 *         recommendation,    // short headline ("Best time to act is tomorrow")
 *         bestDay,           // Date | null  — first dry workable day (today or future)
 *         reason,            // why right now isn't ideal (or why it is)
 *         riskIfDelayed,     // what happens if the farmer waits past bestDay
 *         confidence,        // 'high' | 'medium' | 'low'
 *         blockedToday,      // boolean — true when today is unsafe to act
 *         buttonText,        // CTA wording: Wait | Check again later |
 *                            //   View safe task | Plan task | Act now |
 *                            //   Start early
 *       }
 *
 * Pure function. Reads a 3-day forecast (from
 * src/services/weatherService.extractForecastDays) plus the base
 * task (output of /intelligence/taskEngine.generateTodayTask) and
 * the farm record. Never throws, never returns null.
 *
 * Rule priority (first match wins; spec §2 + §3):
 *
 *   1. forecast missing/empty       → safe fallback (spec §6)
 *   2. today is storm                → delay, "Wait"
 *   3. today is heavy rain           → blocked, suggest next dry day
 *   4. today is light rain + task    → "Do light checks only"
 *      is not planting/land_prep
 *   5. today is hot (>32°C)          → "Work early morning"
 *   6. today is dry + planting/      → "Good conditions today"
 *      land_prep                       (also generic-actable today)
 *   7. otherwise (rain today,        → "Best time to act is [day]"
 *      dry within 3 days)              with bestDay set
 *   8. fallback                      → "Check your farm today"
 *
 * Confidence (analytics + tests):
 *   - high   — at least 2 forecast rows, today is dry, dry trend continues
 *   - medium — 2+ forecast rows but mixed conditions
 *   - low    — only 1 forecast row available, OR fallback path
 */

const HEAVY_RAIN_MM_24H  = 15;   // ≥ this in 24h → blocked
const LIGHT_RAIN_MM_24H  = 2;    // 2..15 → light-checks only
const HEAT_THRESHOLD_C   = 32;   // > this → start early

// Stages where the spec calls out specific timing wording.
const PLANTING_STAGES = new Set([
  'planting', 'plant', 'sowing', 'transplant', 'transplanting',
]);
const LAND_PREP_STAGES = new Set([
  'land_prep', 'land_preparation', 'prep', 'soil_prep',
]);
const PEST_TASK_TYPES = new Set([
  'inspect', 'scout', 'pest_check', 'pest', 'monitor',
]);

function _stageId(s) {
  return s ? String(s).toLowerCase().trim().replace(/\s+/g, '_') : '';
}

function _toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return Number.isFinite(d.getTime()) ? d : null;
  const x = new Date(d);
  return Number.isFinite(x.getTime()) ? x : null;
}

function _isToday(d) {
  const t = _toDate(d);
  if (!t) return false;
  const now = new Date();
  return t.getFullYear() === now.getFullYear()
      && t.getMonth()    === now.getMonth()
      && t.getDate()     === now.getDate();
}

function _dayLabel(d) {
  const t = _toDate(d);
  if (!t) return '';
  if (_isToday(t)) return 'today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (t.getDate() === tomorrow.getDate()
   && t.getMonth() === tomorrow.getMonth()
   && t.getFullYear() === tomorrow.getFullYear()) return 'tomorrow';
  // Otherwise weekday name, lowercased ("wednesday", "thursday")
  const weekday = t.toLocaleDateString('en-US', { weekday: 'long' });
  return weekday ? weekday.toLowerCase() : '';
}

function _isWorkable(day) {
  // A "workable" day is dry/calm enough to act on a normal task.
  // Hot still counts as workable (the engine recommends starting
  // early, but it doesn't block). Storm/rain do block.
  if (!day) return false;
  if (day.condition === 'storm') return false;
  if (day.condition === 'rain')  return false;
  if ((day.precipitation || 0) >= LIGHT_RAIN_MM_24H) return false;
  return true;
}

function _firstDry(forecast, { skipToday = true } = {}) {
  if (!Array.isArray(forecast)) return null;
  for (let i = 0; i < forecast.length; i += 1) {
    const day = forecast[i];
    if (!day) continue;
    if (skipToday && i === 0) continue;
    if (_isWorkable(day)) return day;
  }
  return null;
}

/**
 * Safe-fallback window — used when forecast is missing OR when
 * the rule chain falls through. Spec §6: never blank, never crash.
 */
function _safeFallback(reason = 'Forecast unavailable') {
  return Object.freeze({
    recommendation: 'Check your farm today',
    bestDay:        null,
    reason,
    riskIfDelayed:  '',
    confidence:     'low',
    blockedToday:   false,
    buttonText:     'Act now',
  });
}

/**
 * getBestActionWindow — main entry point.
 */
export function getBestActionWindow({ farm, forecast, task } = {}) {
  // ── 0. Forecast missing → safe fallback ─────────────────────
  const days = Array.isArray(forecast)
    ? forecast.filter(Boolean)
    : [];
  if (days.length === 0) {
    return _safeFallback('Forecast unavailable');
  }

  // Resolve stage / task type once.
  const stage   = _stageId(farm && (farm.cropStage || farm.stage));
  const taskAct = task && (task.actionType || task.type) || '';
  const taskActId = String(taskAct).toLowerCase();
  const isPlanting   = PLANTING_STAGES.has(stage)
                    || taskActId === 'plant' || taskActId === 'planting';
  const isLandPrep   = LAND_PREP_STAGES.has(stage);
  const isPestCheck  = PEST_TASK_TYPES.has(taskActId);

  const today = days[0];
  const restWorkable = _firstDry(days, { skipToday: true });
  const confidence = days.length >= 2
    ? (today && today.condition === 'dry' && _isWorkable(restWorkable || today)
        ? 'high' : 'medium')
    : 'low';

  // ── 1. Today is storm → delay everything ────────────────────
  if (today && today.condition === 'storm') {
    // Pest checks are still allowed unless storm — the spec
    // explicitly carves this out, and the storm branch IS the
    // "unless storm" case. So pest tasks land here too.
    return Object.freeze({
      recommendation: 'Delay field work — storm risk',
      bestDay:        restWorkable ? restWorkable.date : null,
      reason:         'Storm risk today',
      riskIfDelayed:  '',
      confidence,
      blockedToday:   true,
      buttonText:     'Wait',
    });
  }

  // ── 2. Heavy rain today → blocked, suggest next dry day ─────
  const todayPrecip = today ? Number(today.precipitation) || 0 : 0;
  if (today && (today.condition === 'rain' && todayPrecip >= HEAVY_RAIN_MM_24H)) {
    if (restWorkable) {
      const lbl = _dayLabel(restWorkable.date) || 'soon';
      return Object.freeze({
        recommendation: `Best time to act is ${lbl}`,
        bestDay:        restWorkable.date,
        reason:         'Heavy rain today — soil is too wet',
        riskIfDelayed:  isPlanting
          ? 'Planting too late in the wet window can cause poor germination'
          : '',
        confidence,
        blockedToday:   true,
        buttonText:     'Plan task',
      });
    }
    return Object.freeze({
      recommendation: 'Wait until soil is less wet',
      bestDay:        null,
      reason:         'Heavy rain today',
      riskIfDelayed:  '',
      confidence,
      blockedToday:   true,
      buttonText:     'Check again later',
    });
  }

  // ── 3. Light rain today + task is NOT planting/prep ─────────
  if (today
      && today.condition === 'rain'
      && todayPrecip >= LIGHT_RAIN_MM_24H
      && todayPrecip <  HEAVY_RAIN_MM_24H
      && !isPlanting
      && !isLandPrep) {
    // Pest checks: spec says "always allowed unless storm" — so
    // light rain just nudges the framing, doesn't block.
    if (isPestCheck) {
      return Object.freeze({
        recommendation: 'Inspect when safe',
        bestDay:        today.date,
        reason:         'Light rain today',
        riskIfDelayed:  '',
        confidence,
        blockedToday:   false,
        buttonText:     'View safe task',
      });
    }
    return Object.freeze({
      recommendation: 'Do light checks only',
      bestDay:        today.date,
      reason:         'Light rain today',
      riskIfDelayed:  '',
      confidence,
      blockedToday:   false,
      buttonText:     'View safe task',
    });
  }

  // ── 4. Light rain today AND task IS planting/prep → defer ──
  if (today
      && today.condition === 'rain'
      && todayPrecip >= LIGHT_RAIN_MM_24H
      && (isPlanting || isLandPrep)) {
    if (restWorkable) {
      const lbl = _dayLabel(restWorkable.date) || 'soon';
      return Object.freeze({
        recommendation: `Best time to act is ${lbl}`,
        bestDay:        restWorkable.date,
        reason:         'Rain today — soil may be too wet',
        riskIfDelayed:  isPlanting
          ? 'Delaying planting too far can shorten the growing window'
          : '',
        confidence,
        blockedToday:   true,
        buttonText:     'Plan task',
      });
    }
    // No dry window in the next 3 days — calm, honest fallback.
    return Object.freeze({
      recommendation: 'Wait until soil is less wet',
      bestDay:        null,
      reason:         'Rain today, no dry window in the next 3 days',
      riskIfDelayed:  '',
      confidence,
      blockedToday:   true,
      buttonText:     'Check again later',
    });
  }

  // ── 5. Heat risk today → work early morning ─────────────────
  const todayTemp = today && Number.isFinite(Number(today.temperature))
    ? Number(today.temperature) : null;
  if (todayTemp != null && todayTemp > HEAT_THRESHOLD_C) {
    return Object.freeze({
      recommendation: 'Work early morning',
      bestDay:        today.date,
      reason:         'High heat risk',
      riskIfDelayed:  'Midday heat can stress crops + the farmer',
      confidence,
      blockedToday:   false,
      buttonText:     'Start early',
    });
  }

  // ── 6. Dry today → green light ──────────────────────────────
  if (today && _isWorkable(today)) {
    return Object.freeze({
      recommendation: 'Good conditions today',
      bestDay:        today.date,
      reason:         '',
      riskIfDelayed:  '',
      confidence,
      blockedToday:   false,
      buttonText:     'Act now',
    });
  }

  // ── 7. Catch-all: rain trend with no clear dry break ────────
  if (restWorkable) {
    const lbl = _dayLabel(restWorkable.date) || 'soon';
    return Object.freeze({
      recommendation: `Best time to act is ${lbl}`,
      bestDay:        restWorkable.date,
      reason:         'Wet conditions today',
      riskIfDelayed:  '',
      confidence,
      blockedToday:   false,
      buttonText:     'Plan task',
    });
  }

  // ── 8. Fallback — never blank ───────────────────────────────
  return _safeFallback('Conditions unclear');
}

/**
 * formatActionWindowLine(window) → string
 *
 * Two-line "Weather intelligence" copy for the Home card. First
 * line is the reason (today's conditions in one short clause);
 * second line is the recommendation. Returns null when there's
 * nothing to say (calm + dry), letting the card hide the line
 * entirely (spec §5: keep it simple).
 */
export function formatActionWindowLine(window) {
  if (!window) return null;
  // Calm + dry day with no advice to add → nothing to render.
  if (!window.reason && window.recommendation === 'Good conditions today') {
    return window.recommendation;
  }
  if (window.reason && window.recommendation) {
    return `${window.reason}. ${window.recommendation}.`;
  }
  return window.recommendation || window.reason || null;
}

export const _internal = Object.freeze({
  HEAVY_RAIN_MM_24H,
  LIGHT_RAIN_MM_24H,
  HEAT_THRESHOLD_C,
  PLANTING_STAGES,
  LAND_PREP_STAGES,
  PEST_TASK_TYPES,
  _isWorkable,
  _firstDry,
  _dayLabel,
});
