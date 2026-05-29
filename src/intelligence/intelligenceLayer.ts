/**
 * src/intelligence/intelligenceLayer.ts — Phase 16 composite.
 *
 *   import {
 *     intelligenceLayer,
 *     installIntelligenceLayerGlobal,
 *     INTELLIGENCE_LAYER_VERSION,
 *   } from 'src/intelligence/intelligenceLayer';
 *
 * What this is
 * ────────────
 *   Composite over the new proactive Intelligence Layer engines.
 *   The keystone is dailyGrowEngine — the "what should I do
 *   today?" answer.
 *
 *   This file lives ALONGSIDE the pre-existing src/intelligence/
 *   index.ts (which barrels the wave-9 recommendation /
 *   data-quality runtime). Strict rule: do not modify existing
 *   modules. So this composite has its own file with no
 *   collision.
 *
 *   QA reads __intelligenceLayer() in the console.
 */

import {
  dailyGrowEngine, DAILY_GROW_ENGINE_VERSION,
} from './dailyGrowEngine';
import {
  deriveGrowthStage, stageTasks, GROWTH_STAGE,
  GROWTH_STAGE_ENGINE_VERSION, GROWTH_STAGE_ORDER,
} from './growthStageEngine';
import {
  adjustTasksForWeather, WEATHER_TASK_ADJUSTER_VERSION,
} from './weatherTaskAdjuster';
import {
  regionalDiseaseCalendar, REGIONAL_DISEASE_CALENDAR_VERSION,
  SEEDED_DISEASE_REGIONS,
} from './regionalDiseaseCalendar';
import {
  pestRiskEngine, PEST_KIND, PEST_RISK_LEVELS, PEST_RISK_VERSION,
} from './pestRiskEngine';
import {
  diseaseForecast, DISEASE_KIND, DISEASE_FORECAST_VERSION,
} from './diseaseForecast';
import {
  soilAdvisor, SOIL_IDEAL, SOIL_ADVISOR_VERSION,
} from './soilAdvisor';
import {
  satelliteIntelligence, SATELLITE_INTELLIGENCE_VERSION,
} from './satelliteIntelligenceGate';
import {
  gardenHealth, GARDEN_HEALTH_VERSION,
  GARDEN_HEALTH_BANDS, GARDEN_HEALTH_WEIGHTS,
} from './gardenHealth';
import {
  smartScanResult, SMART_SCAN_RESULT_VERSION,
} from './smartScanResult';

export const INTELLIGENCE_LAYER_VERSION = 'intelligence-layer-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

export function intelligenceLayer(ctx: any) {
  const c = _isObj(ctx) ? ctx : {};
  const today = _safe(() => dailyGrowEngine(c as any), null);
  return Object.freeze({
    runtimeVersion: INTELLIGENCE_LAYER_VERSION,
    generatedAt:    _now(),
    today,
    versions: Object.freeze({
      dailyGrowEngine:           DAILY_GROW_ENGINE_VERSION,
      growthStageEngine:         GROWTH_STAGE_ENGINE_VERSION,
      weatherTaskAdjuster:       WEATHER_TASK_ADJUSTER_VERSION,
      regionalDiseaseCalendar:   REGIONAL_DISEASE_CALENDAR_VERSION,
      pestRiskEngine:            PEST_RISK_VERSION,
      diseaseForecast:           DISEASE_FORECAST_VERSION,
      soilAdvisor:               SOIL_ADVISOR_VERSION,
      satelliteIntelligence:     SATELLITE_INTELLIGENCE_VERSION,
      gardenHealth:              GARDEN_HEALTH_VERSION,
      smartScanResult:           SMART_SCAN_RESULT_VERSION,
    }),
    seededDiseaseRegions: SEEDED_DISEASE_REGIONS,
    deferred: Object.freeze({
      satelliteBackend:
        'satellite intelligence ships shape only — strict-rule '
        + 'no-real-backend',
      marketBackend:
        'marketplace gated for RC1',
      openMeteoBindings:
        'caller injects weatherForecast; no direct fetch from '
        + 'this layer — strict-rule no-direct-UI-service-calls',
      llmAssistant:
        'deterministic intent router only — no LLM',
      regionCoverage:
        'seeded regions: Maryland, Ghana, India — content-team '
        + 'backlog to expand',
    }),
  });
}

export function installIntelligenceLayerGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__intelligenceLayer === 'function') return true;
    w.__intelligenceLayer = function (innerCtx: any) {
      const out = intelligenceLayer(innerCtx || {});
      try { console.log('[Farroway · Intelligence Layer]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports
export {
  dailyGrowEngine, DAILY_GROW_ENGINE_VERSION,
  deriveGrowthStage, stageTasks, GROWTH_STAGE,
  GROWTH_STAGE_ENGINE_VERSION, GROWTH_STAGE_ORDER,
  adjustTasksForWeather, WEATHER_TASK_ADJUSTER_VERSION,
  regionalDiseaseCalendar, REGIONAL_DISEASE_CALENDAR_VERSION,
  SEEDED_DISEASE_REGIONS,
  pestRiskEngine, PEST_KIND, PEST_RISK_LEVELS, PEST_RISK_VERSION,
  diseaseForecast, DISEASE_KIND, DISEASE_FORECAST_VERSION,
  soilAdvisor, SOIL_IDEAL, SOIL_ADVISOR_VERSION,
  satelliteIntelligence, SATELLITE_INTELLIGENCE_VERSION,
  gardenHealth, GARDEN_HEALTH_VERSION,
  GARDEN_HEALTH_BANDS, GARDEN_HEALTH_WEIGHTS,
  smartScanResult, SMART_SCAN_RESULT_VERSION,
};
