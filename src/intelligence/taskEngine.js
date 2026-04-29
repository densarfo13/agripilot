/**
 * src/intelligence/taskEngine.js — production task engine.
 *
 * Generates ONE main daily task from the available farm + weather +
 * risk + activity signals. Coexists with:
 *
 *   • src/lib/tasks/taskEngine.js         — the existing canonical
 *     task engine (server-side feeds + stage templates). Untouched.
 *   • src/intelligence/recommendationEngine.js — the 1+2 signal-
 *     ranking pipeline.
 *   • src/intelligence/simpleTaskEngine.js — the minimum-viable
 *     single-line generator (fewer rules, sparser output shape).
 *
 * THIS module is the spec-named production engine — wider rule set
 * than simpleTaskEngine, richer output shape than recommendationEngine.
 * New surfaces (NextBestActionCard, hub widgets, demo splash) opt
 * in via the public adapter `generateTodayTask`.
 *
 * Strict contract
 * ───────────────
 *   • Pure JS. Defensive on every input. Never throws.
 *   • NEVER returns null. The 8-rule chain ends in a default
 *     "Check your farm today" line so output is always renderable.
 *   • Resolved title / instruction / reason / timing / riskWarning
 *     strings are localised via tStrict at call time. The engine
 *     also returns the underlying i18n keys as `*Key` fields so a
 *     caller that prefers to render via its own i18n stack can.
 *
 * Output shape (per spec §1)
 * ──────────────────────────
 *   {
 *     id:           string,         // stable per-rule id
 *     title:        string,         // resolved via tStrict
 *     instruction:  string,
 *     reason:       string,
 *     urgency:      'LOW' | 'MEDIUM' | 'HIGH',
 *     timing:       string,         // optional human window ("today")
 *     riskWarning:  string,         // optional consequence-if-ignored
 *     actionType:   string,         // canonical taxonomy
 *     source:       string,         // rule id that produced the task
 *     createdAt:    number,         // ms epoch
 *
 *     // Internal extras for callers that want raw keys / vars:
 *     titleKey, instructionKey, reasonKey, timingKey, riskWarningKey,
 *     vars,                        // interpolation { crop, days, ... }
 *     dataUsed:    string[],        // explainability — which inputs
 *                                   //  the rule consumed
 *     ttsKey:       string,         // prompt id for voiceEngine.speakKey
 *   }
 *
 * Priority chain (spec §2)
 * ────────────────────────
 *   1. setup_incomplete       — missing crop / location / size
 *   2. pest_high              — risks.pest === 'high' (or HIGH)
 *   3. drought_high           — risks.drought === 'high'
 *   4. weather_rain           — rain expected today
 *   4b weather_heat           — high heat (medium urgency)
 *   5. crop_stage             — crop+stage from the matrix
 *   6. inactivity             — daysInactive >= 2
 *   7. harvest_sell           — crop near harvest with no listing
 *   7b funding_match          — matched funding programs
 *   8. default                — "Check your farm today"
 *
 * Offline behaviour (spec §13)
 * ────────────────────────────
 * The engine never fetches anything. Caller decides what to pass:
 * if `weather` / `risks` are missing the rules degrade gracefully
 * (no false "rain expected") and the chain falls through to
 * crop_stage or default. Output is always renderable.
 */

import { normalizeCropId } from '../config/crops/index.js';
import { tStrict } from '../i18n/strictT.js';

// ─── Public constants ───────────────────────────────────────

export const URGENCY = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });
export const ACTION_TYPE = Object.freeze({
  SETUP:    'setup',
  INSPECT:  'inspect',
  IRRIGATE: 'irrigate',
  PLANT:    'plant',
  WEED:     'weed',
  HARVEST:  'harvest',
  PROTECT:  'protect',
  RECORD:   'record',
  REVIEW:   'review',
  CHECK:    'check',
});

