/**
 * taskEngine.js — weather-aware task adaptation.
 *
 *   adaptTaskForWeather({ crop, stage, weather, baseTask })
 *     → { title, reason, action, blocked, source, baseTitle? }
 *
 * Pure function. Takes a base task (typically the output of the
 * production /intelligence/taskEngine.js generateTodayTask()) and
 * either overrides it with weather-driven guidance OR returns it
 * unchanged when no rule applies.
 *
 * Rule priority (first match wins):
 *
 *   1. weather.condition === 'storm'
 *        → "Delay field work" — storm risk today.
 *   2. weather.condition === 'rain'  AND stage matches a wet-soil
 *      sensitive stage (land_prep, planting, …)
 *        → "Pause <activity>" — soil too wet.
 *   3. weather.condition === 'dry'   AND stage === 'planting'
 *        → "Plant now" — good soil condition.
 *   4. weather.temperature > 32
 *        → "Water crops early" — high heat risk.
 *   5. DEFAULT — return baseTask unchanged.
 *
 * Output shape
 *   ─ title    : string (display headline, replaces baseTask.title)
 *   ─ reason   : short explanation ("Soil is too wet")
 *   ─ action   : recommended next step ("Wait for dry conditions")
 *   ─ blocked  : true when work should be paused/delayed; the UI
 *                uses this to swap the CTA to "Wait" / "Check again
 *                later" instead of "Act now"
 *   ─ source   : one of WEATHER_SOURCES (for analytics + tests)
 *   ─ baseTitle: the original title, kept so the UI can show "was:
 *                Prepare rows for maize" alongside the override
 *
 * Spec contract: never throws, never returns null. When weather is
 * missing the function echoes baseTask back so callers can render
 * unconditionally.
 */

export const WEATHER_SOURCES = Object.freeze({
  STORM:    'weather_storm',
  RAIN:     'weather_rain_pause',
  DRY:      'weather_dry_proceed',
  HEAT:     'weather_heat_water',
  PASSTHRU: 'passthrough',
});

// Stages where active field work is the wrong call when soil is
// wet. Cassava-first set — cane-and-roots crops have similar
// sensitivity. We deliberately exclude harvest + post-harvest
// since rain doesn't pause those decisions the same way.
const WET_SOIL_SENSITIVE_STAGES = new Set([
  'land_prep',
  'land_preparation',
  'planting',
  'plant',
  'sowing',
  'transplant',
  'transplanting',
  'weeding',
  'weed',
  'fertilizing',
  'fertilize',
]);

const HOT_TEMP_THRESHOLD_C = 32;

function _stageId(stage) {
  if (!stage) return '';
  return String(stage).toLowerCase().trim().replace(/\s+/g, '_');
}

function _baseSafe(baseTask) {
  // Defensive copy with safe defaults — keeps callers that pass
  // partial tasks (from a network failure) from rendering blank.
  if (!baseTask || typeof baseTask !== 'object') {
    return {
      title:       'Check your farm today',
      reason:      '',
      action:      '',
      instruction: '',
      blocked:     false,
      source:      WEATHER_SOURCES.PASSTHRU,
    };
  }
  return {
    title:       baseTask.title       || 'Check your farm today',
    reason:      baseTask.reason      || '',
    action:      baseTask.action      || baseTask.instruction || '',
    instruction: baseTask.instruction || '',
    blocked:     baseTask.blocked === true,
    source:      baseTask.source || WEATHER_SOURCES.PASSTHRU,
  };
}

/**
 * adaptTaskForWeather — main entry point.
 *
 *   in:  { crop, stage, weather, baseTask }
 *   out: adapted task (see header)
 *
 * `weather` is the canonical spec shape produced by
 * src/services/weatherService.js (mapWeatherToSpec). When weather
 * is null/undefined the function returns the base task verbatim.
 */
