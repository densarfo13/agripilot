/**
 * recommendationEngine.js — generates a set of candidate task
 * suggestions DIRECTLY from signals (weather + pest + stage + yield
 * + satellite), without requiring the existing taskEngine to have
 * produced a candidate list first.
 *
 * Why this exists alongside `recommendationRanker.js`
 * ───────────────────────────────────────────────────
 * The ranker REORDERS pre-existing candidates from
 * `lib/tasks/taskEngine.js#generateTasks()`. It assumes someone
 * upstream already produced a list. THIS module is the
 * upstream-less path: given just a farm + signals, produce a
 * fresh candidate list. Useful for:
 *   • Brand-new farms before stage templates have been run.
 *   • Diagnostic surfaces ("what should this farm do right now?")
 *     in NGO dashboards.
 *   • Voice-assistant fallback when the farmer asks "what now".
 *
 * Output shape matches the ranker's expected input — `{ id,
 * titleKey, priority, stage, reasons }` — so the same downstream
 * chain (rankCandidates → 1 primary + 2 secondary) just works.
 *
 * Strict rules
 * ────────────
 *   • Pure function. No I/O. No translation.
 *   • Never throws.
 *   • Reuses existing prompt ids (`task.water`, `task.spray`,
 *     `task.scout`, `task.protectHarvest`, etc.) so VoiceButton
 *     and the existing prompt bridge keep working — no new
 *     translation keys.
 *   • Output is internal — the farmer-visible label still flows
 *     through `t(task.titleKey)` at render time.
 */

import { deriveWeatherRisk } from './weatherRiskModel.js';
import { derivePestRisk }    from './pestDiseaseRisk.js';
import { resolveStage }      from './cropStageModel.js';
import { forecastYield }     from './yieldForecast.js';
import { getSatelliteSignalsSync } from './satelliteSignals.js';
import { rankCandidates }    from './recommendationRanker.js';
import { scoreConfidence }   from './confidenceScoring.js';

// Canonical task ids used downstream by:
//   • taskEngine prompts (`task.water`, `task.spray`, ...)
//   • voicePrompts.js   (prerecorded Twi clips for the same ids)
//   • recommendationRanker hint matching
const TASK = Object.freeze({
  WATER:           'task.water',
  SPRAY:           'task.spray',
  SCOUT:           'task.scout',
  WEED:            'task.weed',
  PROTECT_HARVEST: 'task.protectHarvest',
  SKIP_WATERING:   'task.skipWatering',
  SKIP_SPRAYING:   'task.skipSpraying',
  CHECK_PESTS:     'task.checkPests',
  CLEAR_FIELD:     'task.clearField',
  PLANT:           'task.plant',
  HARVEST:         'task.harvest',
});

// Stages where a routine scouting candidate is plausible.
const ATTACK_STAGES = new Set(['vegetative', 'flowering', 'fruiting']);

// Lightweight task constructor — keeps the shape consistent with
// what the existing taskEngine emits.
function _task({ id, titleKey, priority = 'normal', stage = null, reason = null }) {
  return Object.freeze({
    id,
    titleKey,
    priority,
    stage,
    reasons: Object.freeze(reason ? [reason] : []),
    source: 'signal-derived',
    kind: 'task',
  });
}

/**
 * Generate candidate tasks from raw signals.
 *
 * @param {object} input
 * @param {object} input.weatherRisk        deriveWeatherRisk output
 * @param {object} input.pestRisk           derivePestRisk output
 * @param {object} input.stageInfo          resolveStage output
 * @param {object} [input.yieldInfo]        forecastYield output
 * @param {object} [input.satellite]        satellite signal
 * @returns {object[]}                      candidate tasks
 */
