/**
 * simpleTaskEngine.js — minimum-viable task engine.
 *
 * Returns ONE next-best-action for a farm given a tiny input shape.
 * Designed for low-friction surfaces where the full
 * `recommendForFarm()` pipeline (1 primary + 2 secondary, signal
 * snapshot, confidence band) is overkill — e.g. a Quick-Start
 * splash, a single-row demo widget, an onboarding fallback panel.
 *
 * It coexists with the richer pipeline. New farmer surfaces should
 * still prefer:
 *
 *   import { recommendForFarm } from '../intelligence/recommendationEngine.js';
 *
 * because that path produces 1+2 with topic dedup and confidence.
 * The simple engine is the right fit only when the caller wants a
 * single deterministic line of copy + an action hint.
 *
 * Strict contract
 * ───────────────
 *   • Pure function. No I/O. No translation.
 *   • Never throws.
 *   • Defensive on every input — any field may be null / undefined.
 *
 * Output shape
 * ────────────
 *   {
 *     action:        'setup' | 'task',
 *     titleKey:      string,            // localised via tStrict
 *     titleFallback: string,            // English fallback
 *     reasonKey:     string,
 *     reasonFallback:string,
 *     urgencyKey?:   string,            // optional
 *     urgencyFallback?: string,
 *     ttsKey?:       string,            // prompt id for voiceEngine.speakKey
 *     vars?:         object,            // interpolation vars (e.g. { crop })
 *     ruleId:        string,            // for analytics / debugging
 *   }
 *
 * Rule priority (first match wins)
 * ────────────────────────────────
 *   1. no farm                          → action: 'setup'
 *   2. activity.daysInactive ≥ 2        → "Resume farm activity"
 *   3. weather.rainExpected (or model)  → "Prepare soil before rain"
 *   4. crop + stage === 'planting'      → "Prepare rows for {crop}"
 *   5. fallback                         → "Check your farm"
 *
 * Voice support
 * ─────────────
 * Each output carries a `ttsKey` mapping to an existing prompt id
 * in `src/services/voicePrompts.js` so VoiceButton + the prerecorded
 * Twi clip path keep working with no new audio assets:
 *   setup    → 'nav.setupFarm'
 *   inactive → 'status.needsUpdate'
 *   rain     → 'task.clearField'    (closest semantic match)
 *   planting → 'task.plant'
 *   generic  → 'task.default'
 */

import { normalizeCropId } from '../config/crops/index.js';

export const ACTIONS = Object.freeze({
  SETUP: 'setup',
  TASK:  'task',
});

const RULE = Object.freeze({
  SETUP:    'setup',
  INACTIVE: 'inactive',
  RAIN:     'rain',
  PLANTING: 'planting',
  GENERIC:  'generic',
});

// Inputs that count as "no farm". Empty crop + missing id together
// signal an unsetup farm; the helper ALSO accepts a literal null or
// non-object so callers don't have to guard.
function _hasFarm(farm) {
  if (!farm || typeof farm !== 'object') return false;
  // A farm is considered "set up" when it has at least a crop OR an
  // id. Loose check on purpose — we don't want to nag a farmer who
  // has a partial setup but is mid-onboarding.
  return !!(farm.crop || farm.id || farm.farmId);
}

function _isRainExpected(weather) {
  if (!weather || typeof weather !== 'object') return false;
  if (weather.rainExpected === true) return true;
  // Also accept the existing payload shape from the rest of the app.
  if (weather.heavyRain || weather.severe) return true;
  if (typeof weather.rainMm24h === 'number' && weather.rainMm24h > 6) return true;
  // The page-level liveWeather status enum used by FarmerTodayPage.
  if (weather.status === 'high_rain' || weather.status === 'rain_soon') return true;
  return false;
}

function _stageIs(farm, target) {
  if (!farm) return false;
  const s = String(farm.cropStage || farm.stage || '').toLowerCase();
  return s === target;
}

