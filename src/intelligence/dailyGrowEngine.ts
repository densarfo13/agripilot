/**
 * src/intelligence/dailyGrowEngine.ts — proactive Today engine.
 *
 *   import {
 *     dailyGrowEngine, DAILY_GROW_ENGINE_VERSION,
 *   } from 'src/intelligence/dailyGrowEngine';
 *
 *   dailyGrowEngine({
 *     growType, plantType, plantId, weather, location, growthStage,
 *     soilData, scanResults, recentScans, region, country,
 *     plantedAt, growthDays, lastWateredAt, lastFertilizedAt,
 *     lastRepottedAt, ambient, plantsInGarden, haveInGarden,
 *   })
 *
 * What this is
 * ────────────
 *   The keystone proactive engine. The user shouldn't have to
 *   wonder "what should I do today?" — this engine composes
 *   every Phase-1..14 sub-engine into one frozen envelope:
 *
 *     {
 *       todayTasks:      [...],
 *       warnings:        [...],
 *       opportunities:   [...],
 *       recommendations: [...],
 *       perPlantBriefing: ... | null,
 *       runtimeVersion,
 *     }
 *
 *   Behaviour mapping the user's spec sketch:
 *     "🌹 Roses blooming this week"          → opportunities
 *     "⚠ Aphid risk"                          → warnings (pest)
 *     "🌧 Rain tomorrow"                      → warnings (weather)
 *     "🐝 Pollinator score improved"          → opportunities
 *     "💰 Market opportunity detected"        → opportunities (gated)
 *     "Today · 3 Tasks Due"                   → todayTasks
 *
 *   Plant-type branches:
 *     flower      → flowerAdvisor + bloomForecast
 *     houseplant  → composeIndoorCare
 *     crop|vegetable|fruit → wave-10 + crop-style tasks
 *     herb        → flowerAdvisor share + companion focus
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — does NOT modify any prior engine.
 *   • Wave-5 single-writer invariant preserved.
 *   • All copy via tSafe envelopes (key + default).
 *   • Honest named-deferred for satellite / market / etc.
 */

import { findPlant } from '../data/plants/index.js';
import { flowerAdvisor }    from '../runtime/grow/flowerAdvisor';
import { companionAdvice, suggestCompanionsForGarden }
  from '../runtime/grow/companionEngine';
import { pollinatorScore }  from '../runtime/grow/pollinatorEngine';
import { composeIndoorCare } from '../runtime/grow/indoorPlantCare.js';
import { resolveGardenMode } from '../runtime/grow/gardenMode.js';
import { deriveGrowthStage, GROWTH_STAGE }
  from './growthStageEngine';
import { adjustTasksForWeather } from './weatherTaskAdjuster';
import { regionalDiseaseCalendar } from './regionalDiseaseCalendar';
import { pestRiskEngine }    from './pestRiskEngine';
import { diseaseForecast }   from './diseaseForecast';
import { soilAdvisor }       from './soilAdvisor';
import { gardenHealth }      from './gardenHealth';
import { satelliteIntelligence } from './satelliteIntelligenceGate';
import { smartScanResult }   from './smartScanResult';

export const DAILY_GROW_ENGINE_VERSION = 'daily-grow-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

interface DailyGrowCtx {
  now?: number;
  growType?: string;
  plantType?: string;
  plantId?: string;
  plantedAt?: string;
  growthDays?: number;
  growthStage?: { stage?: string };
  weather?: any;
  weatherForecast?: any;
  location?: any;
  region?: string;
  country?: string;
  state?: string;
  district?: string;
  soilData?: any;
  scanResults?: any;
  recentScans?: any[];
  lastWateredAt?: string;
  lastFertilizedAt?: string;
  lastRepottedAt?: string;
  ambient?: any;
  plantsInGarden?: any[];
  haveInGarden?: string[];
  plantHealthScores?: number[];
  wateringCompliance?: number;
  growthRate?: number;
  marketOpportunity?: { reason?: string; ungatedFlag?: boolean };
  satelliteInputs?: any;
}