// Rule ids — surfaced as `task.source` for analytics + test pinning.
const RULE = Object.freeze({
  SETUP_INCOMPLETE: 'setup_incomplete',
  PEST_HIGH:        'pest_high',
  DROUGHT_HIGH:     'drought_high',
  WEATHER_RAIN:     'weather_rain',
  WEATHER_HEAT:     'weather_heat',
  CROP_STAGE:       'crop_stage',
  INACTIVITY:       'inactivity',
  HARVEST_SELL:     'harvest_sell',
  FUNDING_MATCH:    'funding_match',
  DEFAULT:          'default',
});

// ─── Crop × stage matrix (spec §7) ──────────────────────────

const CROP_STAGE_MATRIX = Object.freeze({
  maize: Object.freeze({
    planning:    _stageRow('plan',  ACTION_TYPE.PLANT,    'Plan your maize season',     'Decide planting window, choose seeds, prepare inputs.'),
    land_prep:   _stageRow('clear', ACTION_TYPE.PLANT,    'Prepare rows for maize',     'Make rows about 75cm apart before planting.'),
    land_preparation: _stageRow('clear', ACTION_TYPE.PLANT, 'Prepare rows for maize',   'Make rows about 75cm apart before planting.'),
    planting:    _stageRow('plant', ACTION_TYPE.PLANT,    'Plant maize seeds',          'Plant seeds at the right spacing and cover lightly.'),
    germination: _stageRow('check', ACTION_TYPE.INSPECT,  'Check seedling emergence',   'Walk the field and confirm even sprouting.'),
    vegetative:  _stageRow('weed',  ACTION_TYPE.WEED,     'Remove weeds around maize',  'Clear weeds so maize can grow better.'),
    flowering:   _stageRow('inspect', ACTION_TYPE.INSPECT,'Check maize flowers',         'Look for healthy tassels and silks; flag any pests.'),
    fruiting:    _stageRow('inspect', ACTION_TYPE.INSPECT,'Check developing cobs',       'Watch for pests and steady cob fill.'),
    harvest:     _stageRow('harvest', ACTION_TYPE.HARVEST,'Prepare maize for harvest',  'Check if cobs are dry enough and prepare storage.'),
    post_harvest:_stageRow('record', ACTION_TYPE.RECORD,  'Record your maize harvest',  'Log how much you harvested to plan next season.'),
  }),
  cassava: Object.freeze({
    planning:    _stageRow('plan',   ACTION_TYPE.PLANT,    'Plan your cassava planting',  'Choose stems and prepare planting site.'),
    land_prep:   _stageRow('clear',  ACTION_TYPE.PLANT,    'Clear and ridge for cassava', 'Make ridges and clear weeds before planting.'),
    land_preparation: _stageRow('clear', ACTION_TYPE.PLANT, 'Clear and ridge for cassava','Make ridges and clear weeds before planting.'),
    planting:    _stageRow('plant',  ACTION_TYPE.PLANT,    'Plant cassava stems',         'Cut stems and plant at proper angle and depth.'),
    establishment: _stageRow('check',ACTION_TYPE.INSPECT,  'Check cassava establishment', 'Confirm stems have rooted and are growing.'),
    growth:      _stageRow('weed',   ACTION_TYPE.WEED,     'Weed your cassava plot',      'Clear weeds to keep cassava growing strong.'),
    vegetative:  _stageRow('weed',   ACTION_TYPE.WEED,     'Weed your cassava plot',      'Clear weeds to keep cassava growing strong.'),
    harvest:     _stageRow('harvest',ACTION_TYPE.HARVEST,  'Harvest mature cassava',      'Check root size and lift roots carefully.'),
    post_harvest:_stageRow('record', ACTION_TYPE.RECORD,   'Record your cassava harvest', 'Log how much you harvested.'),
  }),
  rice: Object.freeze({
    planning:    _stageRow('plan',   ACTION_TYPE.PLANT,    'Plan your rice season',       'Pick seed and prepare nursery beds.'),
    nursery:     _stageRow('plant',  ACTION_TYPE.PLANT,    'Tend your rice nursery',      'Keep seedlings moist and healthy.'),
    transplanting: _stageRow('plant',ACTION_TYPE.PLANT,    'Transplant rice seedlings',   'Move strong seedlings to flooded field.'),
    vegetative:  _stageRow('weed',   ACTION_TYPE.WEED,     'Manage your rice paddy',      'Watch water levels and remove weeds.'),
    flowering:   _stageRow('inspect',ACTION_TYPE.INSPECT,  'Check rice flowering',         'Confirm even flowering; flag pest signs.'),
    harvest:     _stageRow('harvest',ACTION_TYPE.HARVEST,  'Harvest mature rice',          'Check grain hardness and prepare for cutting.'),
    post_harvest:_stageRow('record', ACTION_TYPE.RECORD,   'Record your rice harvest',    'Log how much you harvested.'),
  }),
});

