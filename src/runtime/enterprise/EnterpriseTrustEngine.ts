/**
 * src/runtime/enterprise/EnterpriseTrustEngine.ts — three trust
 * surfaces (farmer / farm / program).
 *
 *   import {
 *     farmerTrustScore, farmTrustScore, programTrustScore,
 *     trustSummary, ENTERPRISE_TRUST_VERSION,
 *   } from 'src/runtime/enterprise/EnterpriseTrustEngine';
 *
 * What this is
 * ────────────
 *   Honest trust signals — NEVER a credit score. Spec wording is
 *   strictly "trust signal" and the 4 bands are excellent / good
 *   / needs_attention / high_risk. Composes the existing
 *   farmerTrustEngine (data flywheel) and adds farm + program
 *   trust as new compositions.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • No fetch / no LLM.
 *   • Safe wording — never implies lending eligibility.
 */

import {
  TRUST_TYPES, TRUST_BANDS, trustBandFor,
} from './enterpriseContracts';
import {
  composeFarmerTrust,
} from '../flywheel/farmerTrustEngine.js';

export const ENTERPRISE_TRUST_VERSION = 'enterprise-trust-v1';

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

interface FarmerTrustCtx {
  userId?:      string;
  events?:      any[];
  taskState?:   any;
  scanHistory?: any[];
  plantTimelineCount?: number;
  evidencePhotoCount?: number;
  baseTrust?:   any;
  now?:         number;
}

export function farmerTrustScore(ctx: FarmerTrustCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as FarmerTrustCtx;
    // Compose the data-flywheel farmer trust engine (5 inputs)
    // and ADD the enterprise-specific signals (timeline activity +
    // evidence photos).
    const base = composeFarmerTrust({
      events:      _arr(c.events),
      taskState:   c.taskState,
      scanHistory: _arr(c.scanHistory),
      baseTrust:   c.baseTrust,
      now:         _num(c.now) || Date.now(),
    } as any);
    // Bonus: plant-timeline activity + evidence photos.
    const timelineCount = _num(c.plantTimelineCount) || 0;
    const evidenceCount = _num(c.evidencePhotoCount) || 0;
    const flywheelOverall = _num((base as any).overall) || 0;
    const enterpriseBonus =
      Math.min(10, timelineCount * 0.5)
      + Math.min(10, evidenceCount * 1.5);
    const overall = Math.round(
      Math.max(0, Math.min(100, flywheelOverall + enterpriseBonus * 0.2))
    );
    const band = trustBandFor(overall);

    return Object.freeze({
      runtimeVersion: ENTERPRISE_TRUST_VERSION,
      type:           TRUST_TYPES.FARMER,
      userId:         _str(c.userId),
      overall,
      band:           band.band,
      label:          band.label,
      factors: Object.freeze({
        flywheelOverall,
        flywheelComponents: (base as any).components,
        timelineCount,
        evidenceCount,
        enterpriseBonusPoints: Math.round(enterpriseBonus),
      }),
      generatedAt:    _now(),
      wording:        'trust signal',
      deferred: Object.freeze({
        lendingEligibility:
          'this is a TRUST SIGNAL only. Never use as a credit '
          + 'score or for lending decisions.',
      }),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_TRUST_VERSION,
    type: TRUST_TYPES.FARMER, userId: '',
    overall: 0, band: 'unknown', label: 'Unknown',
    factors: Object.freeze({}), generatedAt: '',
    wording: 'trust signal',
  }));
}

interface FarmTrustCtx {
  farmId?:           string;
  hasLocation?:      boolean;
  plantCount?:       number;
  taskCount?:        number;
  scanCount?:        number;
  daysSinceActivity?: number;
}