function _perPlantTasks(c: DailyGrowCtx, plant: any, stage: any) {
  const tasks: any[] = [];
  if (!plant) return tasks;
  const growType = _str(c.growType) || _str(plant.type);

  if (growType === 'flower' || growType === 'herb'
      || _str(plant.type) === 'flower'
      || _str(plant.type) === 'herb') {
    const adv = flowerAdvisor({
      plantId: _str(plant.id), weather: c.weather,
      season: _str(c.region),
      lastWateredAt: c.lastWateredAt,
      lastFertilizedAt: c.lastFertilizedAt,
      now: c.now,
    });
    for (const t of _arr((adv as any).todayTasks)) tasks.push(t);
  } else if (growType === 'houseplant'
          || _str(plant.type) === 'houseplant') {
    const care = composeIndoorCare({
      plantId: _str(plant.id),
      lastWateredAt: c.lastWateredAt,
      lastRepottedAt: c.lastRepottedAt,
      ambient: c.ambient,
      now: c.now,
    });
    for (const t of _arr((care as any).tasks)) tasks.push(t);
  } else {
    // crop / vegetable / fruit — use simple watering + stage hint
    tasks.push(Object.freeze({
      kind: 'check_plant', priority: 2,
      labelKey: 'grow.daily.task.checkPlant',
      labelDefault: 'Check on plant — note any changes.',
    }));
  }

  // Stage-derived tasks
  for (const t of _arr(stage && stage.stageTasks)) tasks.push(t);

  return tasks;
}

function _warningsFromForecasts(disease: any, pest: any) {
  const warnings: any[] = [];
  if (_isObj(disease) && Array.isArray(disease.forecasts)) {
    for (const f of disease.forecasts) {
      if (!_isObj(f)) continue;
      const sev = _str(f.severity);
      if (sev === 'high' || sev === 'medium') {
        warnings.push(Object.freeze({
          kind: 'disease_risk',
          severity: sev,
          subject: _str(f.disease),
          confidence: Math.round((f.probability as number) * 100),
          labelKey: 'grow.daily.warning.disease',
          labelDefault: sev === 'high'
            ? 'High ' + f.disease + ' risk this week.'
            : 'Watch for ' + f.disease + ' over the next few days.',
        }));
      }
    }
  }
  if (_isObj(pest) && Array.isArray(pest.risks)) {
    for (const r of pest.risks) {
      if (!_isObj(r)) continue;
      if (r.risk === 'high' || r.risk === 'medium') {
        warnings.push(Object.freeze({
          kind: 'pest_risk',
          severity: _str(r.risk),
          subject: _str(r.pest),
          confidence: _num(r.confidence) || 0,
          labelKey: 'grow.daily.warning.pest',
          labelDefault: r.risk === 'high'
            ? 'High ' + r.pest + ' outbreak risk.'
            : 'Watch for ' + r.pest + '.',
        }));
      }
    }
  }
  return warnings;
}

function _warningsFromWeather(weatherAdjust: any) {
  const warnings: any[] = [];
  const sig = (_isObj(weatherAdjust) && weatherAdjust.signals) || {};
  if (sig.heavyRain) warnings.push(Object.freeze({
    kind: 'weather', severity: 'medium', subject: 'heavy_rain',
    labelKey: 'grow.daily.warning.heavyRain',
    labelDefault: 'Heavy rain expected.',
  }));
  if (sig.heatWave) warnings.push(Object.freeze({
    kind: 'weather', severity: 'high', subject: 'heat_wave',
    labelKey: 'grow.daily.warning.heatWave',
    labelDefault: 'Heat wave approaching.',
  }));
  if (sig.frost) warnings.push(Object.freeze({
    kind: 'weather', severity: 'high', subject: 'frost',
    labelKey: 'grow.daily.warning.frost',
    labelDefault: 'Frost expected — cover sensitive plants.',
  }));
  return warnings;
}

function _opportunitiesFromPollinator(p: any) {
  if (!_isObj(p) || !p.friendly) return [];
  return [Object.freeze({
    kind: 'pollinator_friendly',
    score: _num(p.score) || 0,
    labelKey: 'grow.daily.opp.pollinator',
    labelDefault: 'Pollinator-friendly garden today — keep it up.',
  })];
}