function _stageRow(slug, actionType, titleFallback, instructionFallback) {
  return Object.freeze({ slug, actionType, titleFallback, instructionFallback });
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate one main daily task.
 *
 * @param {object} input
 * @param {object|null} [input.farm]
 * @param {object|null} [input.weather]
 * @param {object|null} [input.risks]           { pest, drought, level... }
 * @param {object|null} [input.activity]        { daysInactive: number }
 * @param {object[]|null} [input.fundingMatches]
 * @param {object|null} [input.buyerSignals]    { hasListing: bool }
 * @returns {object} task descriptor (see contract above) — NEVER null
 */
export function generateTodayTask(input = {}) {
  try {
    return _resolve(_pickRule(input), input);
  } catch {
    // Worst-case fallback — never blank.
    return _resolve({
      ruleId:        RULE.DEFAULT,
      titleKey:      'taskEngine.default.title',
      titleFallback: 'Check your farm today',
      instructionKey:'taskEngine.default.instruction',
      instructionFallback: 'Walk the field and note any concerns.',
      reasonKey:     'taskEngine.default.reason',
      reasonFallback:'Daily checks catch problems early.',
      urgency:       URGENCY.LOW,
      actionType:    ACTION_TYPE.CHECK,
      ttsKey:        'task.default',
      dataUsed:      [],
    }, input);
  }
}

// ─── Rule chain ─────────────────────────────────────────────

function _pickRule({ farm, weather, risks, activity, fundingMatches, buyerSignals } = {}) {
  // 1 — setup incomplete
  const setupGap = _setupIncomplete(farm);
  if (setupGap) {
    return {
      ruleId:        RULE.SETUP_INCOMPLETE,
      titleKey:      'taskEngine.setup.title',
      titleFallback: 'Complete your farm setup',
      instructionKey:'taskEngine.setup.instruction',
      instructionFallback: 'Add crop, location, and farm size to get better guidance.',
      reasonKey:     'taskEngine.setup.reason',
      reasonFallback:'Setup unlocks daily tasks tailored to your farm.',
      urgency:       URGENCY.HIGH,
      actionType:    ACTION_TYPE.SETUP,
      ttsKey:        'nav.setupFarm',
      dataUsed:      ['farm.crop', 'farm.location', 'farm.size'],
    };
  }

  // 2 — high pest risk
  if (_isHigh(risks?.pest)) {
    return {
      ruleId:        RULE.PEST_HIGH,
      titleKey:      'taskEngine.pest.title',
      titleFallback: 'Inspect your crop for pests',
      instructionKey:'taskEngine.pest.instruction',
      instructionFallback: 'Check leaves, stems, and new growth for early signs of pests.',
      reasonKey:     'taskEngine.pest.reason',
      reasonFallback:'Early pest checks can prevent crop damage.',
      timingKey:     'taskEngine.timing.today',
      timingFallback:'Today',
      riskWarningKey:'taskEngine.pest.risk',
      riskWarningFallback:'Pests can spread fast if missed.',
      urgency:       URGENCY.HIGH,
      actionType:    ACTION_TYPE.INSPECT,
      ttsKey:        'task.checkPests',
      dataUsed:      ['risks.pest'],
    };
  }

  // 3 — high drought risk
  if (_isHigh(risks?.drought)) {
    return {
      ruleId:        RULE.DROUGHT_HIGH,
      titleKey:      'taskEngine.drought.title',
      titleFallback: 'Check soil moisture today',
      instructionKey:'taskEngine.drought.instruction',
      instructionFallback: 'Check if the soil is dry around your crop roots.',
      reasonKey:     'taskEngine.drought.reason',
      reasonFallback:'Dry soil can slow crop growth.',
      timingKey:     'taskEngine.timing.today',
      timingFallback:'Today',
      riskWarningKey:'taskEngine.drought.risk',
      riskWarningFallback:'Crops stressed by dry soil yield less.',
      urgency:       URGENCY.HIGH,
      actionType:    ACTION_TYPE.IRRIGATE,
      ttsKey:        'task.water',
      dataUsed:      ['risks.drought'],
    };
  }

  // 4 — weather rules
  if (_rainExpected(weather)) {
    const urgent = !!(weather?.rainImminent || weather?.severe || weather?.heavyRain);
    return {
      ruleId:        RULE.WEATHER_RAIN,
      titleKey:      'taskEngine.rain.title',
      titleFallback: 'Finish field work before rain',
      instructionKey:'taskEngine.rain.instruction',
      instructionFallback: 'Complete soil preparation or field checks before rain starts.',
      reasonKey:     'taskEngine.rain.reason',
      reasonFallback:'Rain can delay field work.',
      timingKey:     urgent ? 'taskEngine.timing.beforeRain' : 'taskEngine.timing.earlyToday',
      timingFallback: urgent ? 'Before rain starts' : 'Early today',
      riskWarningKey:'taskEngine.rain.risk',
      riskWarningFallback:'Wet fields slow you down for days.',
      urgency:       urgent ? URGENCY.HIGH : URGENCY.MEDIUM,
      actionType:    ACTION_TYPE.PROTECT,
      ttsKey:        'task.clearField',
      dataUsed:      ['weather.rainExpectedToday'],
    };
  }
  if (_heatHigh(weather)) {
    return {
      ruleId:        RULE.WEATHER_HEAT,
      titleKey:      'taskEngine.heat.title',
      titleFallback: 'Check crop for heat stress',
      instructionKey:'taskEngine.heat.instruction',
      instructionFallback: 'Look for wilting, dry leaves, or heat stress on your crop.',
      reasonKey:     'taskEngine.heat.reason',
      reasonFallback:'Heat can dry leaves and stress new growth.',
      timingKey:     'taskEngine.timing.today',
      timingFallback:'Today',
      urgency:       URGENCY.MEDIUM,
      actionType:    ACTION_TYPE.INSPECT,
      ttsKey:        'task.checkPests',
      dataUsed:      ['weather.heatHigh'],
    };
  }

  // 5 — crop + stage matrix
  const cropStage = _resolveCropStage(farm);
  if (cropStage) {
    const cropLower = _safeNormalizeCrop(farm?.crop);
    const matrix = CROP_STAGE_MATRIX[cropLower] || null;
    const row = matrix && matrix[cropStage.stage];
    if (row) {
      const baseKey = `taskEngine.${cropLower}.${cropStage.stage}`;
      return {
        ruleId:         RULE.CROP_STAGE,
        titleKey:       `${baseKey}.title`,
        titleFallback:  row.titleFallback,
        instructionKey: `${baseKey}.instruction`,
        instructionFallback: row.instructionFallback,
        reasonKey:      'taskEngine.cropStage.reason',
        reasonFallback: 'Based on your crop stage and today\u2019s weather.',
        timingKey:      'taskEngine.timing.today',
        timingFallback: 'Today',
        urgency:        URGENCY.MEDIUM,
        actionType:     row.actionType,
        ttsKey:         _ttsForStage(row.slug),
        vars:           { crop: cropLower },
        dataUsed:       ['farm.crop', 'farm.cropStage'],
      };
    }
  }

  // 6 — inactivity recovery
  if (_inactiveDays(activity) >= 2) {
    return {
      ruleId:        RULE.INACTIVITY,
      titleKey:      'taskEngine.inactive.title',
      titleFallback: 'Get back on track',
      instructionKey:'taskEngine.inactive.instruction',
      instructionFallback: 'Check your farm today and complete one important action.',
      reasonKey:     'taskEngine.inactive.reason',
      reasonFallback:'Consistent checks help prevent missed problems.',
      timingKey:     'taskEngine.timing.today',
      timingFallback:'Today',
      urgency:       URGENCY.MEDIUM,
      actionType:    ACTION_TYPE.CHECK,
      ttsKey:        'status.needsUpdate',
      vars:          { days: _inactiveDays(activity) },
      dataUsed:      ['activity.daysInactive'],
    };
  }

  // 7 — harvest-near + no listing → prepare-to-sell.
  if (_harvestNear(farm) && !_hasListing(buyerSignals)) {
    return {
      ruleId:        RULE.HARVEST_SELL,
      titleKey:      'taskEngine.harvestSell.title',
      titleFallback: 'Prepare to sell your produce',
      instructionKey:'taskEngine.harvestSell.instruction',
      instructionFallback: 'Check quantity and mark produce ready when harvest is close.',
      reasonKey:     'taskEngine.harvestSell.reason',
      reasonFallback:'Buyers can find ready produce faster.',
      urgency:       URGENCY.MEDIUM,
      actionType:    ACTION_TYPE.HARVEST,
      ttsKey:        'task.harvest',
      dataUsed:      ['farm.cropStage', 'buyerSignals.hasListing'],
    };
  }

  // 7b — funding match available.
  if (Array.isArray(fundingMatches) && fundingMatches.length > 0) {
    return {
      ruleId:        RULE.FUNDING_MATCH,
      titleKey:      'taskEngine.fundingMatch.title',
      titleFallback: 'Review a support opportunity',
      instructionKey:'taskEngine.fundingMatch.instruction',
      instructionFallback: 'Check funding or support programs that may match your farm.',
      reasonKey:     'taskEngine.fundingMatch.reason',
      reasonFallback:'A program in your area may apply to your crop.',
      urgency:       URGENCY.LOW,
      actionType:    ACTION_TYPE.REVIEW,
      ttsKey:        'help.needSupport',
      dataUsed:      ['fundingMatches'],
    };
  }

  // 8 — default fallback
  return {
    ruleId:        RULE.DEFAULT,
    titleKey:      'taskEngine.default.title',
    titleFallback: 'Check your farm today',
    instructionKey:'taskEngine.default.instruction',
    instructionFallback: 'Walk the field and note any concerns.',
    reasonKey:     'taskEngine.default.reason',
    reasonFallback:'Daily checks catch problems early.',
    urgency:       URGENCY.LOW,
    actionType:    ACTION_TYPE.CHECK,
    ttsKey:        'task.default',
    dataUsed:      [],
  };
}

// ─── Resolution: turn keys into rendered strings ────────────

function _resolve(rule, input) {
  const vars = rule.vars || {};
  const title       = _t(rule.titleKey,       rule.titleFallback,       vars);
  const instruction = _t(rule.instructionKey, rule.instructionFallback, vars);
  const reason      = _t(rule.reasonKey,      rule.reasonFallback,      vars);
  const timing      = rule.timingKey      ? _t(rule.timingKey,      rule.timingFallback || '',      vars) : '';
  const riskWarning = rule.riskWarningKey ? _t(rule.riskWarningKey, rule.riskWarningFallback || '', vars) : '';

  return Object.freeze({
    id:           `${rule.ruleId}-${Date.now()}`,
    title, instruction, reason, timing, riskWarning,
    urgency:      rule.urgency || URGENCY.LOW,
    actionType:   rule.actionType || ACTION_TYPE.CHECK,
    source:       rule.ruleId,
    createdAt:    Date.now(),
    titleKey:        rule.titleKey || null,
    instructionKey:  rule.instructionKey || null,
    reasonKey:       rule.reasonKey || null,
    timingKey:       rule.timingKey || null,
    riskWarningKey:  rule.riskWarningKey || null,
    vars:            vars,
    dataUsed:        Object.freeze((rule.dataUsed || []).slice()),
    ttsKey:          rule.ttsKey || null,
  });
}

function _t(key, fallback, vars) {
  let s = '';
  try { s = tStrict(key, fallback || '', vars); } catch { s = fallback || ''; }
  // tStrict already interpolates `{var}` tokens via baseT(). When
  // strict mode returns '' (key missing in non-en) we still want
  // the caller's fallback so the engine never produces an empty
  // string for a known rule. The fallback is the english template;
  // run a manual interpolation pass for it as a safety net.
  if (!s && fallback) s = _interpolate(fallback, vars);
  return s;
}

function _interpolate(template, vars) {
  if (!template) return '';
  let out = String(template);
  if (!vars) return out;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v == null ? '' : v));
  }
  return out;
}