export function generateCandidatesFromSignals({
  weatherRisk = null,
  pestRisk    = null,
  stageInfo   = null,
  yieldInfo   = null,
  satellite   = null,
} = {}) {
  try {
    const out = [];
    const seen = new Set();   // dedup by titleKey + stage
    const stage = stageInfo?.stage || null;

    const wSig = new Set(weatherRisk?.signals || []);
    const pSig = new Set(pestRisk?.signals    || []);

    function add(task) {
      if (!task) return;
      const dedup = task.titleKey + '|' + (task.stage || '');
      if (seen.has(dedup)) return;
      seen.add(dedup);
      out.push(task);
    }

    // ─── Rule 1 — heavy rain coming / current → protect harvest
    //     when crop is fruiting or harvest-ready, otherwise skip
    //     spraying so farmer doesn't waste the input. ────────
    if (wSig.has('heavy_rain')) {
      if (stage === 'fruiting' || stage === 'harvest') {
        add(_task({
          id: 'sig.protectHarvest',
          titleKey: TASK.PROTECT_HARVEST,
          priority: 'urgent',
          stage,
          reason: 'heavy_rain',
        }));
      }
      add(_task({
        id: 'sig.skipSpraying',
        titleKey: TASK.SKIP_SPRAYING,
        priority: 'important',
        stage,
        reason: 'heavy_rain',
      }));
    }

    // ─── Rule 2 — fungal pressure (wet × flowering/fruiting on
    //     sensitive crops) → spray now. ──────────────────────
    if (pSig.has('fungal_pressure')) {
      add(_task({
        id: 'sig.spray.fungal',
        titleKey: TASK.SPRAY,
        priority: pestRisk?.level === 'high' ? 'urgent' : 'important',
        stage,
        reason: 'fungal_pressure',
      }));
      // Pair with a scout so the farmer verifies the issue.
      add(_task({
        id: 'sig.scout.fungal',
        titleKey: TASK.SCOUT,
        priority: 'important',
        stage,
        reason: 'fungal_pressure',
      }));
    }

    // ─── Rule 3 — mite / aphid pressure (hot-dry stress) ───
    if (pSig.has('mite_aphid_pressure')) {
      add(_task({
        id: 'sig.checkPests',
        titleKey: TASK.CHECK_PESTS,
        priority: 'important',
        stage,
        reason: 'mite_aphid_pressure',
      }));
    }

    // ─── Rule 4 — weed surge (rain × vegetative) ───────────
    if (pSig.has('weed_surge')) {
      add(_task({
        id: 'sig.weed',
        titleKey: TASK.WEED,
        priority: 'important',
        stage,
        reason: 'weed_surge',
      }));
    }

    // ─── Rule 5 — dry / hot stress + vegetative or flowering →
    //     water. Skip when there's heavy rain (already wet). ─
    const dryStress = wSig.has('dry_spell') || wSig.has('hot');
    if (dryStress && !wSig.has('heavy_rain')
        && (stage === 'vegetative' || stage === 'flowering')) {
      add(_task({
        id: 'sig.water',
        titleKey: TASK.WATER,
        priority: 'important',
        stage,
        reason: wSig.has('dry_spell') ? 'dry_spell' : 'hot',
      }));
    }

    // ─── Rule 6 — yield band 'low' → check pests (cause finder).
    //     Already added by Rule 3 if mite/aphid; otherwise this
    //     surfaces a diagnostic nudge. ───────────────────────
    if (yieldInfo?.band === 'low' && !pSig.has('mite_aphid_pressure')) {
      add(_task({
        id: 'sig.diagnostic',
        titleKey: TASK.CHECK_PESTS,
        priority: 'important',
        stage,
        reason: 'low_yield_band',
      }));
    }

    // ─── Rule 7 — weak NDVI (<0.4) at growth stages → visual
    //     scout. Threshold matches yieldForecast's NDVI bands. ─
    const ndvi = Number(satellite?.ndvi);
    if (Number.isFinite(ndvi) && ndvi < 0.4 && ATTACK_STAGES.has(stage)) {
      add(_task({
        id: 'sig.scout.ndvi',
        titleKey: TASK.SCOUT,
        priority: 'important',
        stage,
        reason: 'weak_vegetation',
      }));
    }

    // ─── Rule 8 — stage-specific seeds when nothing else fired
    //     so the farmer always gets *something* to do today.
    //     `planning` / `land_preparation` get setup tasks; growth
    //     stages get a routine scout; harvest gets the obvious
    //     harvest action. ─────────────────────────────────────
    if (out.length === 0 && stage) {
      if (stage === 'planning' || stage === 'land_preparation') {
        add(_task({
          id: 'sig.clearField',
          titleKey: TASK.CLEAR_FIELD,
          priority: 'normal',
          stage,
          reason: 'pre_planting',
        }));
      } else if (stage === 'planting') {
        add(_task({
          id: 'sig.plant',
          titleKey: TASK.PLANT,
          priority: 'important',
          stage,
          reason: 'planting_window',
        }));
      } else if (ATTACK_STAGES.has(stage)) {
        add(_task({
          id: 'sig.routineScout',
          titleKey: TASK.SCOUT,
          priority: 'normal',
          stage,
          reason: 'routine_scout',
        }));
      } else if (stage === 'harvest') {
        add(_task({
          id: 'sig.harvest',
          titleKey: TASK.HARVEST,
          priority: 'urgent',
          stage,
          reason: 'harvest_window',
        }));
      }
    }

    return out;
  } catch {
    return [];
  }
}