function _opportunitiesFromBloom(adv: any) {
  if (!_isObj(adv)) return [];
  const bf = _isObj(adv.bloomForecast) ? adv.bloomForecast : null;
  if (!bf) return [];
  if (bf.confidence !== 'high') return [];
  return [Object.freeze({
    kind: 'blooming_soon',
    season: _str(bf.season),
    labelKey: 'grow.daily.opp.blooming',
    labelDefault: 'Blooming this week.',
  })];
}

function _opportunitiesFromCompanions(suggest: any) {
  if (!_isObj(suggest)) return [];
  const list = _arr(suggest.suggestions);
  if (list.length === 0) return [];
  return [Object.freeze({
    kind: 'companion_suggestion',
    suggestionCount: list.length,
    top: _str(list[0] && list[0].name),
    labelKey: 'grow.daily.opp.companion',
    labelDefault: 'A companion plant would strengthen your garden.',
  })];
}

function _opportunitiesFromMarket(c: DailyGrowCtx) {
  const m = _isObj(c.marketOpportunity) ? c.marketOpportunity : null;
  if (!m || !m.ungatedFlag) return [];
  return [Object.freeze({
    kind: 'market_opportunity',
    subject: _str(m.reason),
    labelKey: 'grow.daily.opp.market',
    labelDefault: 'Market opportunity detected.',
  })];
}