// ─── Helpers ────────────────────────────────────────────────

function _setupIncomplete(farm) {
  if (!farm || typeof farm !== 'object') return true;
  const hasCrop     = !!farm.crop;
  const hasLocation = !!(farm.region || farm.country || farm.countryCode || farm.location);
  const hasSize     = _isPositiveNumber(farm.size ?? farm.farmSize);
  return !(hasCrop && hasLocation && hasSize);
}

function _isHigh(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.toLowerCase() === 'high';
  if (typeof value === 'object') {
    if (value.level) return _isHigh(value.level);
    if (value.severity) return _isHigh(value.severity);
  }
  return false;
}

function _rainExpected(weather) {
  if (!weather || typeof weather !== 'object') return false;
  if (weather.rainExpectedToday === true) return true;
  if (weather.rainExpected === true)      return true;
  if (weather.heavyRain || weather.severe) return true;
  if (typeof weather.rainMm24h === 'number' && weather.rainMm24h > 6) return true;
  if (weather.status === 'high_rain' || weather.status === 'rain_soon') return true;
  return false;
}

function _heatHigh(weather) {
  if (!weather || typeof weather !== 'object') return false;
  if (weather.heatHigh === true)       return true;
  if (weather.hot === true)            return true;
  if (typeof weather.tempC === 'number' && weather.tempC > 34) return true;
  if (weather.status === 'excessive_heat') return true;
  return false;
}

