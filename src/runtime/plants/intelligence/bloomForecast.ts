/**
 * src/runtime/plants/intelligence/bloomForecast.ts —
 * deterministic bloom forecast.
 *
 *   import {
 *     bloomForecast, BLOOM_STATUS, BLOOM_FORECAST_VERSION,
 *   } from 'src/runtime/plants/intelligence/bloomForecast';
 *
 *   bloomForecast({ plantId, season, lifecycleStage })
 *
 * What this is
 * ────────────
 *   Simple deterministic bloom forecast — spec explicitly says
 *   NOT to over-engineer and to use safe wording. Returns:
 *
 *     {
 *       status: 'not_ready' | 'budding' | 'blooming' | 'post_bloom' | 'unknown',
 *       estimatedDaysToBloom: number | null,
 *       confidence: 'low' | 'medium' | 'high' | 'unknown',
 *       safeWording: 'Expected bloom window'  ← never "guaranteed"
 *     }
 *
 *   Composes plant DB bloomSeason + caller-supplied season +
 *   lifecycle stage. No LLM, no probabilistic model.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • Safe wording — never claims precision.
 */

import { findPlant } from '../../../data/plants/index.js';

export const BLOOM_FORECAST_VERSION = 'bloom-forecast-v1';

export const BLOOM_STATUS = Object.freeze({
  NOT_READY:  'not_ready',
  BUDDING:    'budding',
  BLOOMING:   'blooming',
  POST_BLOOM: 'post_bloom',
  UNKNOWN:    'unknown',
});

const SAFE_WORDING = 'Expected bloom window';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const SEASON_ORDER = ['winter', 'early_spring', 'spring',
                       'late_spring', 'early_summer', 'summer',
                       'late_summer', 'autumn'];

function _nearestSeasonGap(currentSeason: string,
                            targetSeasons: string[]): number | null {
  if (!currentSeason || targetSeasons.length === 0) return null;
  const cur = SEASON_ORDER.indexOf(currentSeason);
  if (cur === -1) return null;
  let minGap = Number.POSITIVE_INFINITY;
  for (const t of targetSeasons) {
    const ti = SEASON_ORDER.indexOf(t);
    if (ti === -1) continue;
    const fwd = (ti - cur + SEASON_ORDER.length) % SEASON_ORDER.length;
    if (fwd < minGap) minGap = fwd;
  }
  if (!Number.isFinite(minGap)) return null;
  // Each "season bucket" is ~45 days
  return Math.round(minGap * 45);
}

interface BloomCtx {
  plantId?:        string;
  season?:         string;          // current season
  lifecycleStage?: string;
  weather?:        any;
}

export function bloomForecast(ctx: BloomCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as BloomCtx;
    const id    = _str(c.plantId);
    const plant = id ? findPlant(id) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: BLOOM_FORECAST_VERSION,
        ok: false, reason: 'plant_not_in_db',
        plantId: id,
        status: BLOOM_STATUS.UNKNOWN,
        estimatedDaysToBloom: null,
        confidence: 'unknown' as const,
        safeWording: SAFE_WORDING,
      });
    }
    const bloomSeasons = _arr((plant as any).bloomSeason).map(_str);
    if (bloomSeasons.length === 0) {
      return Object.freeze({
        runtimeVersion: BLOOM_FORECAST_VERSION,
        ok: true, reason: '',
        plantId: id,
        status: BLOOM_STATUS.UNKNOWN,
        estimatedDaysToBloom: null,
        confidence: 'unknown' as const,
        safeWording: SAFE_WORDING,
      });
    }

    const stage  = _str(c.lifecycleStage);
    const season = _str(c.season).toLowerCase();

    // Lifecycle takes precedence over season
    if (stage === 'flowering') {
      return Object.freeze({
        runtimeVersion: BLOOM_FORECAST_VERSION,
        ok: true, reason: '',
        plantId: id,
        status: BLOOM_STATUS.BLOOMING,
        estimatedDaysToBloom: 0,
        confidence: 'high' as const,
        safeWording: SAFE_WORDING,
      });
    }
    if (stage === 'fruiting' || stage === 'harvest') {
      return Object.freeze({
        runtimeVersion: BLOOM_FORECAST_VERSION,
        ok: true, reason: '',
        plantId: id,
        status: BLOOM_STATUS.POST_BLOOM,
        estimatedDaysToBloom: null,
        confidence: 'high' as const,
        safeWording: SAFE_WORDING,
      });
    }

    if (season && bloomSeasons.indexOf(season) !== -1) {
      // In a bloom season but not at flowering stage yet → budding
      return Object.freeze({
        runtimeVersion: BLOOM_FORECAST_VERSION,
        ok: true, reason: '',
        plantId: id,
        status: BLOOM_STATUS.BUDDING,
        estimatedDaysToBloom: 14,
        confidence: 'medium' as const,
        safeWording: SAFE_WORDING,
      });
    }

    const gapDays = _nearestSeasonGap(season, bloomSeasons);
    if (gapDays == null) {
      return Object.freeze({
        runtimeVersion: BLOOM_FORECAST_VERSION,
        ok: true, reason: '',
        plantId: id,
        status: BLOOM_STATUS.NOT_READY,
        estimatedDaysToBloom: null,
        confidence: 'low' as const,
        safeWording: SAFE_WORDING,
      });
    }
    return Object.freeze({
      runtimeVersion: BLOOM_FORECAST_VERSION,
      ok: true, reason: '',
      plantId: id,
      status: BLOOM_STATUS.NOT_READY,
      estimatedDaysToBloom: gapDays,
      confidence: gapDays <= 45 ? 'medium' as const : 'low' as const,
      safeWording: SAFE_WORDING,
    });
  }, Object.freeze({
    runtimeVersion: BLOOM_FORECAST_VERSION,
    ok: false, reason: 'error',
    plantId: '',
    status: BLOOM_STATUS.UNKNOWN,
    estimatedDaysToBloom: null,
    confidence: 'unknown' as const,
    safeWording: SAFE_WORDING,
  }));
}