export function farmTrustScore(ctx: FarmTrustCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as FarmTrustCtx;
    let score = 0;
    if (c.hasLocation) score += 15;
    score += Math.min(25, (_num(c.plantCount) || 0) * 3);
    score += Math.min(25, (_num(c.taskCount) || 0) * 2);
    score += Math.min(20, (_num(c.scanCount) || 0) * 4);
    // Freshness — recent activity earns up to 15
    const days = _num(c.daysSinceActivity);
    if (days != null) {
      if (days <= 1)       score += 15;
      else if (days <= 7)  score += 10;
      else if (days <= 30) score += 5;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    const band = trustBandFor(score);
    return Object.freeze({
      runtimeVersion: ENTERPRISE_TRUST_VERSION,
      type:           TRUST_TYPES.FARM,
      farmId:         _str(c.farmId),
      overall:        score,
      band:           band.band,
      label:          band.label,
      factors: Object.freeze({
        hasLocation:       !!c.hasLocation,
        plantCount:        _num(c.plantCount) || 0,
        taskCount:         _num(c.taskCount) || 0,
        scanCount:         _num(c.scanCount) || 0,
        daysSinceActivity: _num(c.daysSinceActivity),
      }),
      generatedAt:    _now(),
      wording:        'trust signal',
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_TRUST_VERSION,
    type: TRUST_TYPES.FARM, farmId: '',
    overall: 0, band: 'unknown', label: 'Unknown',
    factors: Object.freeze({}), generatedAt: '',
    wording: 'trust signal',
  }));
}

interface ProgramTrustCtx {
  programId?:                string;
  participantCount?:         number;
  activeParticipantCount?:   number;
  interventionsTotal?:       number;
  interventionsCompleted?:   number;
  taskCompletionRatePct?:    number;
  evidenceCompletenessPct?:  number;
}

export function programTrustScore(ctx: ProgramTrustCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as ProgramTrustCtx;
    const enrolled = _num(c.participantCount) || 0;
    const active   = _num(c.activeParticipantCount) || 0;
    const total    = _num(c.interventionsTotal) || 0;
    const done     = _num(c.interventionsCompleted) || 0;
    const taskPct  = Math.max(0, Math.min(100, _num(c.taskCompletionRatePct) || 0));
    const evidPct  = Math.max(0, Math.min(100, _num(c.evidenceCompletenessPct) || 0));

    const participationRate = enrolled === 0 ? 0 : (active / enrolled) * 100;
    const interventionRate  = total    === 0 ? 0 : (done   / total)    * 100;

    // Equal-weight 4-input mix (each 0..100 -> 25 points)
    const score = Math.round(
      participationRate * 0.25
      + interventionRate * 0.30
      + taskPct          * 0.25
      + evidPct          * 0.20
    );
    const band = trustBandFor(score);
    return Object.freeze({
      runtimeVersion: ENTERPRISE_TRUST_VERSION,
      type:           TRUST_TYPES.PROGRAM,
      programId:      _str(c.programId),
      overall:        score,
      band:           band.band,
      label:          band.label,
      factors: Object.freeze({
        participationRatePct:   Math.round(participationRate),
        interventionRatePct:    Math.round(interventionRate),
        taskCompletionRatePct:  taskPct,
        evidenceCompletenessPct: evidPct,
      }),
      generatedAt:    _now(),
      wording:        'trust signal',
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_TRUST_VERSION,
    type: TRUST_TYPES.PROGRAM, programId: '',
    overall: 0, band: 'unknown', label: 'Unknown',
    factors: Object.freeze({}), generatedAt: '',
    wording: 'trust signal',
  }));
}

/**
 * Roll up a list of trust scores into a single org-level summary.
 * Used by the Trust dashboard tile.
 */
export function trustSummary(scores: any[]) {
  return _safe(() => {
    const list = _arr(scores).filter(_isObj);
    if (list.length === 0) {
      return Object.freeze({
        runtimeVersion: ENTERPRISE_TRUST_VERSION,
        count: 0, average: null,
        bands: Object.freeze({
          excellent: 0, good: 0, needs_attention: 0, high_risk: 0,
        }),
      });
    }
    let sum = 0;
    const bands: Record<string, number> = {
      excellent: 0, good: 0, needs_attention: 0, high_risk: 0,
    };
    for (const s of list) {
      const v = _num(s.overall);
      if (v == null) continue;
      sum += v;
      const b = _str(s.band);
      if (bands[b] != null) bands[b]++;
    }
    return Object.freeze({
      runtimeVersion: ENTERPRISE_TRUST_VERSION,
      count: list.length,
      average: Math.round(sum / list.length),
      bands: Object.freeze(bands),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_TRUST_VERSION,
    count: 0, average: null,
    bands: Object.freeze({
      excellent: 0, good: 0, needs_attention: 0, high_risk: 0,
    }),
  }));
}

export { TRUST_TYPES, TRUST_BANDS };