function _resolveCropStage(farm) {
  if (!farm) return null;
  const crop  = _safeNormalizeCrop(farm.crop);
  const stage = String(farm.cropStage || farm.stage || '').toLowerCase();
  if (!crop || !stage) return null;
  return { crop, stage };
}

function _safeNormalizeCrop(value) {
  try {
    if (!value) return '';
    const id = normalizeCropId(value);
    return (id || String(value)).toLowerCase();
  } catch {
    return value ? String(value).toLowerCase() : '';
  }
}

function _inactiveDays(activity) {
  if (!activity || typeof activity !== 'object') return 0;
  const n = Number(activity.daysInactive);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function _harvestNear(farm) {
  if (!farm) return false;
  const stage = String(farm.cropStage || farm.stage || '').toLowerCase();
  return stage === 'harvest' || stage === 'fruiting';
}

function _hasListing(buyerSignals) {
  if (!buyerSignals) return false;
  return buyerSignals.hasListing === true || buyerSignals.listingCount > 0;
}

function _isPositiveNumber(v) {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0;
}

// Map crop-stage `slug` to an existing voicePrompts id so the
// prerecorded clip path keeps working.
function _ttsForStage(slug) {
  switch (slug) {
    case 'plan':    return 'task.finishSetup';
    case 'clear':   return 'task.clearField';
    case 'plant':   return 'task.plant';
    case 'check':   return 'task.scout';
    case 'weed':    return 'task.weed';
    case 'inspect': return 'task.scout';
    case 'harvest': return 'task.harvest';
    case 'record':  return 'task.completed';
    default:        return 'task.default';
  }
}

export { RULE, CROP_STAGE_MATRIX };
