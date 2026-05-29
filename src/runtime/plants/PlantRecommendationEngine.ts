/**
 * src/runtime/plants/PlantRecommendationEngine.ts — per-plant
 * recommendations.
 *
 *   import {
 *     recommendForManagedPlant, PLANT_RECOMMENDATION_VERSION,
 *   } from 'src/runtime/plants/PlantRecommendationEngine';
 *
 *   recommendForManagedPlant(plant, { weather, haveInGarden, season })
 *
 * What this is
 * ────────────
 *   Composes per-plant recommendation signals into a single
 *   frozen envelope:
 *
 *     {
 *       companions:   { good, avoid, conflictsInGarden, synergyInGarden },
 *       pollinator:   { score, friendly, attracts },
 *       diseaseRisks: { forecasts, topForecast },
 *       pestRisks:    { risks, topRisk },
 *       bloomForecast: { season, etaDays, confidence } | null,
 *       suggestedActions: [
 *         { kind, urgency, labelKey, labelDefault }
 *       ],
 *     }
 *
 *   Suggested actions are derived deterministically from the
 *   composed signals — never from an LLM. The catalog's
 *   PlantKnowledgeEngine is the source of truth for the raw
 *   signals; this runtime engine adds the "what should we
 *   suggest to the user" ranking.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over PlantKnowledgeEngine.
 *   • No LLM. No fetch.
 *   • Frozen envelopes.
 */

import {
  getPlantKnowledge,
} from '../../modules/plants/PlantKnowledgeEngine';
import {
  ManagedPlant,
} from './PlantRuntime';

export const PLANT_RECOMMENDATION_VERSION = 'plant-recommendation-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface RecCtx {
  plantId?:      string;
  weather?:      any;
  season?:       string;
  region?:       string;
  haveInGarden?: string[];
  now?:          number;
}

function _resolveCatalogId(plant: ManagedPlant, ctx: RecCtx): string {
  if (_str(ctx.plantId)) return _str(ctx.plantId);
  return _str(plant.commonName).toLowerCase().replace(/\s+/g, '_');
}

function _deriveActions(knowledge: any): any[] {
  if (!_isObj(knowledge) || !knowledge.ok) return [];
  const actions: any[] = [];
  const diseaseTop = knowledge.diseaseRisks
    && knowledge.diseaseRisks.topForecast;
  if (_isObj(diseaseTop)) {
    const prob = _num(diseaseTop.probability) || 0;
    if (prob >= 0.4) actions.push(Object.freeze({
      kind: 'disease_watch',
      urgency: prob >= 0.7 ? 'high' : 'medium',
      subject: _str(diseaseTop.disease),
      labelKey: 'plant.rec.diseaseWatch',
      labelDefault: prob >= 0.7
        ? 'Watch closely for ' + diseaseTop.disease + ' — high risk.'
        : 'Inspect leaves for ' + diseaseTop.disease + ' this week.',
    }));
  }
  const pestTop = knowledge.pestRisks && knowledge.pestRisks.topRisk;
  if (_isObj(pestTop)) {
    if (pestTop.risk === 'high' || pestTop.risk === 'medium') {
      actions.push(Object.freeze({
        kind: 'pest_watch',
        urgency: pestTop.risk === 'high' ? 'high' : 'medium',
        subject: _str(pestTop.pest),
        labelKey: 'plant.rec.pestWatch',
        labelDefault: pestTop.risk === 'high'
          ? 'Inspect for ' + pestTop.pest + ' — outbreak likely.'
          : 'Watch for ' + pestTop.pest + '.',
      }));
    }
  }
  const pollinator = knowledge.pollinator;
  if (_isObj(pollinator) && pollinator.friendly) {
    actions.push(Object.freeze({
      kind: 'pollinator_support',
      urgency: 'low',
      labelKey: 'plant.rec.pollinatorSupport',
      labelDefault:
        'Avoid sprays while pollinators visit — this plant is '
        + 'pollinator-friendly.',
    }));
  }
  const companions = knowledge.companions;
  if (_isObj(companions) && _arr(companions.conflictsInGarden).length > 0) {
    actions.push(Object.freeze({
      kind: 'companion_conflict',
      urgency: 'low',
      labelKey: 'plant.rec.companionConflict',
      labelDefault: 'Check spacing — some neighbors conflict.',
      plants: companions.conflictsInGarden,
    }));
  } else if (_isObj(companions) && _arr(companions.synergyInGarden).length > 0) {
    actions.push(Object.freeze({
      kind: 'companion_synergy',
      urgency: 'low',
      labelKey: 'plant.rec.companionSynergy',
      labelDefault: 'Companion synergy detected — keep this layout.',
      plants: companions.synergyInGarden,
    }));
  }
  const bloom = knowledge.bloomForecast;
  if (_isObj(bloom) && _str(bloom.confidence) === 'high') {
    actions.push(Object.freeze({
      kind: 'bloom_window',
      urgency: 'low',
      labelKey: 'plant.rec.bloomWindow',
      labelDefault: 'Bloom window is open — enjoy and protect.',
    }));
  }
  return actions;
}

export function recommendForManagedPlant(plant: ManagedPlant,
                                            ctx: RecCtx) {
  return _safe(() => {
    if (!_isObj(plant)) return Object.freeze({
      runtimeVersion: PLANT_RECOMMENDATION_VERSION,
      ok: false, reason: 'no_plant',
    });
    const c     = _isObj(ctx) ? ctx : {} as RecCtx;
    const pid   = _resolveCatalogId(plant, c);
    const know  = getPlantKnowledge({
      plantId:      pid,
      weather:      c.weather,
      season:       c.season,
      haveInGarden: c.haveInGarden,
      region:       c.region,
      now:          c.now,
    } as any);
    const actions = _deriveActions(know);
    return Object.freeze({
      runtimeVersion:    PLANT_RECOMMENDATION_VERSION,
      ok:                _isObj(know) && !!(know as any).ok,
      reason:            _str((know as any).reason),
      companions:        (know as any).companions,
      pollinator:        (know as any).pollinator,
      diseaseRisks:      (know as any).diseaseRisks,
      pestRisks:         (know as any).pestRisks,
      bloomForecast:     (know as any).bloomForecast,
      suggestedActions:  Object.freeze(actions),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_RECOMMENDATION_VERSION,
    ok: false, reason: 'error',
    suggestedActions: Object.freeze([]),
  }));
}