/**
 * @param {object} input
 * @param {object|null} [input.farm]
 * @param {object|null} [input.weather]
 * @param {object|null} [input.activity]   { daysInactive: number, ... }
 * @returns {object} task descriptor (see contract above)
 */
export function generateTodayTask({ farm, weather, activity } = {}) {
  try {
    // Rule 1 — no farm setup
    if (!_hasFarm(farm)) {
      return _result({
        ruleId:        RULE.SETUP,
        action:        ACTIONS.SETUP,
        titleKey:      'simpleTask.setup.title',
        titleFallback: 'Set up your farm',
        reasonKey:     'simpleTask.setup.reason',
        reasonFallback:'Add crop and location to get guidance',
        ttsKey:        'nav.setupFarm',
      });
    }

    // Rule 2 — inactivity (NEW capability vs. recommendForFarm)
    const days = Number(activity?.daysInactive);
    if (Number.isFinite(days) && days >= 2) {
      return _result({
        ruleId:           RULE.INACTIVE,
        action:           ACTIONS.TASK,
        titleKey:         'simpleTask.inactive.title',
        titleFallback:    'Resume farm activity',
        reasonKey:        'simpleTask.inactive.reason',
        reasonFallback:   'Consistent action improves yield',
        urgencyKey:       'simpleTask.inactive.urgency',
        urgencyFallback:  'Get back on track',
        ttsKey:           'status.needsUpdate',
      });
    }

    // Rule 3 — rain expected
    if (_isRainExpected(weather)) {
      return _result({
        ruleId:           RULE.RAIN,
        action:           ACTIONS.TASK,
        titleKey:         'simpleTask.rain.title',
        titleFallback:    'Prepare soil before rain',
        reasonKey:        'simpleTask.rain.reason',
        reasonFallback:   'Rain may delay field work',
        urgencyKey:       'simpleTask.rain.urgency',
        urgencyFallback:  'Act early today',
        ttsKey:           'task.clearField',
      });
    }

    // Rule 4 — planting stage on any crop. The snippet was hardcoded
    // to maize; the clean version normalises any crop alias and
    // surfaces a generalised "Prepare rows for {crop}" line. Caller
    // resolves the i18n template with `vars.crop` swapped in.
    if (_stageIs(farm, 'planting')) {
      const cropId = _safeNormalizeCrop(farm.crop);
      return _result({
        ruleId:           RULE.PLANTING,
        action:           ACTIONS.TASK,
        titleKey:         'simpleTask.planting.title',
        titleFallback:    'Prepare rows for {crop}',
        reasonKey:        'simpleTask.planting.reason',
        reasonFallback:   'Better soil prep improves yield',
        urgencyKey:       'simpleTask.planting.urgency',
        urgencyFallback:  'Do before planting window closes',
        ttsKey:           'task.plant',
        vars:             { crop: cropId || '' },
      });
    }

    // Rule 5 — generic fallback so the engine never returns nothing.
    return _result({
      ruleId:        RULE.GENERIC,
      action:        ACTIONS.TASK,
      titleKey:      'simpleTask.generic.title',
      titleFallback: 'Check your farm',
      reasonKey:     'simpleTask.generic.reason',
      reasonFallback:'Stay on track with daily actions',
      ttsKey:        'task.default',
    });
  } catch {
    // Worst-case: degrade to the generic line, never null.
    return _result({
      ruleId:        RULE.GENERIC,
      action:        ACTIONS.TASK,
      titleKey:      'simpleTask.generic.title',
      titleFallback: 'Check your farm',
      reasonKey:     'simpleTask.generic.reason',
      reasonFallback:'Stay on track with daily actions',
      ttsKey:        'task.default',
    });
  }
}

// ─── Internals ──────────────────────────────────────────────

function _safeNormalizeCrop(value) {
  try {
    if (!value) return '';
    const id = normalizeCropId(value);
    return id || String(value).toLowerCase();
  } catch {
    return '';
  }
}

function _result(obj) {
  return Object.freeze({ ...obj });
}

// Re-exported for tests + callers that want the rule constants
// without parsing the result's `ruleId` string.
export { RULE };
