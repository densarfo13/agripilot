/**
 * src/intelligence/satelliteIntelligenceGate.ts — gated
 * satellite intelligence envelope.
 *
 *   import {
 *     satelliteIntelligence, SATELLITE_INTELLIGENCE_VERSION,
 *   } from 'src/intelligence/satelliteIntelligenceGate';
 *
 * Why this is a GATE
 * ──────────────────
 *   The standing strict-rule says DO NOT build satellite
 *   intelligence (no real backend). The server has a wave-1
 *   satellite proxy for Sentinel Hub NDVI — but the client side
 *   has never had a satellite engine, and the spec's outputs
 *   (NDVI / Moisture / Heat Stress / Farm Health Score) require
 *   processed data this engine cannot produce alone.
 *
 *   This engine ships the SHAPE only:
 *     {
 *       ok, reason, ndvi, moisture, heatStress, farmHealthScore,
 *       deferred,
 *     }
 *   Returns ok:false / reason:'satellite_backend_required' by
 *   default. When the server-side satellite pipeline matures
 *   and the caller passes ungatedFlag:true with values, the
 *   engine clamps and surfaces them through this stable shape.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Default-gated CLOSED.
 *   • No fetch.
 */

export const SATELLITE_INTELLIGENCE_VERSION = 'satellite-intelligence-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface SatelliteCtx {
  ungatedFlag?: boolean;
  ndvi?: number;
  moisture?: number;
  heatStress?: number;
  farmHealthScore?: number;
}

function _nullEnvelope(reason: string) {
  return Object.freeze({
    runtimeVersion: SATELLITE_INTELLIGENCE_VERSION,
    ok: false, reason,
    ndvi: null, moisture: null, heatStress: null,
    farmHealthScore: null,
    deferred: Object.freeze({
      satelliteBackend:
        'wave-1 server satellite proxy exists but client side has '
        + 'no NDVI / moisture / heat-stress processing — gated until '
        + 'the satellite pipeline matures',
      farmHealthScoreSource:
        'farmHealthScore on the satellite envelope is a DIFFERENT '
        + 'signal from the wave-10 farmHealthScore engine — when the '
        + 'satellite pipeline lands it will compose them',
    }),
  });
}

export function satelliteIntelligence(ctx: SatelliteCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as SatelliteCtx;
    if (!c.ungatedFlag) return _nullEnvelope('satellite_backend_required');

    const ndvi       = _num(c.ndvi);
    const moisture   = _num(c.moisture);
    const heatStress = _num(c.heatStress);
    const score      = _num(c.farmHealthScore);

    if (ndvi == null && moisture == null
        && heatStress == null && score == null) {
      return _nullEnvelope('no_inputs');
    }

    return Object.freeze({
      runtimeVersion: SATELLITE_INTELLIGENCE_VERSION,
      ok: true, reason: 'ungated_dev',
      ndvi:       ndvi != null ? _clamp(ndvi, -1, 1) : null,
      moisture:   moisture != null ? _clamp(moisture, 0, 1) : null,
      heatStress: heatStress != null ? _clamp(heatStress, 0, 1) : null,
      farmHealthScore: score != null ? _clamp(score, 0, 100) : null,
    });
  }, _nullEnvelope('error'));
}