export function adaptTaskForWeather({
  crop,
  stage,
  weather,
  baseTask,
} = {}) {
  const base = _baseSafe(baseTask);

  // Fallback (spec §7): no weather → no adaptation.
  if (!weather || typeof weather !== 'object') return base;

  const cond  = String(weather.condition || '').toLowerCase();
  const temp  = Number.isFinite(Number(weather.temperature))
    ? Number(weather.temperature) : null;
  const stg   = _stageId(stage);

  // ── Rule 1: Storm — always delay field work ───────────────
  if (cond === 'storm') {
    return Object.freeze({
      ...base,
      title:     'Delay field work',
      reason:    'Storm risk today',
      action:    'Resume after weather clears',
      blocked:   true,
      source:    WEATHER_SOURCES.STORM,
      baseTitle: base.title,
    });
  }

  // ── Rule 2: Rain + wet-soil-sensitive stage → pause ───────
  if (cond === 'rain' && WET_SOIL_SENSITIVE_STAGES.has(stg)) {
    // Build a stage-specific title so "Pause" reads concretely.
    // We map the canonical stage id to a short verb the farmer
    // recognises — keeps the override from sounding generic.
    const verb = _pauseVerb(stg);
    return Object.freeze({
      ...base,
      title:     `Pause ${verb}`,
      reason:    'Soil is too wet',
      action:    'Wait for dry conditions',
      blocked:   true,
      source:    WEATHER_SOURCES.RAIN,
      baseTitle: base.title,
    });
  }

  // ── Rule 3: Dry + planting → green light ──────────────────
  if (cond === 'dry' && (stg === 'planting' || stg === 'plant' || stg === 'sowing')) {
    return Object.freeze({
      ...base,
      title:     'Plant now',
      reason:    'Good soil condition',
      action:    base.action || 'Sow into prepared rows today',
      blocked:   false,
      source:    WEATHER_SOURCES.DRY,
      baseTitle: base.title,
    });
  }

  // ── Rule 4: High heat → water early ───────────────────────
  if (temp != null && temp > HOT_TEMP_THRESHOLD_C) {
    return Object.freeze({
      ...base,
      title:     'Water crops early',
      reason:    'High heat risk',
      action:    'Irrigate before midday to reduce stress',
      blocked:   false,
      source:    WEATHER_SOURCES.HEAT,
      baseTitle: base.title,
    });
  }

  // ── Default: passthrough ──────────────────────────────────
  return Object.freeze({
    ...base,
    source: WEATHER_SOURCES.PASSTHRU,
  });
}

/**
 * Build a one-line "weather impact" string the Home card renders
 * below the task title. Returns null when there's nothing
 * weather-driven to say — the card hides the line in that case.
 */
export function buildWeatherImpactLine(weather) {
  if (!weather || typeof weather !== 'object') return null;
  const cond = String(weather.condition || '').toLowerCase();
  const temp = Number.isFinite(Number(weather.temperature))
    ? Number(weather.temperature) : null;

  // Emoji-prefixed lines per spec §3. Kept short and mobile-safe.
  if (cond === 'storm')  return '\u26A1 Storm risk \u2014 delay field work';
  if (cond === 'rain')   return '\uD83C\uDF27 Rain detected \u2014 wait for dry conditions';
  if (temp != null && temp > HOT_TEMP_THRESHOLD_C) {
    return '\uD83D\uDD25 High heat \u2014 water crops early';
  }
  if (cond === 'cold')   return '\uD83C\uDF2C Cold conditions \u2014 protect seedlings';
  if (cond === 'dry')    return '\u2600\uFE0F Good conditions \u2014 proceed';
  return null;
}

/**
 * Pick the right CTA wording for the smart-button rule (spec §5).
 *
 *   blocked + storm        → "Wait"
 *   blocked + rain (other) → "Check again later"
 *   not blocked            → null  (caller uses its existing
 *                                    primary CTA wording —
 *                                    "Act now" or "Complete setup")
 */
export function pickAdaptedCtaLabel(adapted) {
  if (!adapted || adapted.blocked !== true) return null;
  if (adapted.source === WEATHER_SOURCES.STORM) return 'Wait';
  return 'Check again later';
}

// ─── Internal helpers ────────────────────────────────────────────
function _pauseVerb(stageId) {
  switch (stageId) {
    case 'land_prep':
    case 'land_preparation': return 'land preparation';
    case 'planting':
    case 'plant':
    case 'sowing':           return 'planting';
    case 'transplant':
    case 'transplanting':    return 'transplanting';
    case 'weeding':
    case 'weed':             return 'weeding';
    case 'fertilizing':
    case 'fertilize':        return 'fertilizing';
    default:                 return 'field work';
  }
}

export const _internal = Object.freeze({
  WET_SOIL_SENSITIVE_STAGES,
  HOT_TEMP_THRESHOLD_C,
  _pauseVerb,
});