export function dailyGrowEngine(ctx: DailyGrowCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as DailyGrowCtx;
    const plantId = _str(c.plantId) || _str(c.plantType);
    const plant   = plantId ? findPlant(plantId) : null;

    // 1. Stage
    const stage = deriveGrowthStage({
      plantedAt: c.plantedAt, growthDays: c.growthDays,
      growType:  _str(c.growType),
      wave10Stage: c.growthStage as any,
      now: c.now,
    });

    // 2. Per-plant base tasks (already weather-aware via sub-engines)
    let baseTasks = _perPlantTasks(c, plant, stage);

    // 3. Weather-driven cancel/add layer
    const weatherAdjust = adjustTasksForWeather({
      tasks: baseTasks,
      weatherForecast: c.weatherForecast || c.weather,
      growType: _str(c.growType),
    });
    let mergedTasks = _arr((weatherAdjust as any).kept)
                       .concat(_arr((weatherAdjust as any).added));

    // 4. Forecasts → warnings
    const disease = diseaseForecast({
      plantId, weather: c.weather,
    });
    const pest = pestRiskEngine({
      plantId, weather: c.weather,
      recentScans: c.recentScans,
      regionLabel: c.region, now: c.now,
    });
    const calendar = regionalDiseaseCalendar({
      country: _str(c.country) || _str(c.region),
      state: c.state, district: c.district,
      plantId, now: c.now,
    });

    const warnings = ([] as any[])
      .concat(_warningsFromForecasts(disease, pest))
      .concat(_warningsFromWeather(weatherAdjust));

    // Calendar-active diseases → warnings
    for (const a of _arr((calendar as any).active)) {
      if (!_isObj(a)) continue;
      if (a.severity === 'high' || a.severity === 'medium') {
        warnings.push(Object.freeze({
          kind: 'regional_calendar',
          severity: _str(a.severity),
          subject:  _str(a.disease),
          labelKey: 'grow.daily.warning.regionalCalendar',
          labelDefault: _str(a.disease) + ' active in '
            + _str((calendar as any).country) + ' this month.',
        }));
      }
    }

    // 5. Opportunities
    const pollinator = pollinatorScore({
      plantIds: _arr(c.plantsInGarden).map((p) =>
        _isObj(p) ? _str(p.id) : _str(p)),
    });
    const flowerAdv = (plant && _str(plant.type) === 'flower')
      ? flowerAdvisor({
          plantId: _str(plant.id), weather: c.weather,
          season: _str(c.region),
          lastWateredAt: c.lastWateredAt,
          lastFertilizedAt: c.lastFertilizedAt,
          now: c.now,
        })
      : null;
    const companionSuggest = suggestCompanionsForGarden(
      _arr(c.plantsInGarden).map((p) =>
        _isObj(p) ? _str(p.id) : _str(p))
    );

    const opportunities = ([] as any[])
      .concat(_opportunitiesFromPollinator(pollinator))
      .concat(_opportunitiesFromBloom(flowerAdv))
      .concat(_opportunitiesFromCompanions(companionSuggest))
      .concat(_opportunitiesFromMarket(c));

    // 6. Recommendations — soil + companion + scan
    const soil = soilAdvisor(_isObj(c.soilData) ? c.soilData : {});
    const companions = companionAdvice({
      plantId, haveInGarden: c.haveInGarden,
    });
    const smartScan = c.scanResults ? smartScanResult({
      scanResult: c.scanResults,
      weather: c.weather, region: c.region,
      haveInGarden: c.haveInGarden,
    }) : null;

    const recommendations: any[] = [];
    for (const r of _arr((soil as any).recommendations)) recommendations.push(r);
    if (_isObj(companions) && _arr((companions as any).conflictsInGarden).length > 0) {
      recommendations.push(Object.freeze({
        kind: 'companion_conflict',
        urgency: 'low',
        labelKey: 'grow.daily.rec.companionConflict',
        labelDefault: 'Avoid planting these together — incompatibility.',
        plants: Object.freeze((companions as any).conflictsInGarden),
      }));
    }

    // 7. Garden health composite (caller passes plant-health + compliance)
    const garden = gardenHealth({
      plantHealthScores: c.plantHealthScores,
      diseaseForecast: disease,
      wateringCompliance: c.wateringCompliance,
      growthRate: c.growthRate,
    });
    const sat = satelliteIntelligence(_isObj(c.satelliteInputs) ? c.satelliteInputs : {});
    const gardenMode = resolveGardenMode({ growType: _str(c.growType) });

    // 8. Cap tasks at 7 for sanity — priority sort first
    mergedTasks = mergedTasks
      .filter(_isObj)
      .sort((a: any, b: any) =>
        ((_num(a.priority) || 9) - (_num(b.priority) || 9)));
    const todayTasks = mergedTasks.slice(0, 7);

    return Object.freeze({
      runtimeVersion: DAILY_GROW_ENGINE_VERSION,
      generatedAt:    _now(),
      growType:       _str(c.growType) || 'crop',
      plantId,
      plantName:      plant ? _str(plant.name) : '',
      stage:          (stage as any).stage,
      gardenMode:     (gardenMode as any).mode,
      todayTasks:        Object.freeze(todayTasks),
      cancelledTasks:    Object.freeze(_arr((weatherAdjust as any).cancelled)),
      warnings:          Object.freeze(warnings),
      opportunities:     Object.freeze(opportunities),
      recommendations:   Object.freeze(recommendations),
      sources: Object.freeze({
        stage, weatherAdjust, disease, pest, calendar,
        pollinator, flowerAdv, companions, companionSuggest,
        soil, smartScan, garden, satellite: sat,
      }),
      deferred: Object.freeze({
        satelliteBackend:
          'satellite intelligence returns null envelope until '
          + 'satellite pipeline matures (strict-rule: no real backend)',
        marketBackend:
          'market opportunity gated until marketplace ships',
        llmAssistant:
          'no LLM-backed natural-language summary — Today envelope '
          + 'is composed deterministically from the engines above',
        openMeteoBindings:
          'caller injects weatherForecast; no direct fetch from this '
          + 'engine (strict-rule: no direct UI service calls)',
      }),
    });
  }, Object.freeze({
    runtimeVersion: DAILY_GROW_ENGINE_VERSION,
    generatedAt: '', growType: 'crop',
    plantId: '', plantName: '',
    stage: 'unknown', gardenMode: 'farm',
    todayTasks: Object.freeze([]),
    cancelledTasks: Object.freeze([]),
    warnings: Object.freeze([]),
    opportunities: Object.freeze([]),
    recommendations: Object.freeze([]),
    sources: Object.freeze({}),
    deferred: Object.freeze({}),
  }));
}

export { GROWTH_STAGE };