/**
 * One-shot generator — runs the full pipeline (resolve signals,
 * generate candidates, rank to 1 primary + 2 secondary, score
 * confidence) and returns the ranked output. This is the new
 * public seam the requirement spec calls "recommendationEngine".
 *
 * Use this when you have a farm + weather but NO pre-existing
 * candidate task list. When you DO have a list (e.g. from
 * `taskEngine.generateTasks()`), prefer `rankFarmIntelligence`
 * which keeps the existing engine's deliberate ordering as the
 * tie-breaker.
 *
 * @param {object} input
 * @param {object} input.farm
 * @param {object} [input.weather]
 * @param {object} [input.satellite]   pre-fetched signal; defaults to mock
 * @returns {{
 *   primary:     object|null,
 *   secondaries: object[],
 *   signals:     object,
 *   confidence:  { level: string, points: number, missing: string[] },
 *   candidates:  object[],
 * }}
 */
export function recommendForFarm({ farm = null, weather = null, satellite = null } = {}) {
  try {
    const safeFarm = farm && typeof farm === 'object' ? farm : null;
    const weatherRisk = deriveWeatherRisk(weather);
    const stageInfo   = resolveStage(safeFarm);
    const pestRisk    = derivePestRisk({
      crop:        safeFarm?.crop,
      stage:       stageInfo?.stage,
      weatherRisk,
    });
    const sat = satellite || getSatelliteSignalsSync({
      lat: _num(safeFarm?.lat ?? safeFarm?.location?.lat),
      lng: _num(safeFarm?.lng ?? safeFarm?.location?.lng),
    });
    const yieldInfo = forecastYield({ farm: safeFarm || {}, signals: sat });

    const candidates = generateCandidatesFromSignals({
      weatherRisk, pestRisk, stageInfo, yieldInfo, satellite: sat,
    });

    const ranked = rankCandidates({
      candidates, weatherRisk, pestRisk, stageInfo, yieldInfo,
    });

    const confidence = scoreConfidence({
      weatherRisk, pestRisk, stageInfo, yieldInfo, satellite: sat,
    });

    return Object.freeze({
      primary:     ranked.primary,
      secondaries: ranked.secondaries,
      signals: Object.freeze({
        weatherRisk, pestRisk, stageInfo, yieldInfo, satellite: sat,
      }),
      confidence,
      candidates: Object.freeze(candidates.slice()),
    });
  } catch {
    return Object.freeze({
      primary:     null,
      secondaries: [],
      signals:     Object.freeze({}),
      confidence:  Object.freeze({ level: 'low', points: 0, missing: ['error'] }),
      candidates:  Object.freeze([]),
    });
  }
}

function _num(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export { TASK as TASK_KEYS };
