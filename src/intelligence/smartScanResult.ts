/**
 * src/intelligence/smartScanResult.ts — scan envelope enhancer.
 *
 *   import { smartScanResult, SMART_SCAN_RESULT_VERSION }
 *     from 'src/intelligence/smartScanResult';
 *
 *   smartScanResult({ scanResult, weather, region })
 *
 * What this is
 * ────────────
 *   Layered on top of the wave-1 scan envelope. Composes a
 *   richer "smart" envelope using engines already shipped:
 *
 *     plant identified         (wave-1 scan)
 *     + health score           (caller-supplied or null)
 *     + water recommendation   (plant DB)
 *     + disease analysis       (diseaseForecast)
 *     + companion plants       (companionEngine)
 *     + pollinator value       (pollinatorEngine)
 *     + market value           (gated null envelope)
 *
 *   Does NOT mutate the input scanResult — returns a new frozen
 *   envelope.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • Market value gated — no marketplace.
 */

import { findPlant } from '../data/plants/index.js';
import { tagScanWithGrowType } from '../runtime/grow/scanGrowType.js';
import { companionAdvice } from '../runtime/grow/companionEngine';
import { pollinatorScore } from '../runtime/grow/pollinatorEngine';
import { diseaseForecast } from './diseaseForecast';

export const SMART_SCAN_RESULT_VERSION = 'smart-scan-result-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface SmartScanCtx {
  scanResult?: any;
  scanPlantHint?: string;
  weather?: any;
  region?: string;
  haveInGarden?: string[];
  healthScore?: number;   // 0-100, caller-supplied (e.g. from classifier)
}

function _waterRecommendation(plant: any) {
  if (!_isObj(plant)) return null;
  const w = _str(plant.water).toLowerCase();
  if (!w) return null;
  return Object.freeze({
    band: w,
    labelKey: 'grow.scan.water.' + w,
    labelDefault: w === 'high'   ? 'Water generously and often.'
               : w === 'medium' ? 'Water when the top inch of soil is dry.'
               : w === 'low'    ? 'Water sparingly — do not overwater.'
                                 : 'Match watering to plant needs.',
  });
}

function _marketValueGated() {
  return Object.freeze({
    ok: false, reason: 'marketplace_gated',
    listingHint: '',
    deferred: Object.freeze({
      marketplaceBackend:
        'marketplace gated for RC1 (wave-8 App Store safety mode + '
        + 'strict-rule no-marketplace); market value envelope shows '
        + 'shape only',
    }),
  });
}

export function smartScanResult(ctx: SmartScanCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as SmartScanCtx;
    const tagged = tagScanWithGrowType({
      scanResult: c.scanResult, plantHint: c.scanPlantHint,
    });
    const pid    = _str(tagged && (tagged as any).plantId);
    const plant  = pid ? findPlant(pid) : null;

    const water = _waterRecommendation(plant);
    const disease = _safe(() => diseaseForecast({
      plantId: pid, weather: c.weather,
    }), null);
    const companions = _safe(() => companionAdvice({
      plantId: pid,
      haveInGarden: _arr(c.haveInGarden).map(_str),
    }), null);
    const pollinator = _safe(() => pollinatorScore({
      plantIds: [pid].filter(Boolean) as string[],
    }), null);
    const marketValue = _marketValueGated();

    return Object.freeze({
      runtimeVersion: SMART_SCAN_RESULT_VERSION,
      base:           Object.freeze(tagged),
      plantId:        pid,
      plantName:      plant ? _str(plant.name) : '',
      growType:       _str((tagged as any).growType) || 'unknown',
      healthScore:    _num(c.healthScore),
      waterRecommendation: water,
      diseaseAnalysis: disease,
      companionPlants: companions,
      pollinatorValue: pollinator,
      marketValue,
      deferred: Object.freeze({
        healthScore:
          'healthScore is caller-supplied (e.g. from classifier '
          + 'confidence) — Phase 7 honest-unknown when missing',
      }),
    });
  }, Object.freeze({
    runtimeVersion: SMART_SCAN_RESULT_VERSION,
    base:        Object.freeze({}),
    plantId: '', plantName: '', growType: 'unknown',
    healthScore: null,
    waterRecommendation: null,
    diseaseAnalysis: null,
    companionPlants: null,
    pollinatorValue: null,
    marketValue: Object.freeze({ ok: false, reason: 'error' }),
  }));
}
