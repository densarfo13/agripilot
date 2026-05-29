/**
 * src/modules/plants/plantProfiles.ts — rich plant profile envelope.
 *
 *   import { plantProfile, PLANT_PROFILE_VERSION }
 *     from 'src/modules/plants/plantProfiles';
 *
 *   plantProfile({ plantId: 'tomato', weather, season });
 *
 * What this is
 * ────────────
 *   The single chokepoint for a plant's "detail page" envelope.
 *   Composes existing engines so any plant — flower, vegetable,
 *   houseplant, tree, herb — returns the same shape:
 *
 *     {
 *       identity:       { id, commonName, scientificName, family,
 *                         category, lifecycle, localNames, image },
 *       care:           { sun, water, droughtResistant, indoor,
 *                         humidity?, wateringIntervalDays? },
 *       bloomForecast:  { confidence, season, etaDays } | null,
 *       pollinator:     { score, attracts, friendly },
 *       companions:     { good, avoid, conflictsInGarden,
 *                         synergyInGarden },
 *       diseases:       { forecasts, topForecast } | null,
 *       growthDays,
 *       autoAddSuggestion: { ready: true, payload },
 *       deferred:       { ... }
 *     }
 *
 *   "Auto-add from scan" is the autoAddSuggestion field — pure
 *   compute that produces a caller-ready payload. Persistence
 *   stays with the wave-5 single-writer (UI + journal store
 *   handle it).
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over findPlant + flowerAdvisor + pollinator
 *     + companion + diseaseForecast.
 *   • No fetch, no persistence writes.
 *   • Honest 'unknown' when input thin.
 */

import { findPlant } from '../../data/plants/index.js';
import { flowerAdvisor }     from '../../runtime/grow/flowerAdvisor';
import { pollinatorScore }   from '../../runtime/grow/pollinatorEngine';
import { companionAdvice }   from '../../runtime/grow/companionEngine';
import { diseaseForecast }   from '../../intelligence/diseaseForecast';

export const PLANT_PROFILE_VERSION = 'plant-profile-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface ProfileCtx {
  plantId?:       string;
  weather?:       any;
  season?:        string;
  haveInGarden?:  string[];
  scanResult?:    any;     // when present → autoAddSuggestion payload
  region?:        string;
  now?:           number;
}

function _identity(plant: any) {
  return Object.freeze({
    id:             _str(plant.id),
    commonName:     _str(plant.commonName) || _str(plant.name),
    scientificName: _str(plant.scientificName),
    family:         _str(plant.family),
    category:       _str(plant.type),
    lifecycle:      _str(plant.lifecycle),
    localNames:     _isObj(plant.localNames)
                      ? Object.freeze({ ...plant.localNames })
                      : Object.freeze({}),
    image:          _str(plant.image),
  });
}

function _care(plant: any) {
  return Object.freeze({
    sun:                  _str(plant.sunlight)  || _str(plant.sun),
    water:                _str(plant.waterNeeds) || _str(plant.water),
    droughtResistant:     !!plant.droughtResistant,
    indoor:               !!plant.indoor || !!plant.indoorFriendly,
    humidity:             _str(plant.humidity),
    wateringIntervalDays: _num(plant.wateringIntervalDays),
    repottingIntervalDays: _num(plant.repottingIntervalDays),
  });
}

function _bloomFromAdvisor(plant: any, weather: any, season: string,
                            now: number | undefined) {
  // flowerAdvisor returns the spec'd bloom forecast; we call it for
  // flowers and herbs (which the existing engine supports too).
  const cat = _str(plant.type);
  if (cat !== 'flower' && cat !== 'herb') {
    // Non-flower categories use the bloomSeason field directly
    const seasons = _arr(plant.bloomSeason).map(_str).filter(Boolean);
    if (seasons.length === 0) return null;
    return Object.freeze({
      season: seasons[0],
      etaDays: null,
      confidence: 'low' as const,
      source: 'plant_db_bloomSeason',
    });
  }
  const adv = flowerAdvisor({
    plantId: _str(plant.id),
    weather, season,
    now,
  } as any);
  if (!_isObj(adv) || !(adv as any).found) return null;
  return Object.freeze({
    ...(adv as any).bloomForecast,
    source: 'flower_advisor',
  });
}

function _pollinator(plant: any) {
  const ps = pollinatorScore({ plantIds: [_str(plant.id)] });
  if (!_isObj(ps)) return Object.freeze({
    score: 0, attracts: Object.freeze([]), friendly: false,
  });
  return Object.freeze({
    score:    _num((ps as any).score) || 0,
    friendly: !!(ps as any).friendly,
    attracts: (ps as any).attracts || Object.freeze([]),
  });
}

function _companions(plant: any, haveInGarden: string[] | undefined) {
  const c = companionAdvice({
    plantId: _str(plant.id),
    haveInGarden,
  } as any);
  if (!_isObj(c)) return null;
  return Object.freeze({
    good:               (c as any).good,
    avoid:              (c as any).avoid,
    conflictsInGarden:  (c as any).conflictsInGarden,
    synergyInGarden:    (c as any).synergyInGarden,
  });
}

function _diseases(plant: any, weather: any) {
  const f = diseaseForecast({
    plantId: _str(plant.id),
    weather,
  } as any);
  if (!_isObj(f)) return null;
  return Object.freeze({
    forecasts:   (f as any).forecasts,
    topForecast: (f as any).topForecast,
  });
}

function _autoAddSuggestion(plant: any, scanResult: any,
                             region: string) {
  if (!_isObj(scanResult)) return null;
  // Caller-ready payload. The actual journal save / today-task
  // add stays with the wave-5 single-writer — this engine just
  // emits the suggestion shape.
  return Object.freeze({
    ready: true,
    payload: Object.freeze({
      plantId:       _str(plant.id),
      commonName:    _str(plant.commonName) || _str(plant.name),
      category:      _str(plant.type),
      scanId:        _str(scanResult.scanId),
      capturedAt:    _str(scanResult.capturedAt)
                      || _str(scanResult.timestamp)
                      || '',
      region,
    }),
  });
}

export function plantProfile(ctx: ProfileCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as ProfileCtx;
    const plant = _str(c.plantId) ? findPlant(c.plantId) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: PLANT_PROFILE_VERSION,
        ok: false, reason: 'no_plant',
        plantId: _str(c.plantId),
      });
    }
    return Object.freeze({
      runtimeVersion:    PLANT_PROFILE_VERSION,
      ok:                true,
      reason:            '',
      identity:          _identity(plant),
      care:              _care(plant),
      growthDays:        _num(plant.growthDays),
      bloomForecast:     _bloomFromAdvisor(plant, c.weather,
                            _str(c.season), _num(c.now) || undefined),
      pollinator:        _pollinator(plant),
      companions:        _companions(plant, c.haveInGarden),
      diseases:          _diseases(plant, c.weather),
      autoAddSuggestion: _autoAddSuggestion(plant, c.scanResult,
                            _str(c.region)),
      deferred: Object.freeze({
        localNamesCoverage:
          'localNames is opt-in per row; content-team backlog to '
          + 'populate the 6 supported locales',
        autoAddPersistence:
          'engine emits autoAddSuggestion.payload only; the journal '
          + 'save + today-task add stay with the wave-5 single-writer',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_PROFILE_VERSION,
    ok: false, reason: 'error',
    plantId: '',
  }));
}
