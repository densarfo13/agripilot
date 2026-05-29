/**
 * src/runtime/enterprise/EnterpriseAnalyticsEngine.ts —
 * aggregate analytics composer.
 *
 *   import {
 *     organizationSummary, programSummary,
 *     cohortSummary, regionSummary,
 *     ENTERPRISE_ANALYTICS_VERSION,
 *   } from 'src/runtime/enterprise/EnterpriseAnalyticsEngine';
 *
 * What this is
 * ────────────
 *   Pure composer over caller-injected real data. NEVER invents
 *   metrics. Returns honest envelopes shaped for the UI to drop
 *   straight into tiles + tables.
 *
 *   Inputs: farms[], gardens[], plants[], events[], programs[],
 *   participants[], interventions[], cohorts[]. The route layer
 *   pulls these from the existing tables (and from
 *   localStorage for managed plants until the Prisma migration
 *   ships).
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only.
 *   • Honest "—" / null when no signals.
 */

import {
  PROGRAM_FARMER_STATUSES, INTERVENTION_STATUSES,
} from './enterpriseContracts';
import { summarizeIntervention } from './InterventionRuntime';

export const ENTERPRISE_ANALYTICS_VERSION = 'enterprise-analytics-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _avg(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return Math.round((sum / values.length) * 10) / 10;
}

function _countEvents(events: any[], kind: string): number {
  let n = 0;
  for (const e of _arr(events)) {
    if (_isObj(e) && _str(e.eventType) === kind) n++;
  }
  return n;
}

interface SummaryCtx {
  organizationId?: string;
  farms?:          any[];
  gardens?:        any[];
  plants?:         any[];     // managed plants
  events?:         any[];     // wave-5 event log
  programs?:       any[];
  participants?:   any[];     // program farmers
  interventions?: any[];
  interventionParticipants?: any[];
  cohorts?:        any[];
}

export function organizationSummary(ctx: SummaryCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as SummaryCtx;
    const orgId = _str(c.organizationId);
    const programs = _arr(c.programs).filter((p) =>
      _isObj(p) && _str(p.organizationId) === orgId);
    const programIds = new Set(programs.map((p) => _str(p.id)));
    const participants = _arr(c.participants).filter((p) =>
      _isObj(p) && programIds.has(_str(p.programId)));
    const userIds = new Set(participants.map((p) => _str(p.userId)));
    const farms = _arr(c.farms).filter((f) =>
      _isObj(f) && userIds.has(_str(f.userId)));
    const gardens = _arr(c.gardens).filter((g) =>
      _isObj(g) && userIds.has(_str(g.userId)));
    const plants = _arr(c.plants).filter((p) =>
      _isObj(p) && userIds.has(_str(p.userId)));
    const healthScores = plants
      .map((p) => _num(p.healthScore))
      .filter((v): v is number => v != null);
    const highRiskCount = plants.filter((p) =>
      (_num(p.riskScore) ?? 0) >= 60
      || (_num(p.healthScore) ?? 100) < 50).length;
    const activeFarmers = participants.filter(
      (p) => p.status === PROGRAM_FARMER_STATUSES.ACTIVE).length;
    const inactiveFarmers = participants.filter(
      (p) => p.status === PROGRAM_FARMER_STATUSES.INACTIVE).length;
    const interventionsCompleted = _arr(c.interventions).filter((i) =>
      _isObj(i) && programIds.has(_str(i.programId))
      && i.status === INTERVENTION_STATUSES.COMPLETED).length;

    const totalFarmers = participants.length;
    const hasAnySignal = totalFarmers > 0 || plants.length > 0;

    return Object.freeze({
      runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
      organizationId: orgId,
      hasAnySignal,
      totals: Object.freeze({
        farmers:         totalFarmers,
        activeFarmers,
        inactiveFarmers,
        farms:           farms.length,
        gardens:         gardens.length,
        plants:          plants.length,
        scansCompleted:  _countEvents(_arr(c.events), 'scan_completed'),
        tasksCompleted:  _countEvents(_arr(c.events), 'task_completed'),
        activePrograms:  programs.filter((p) => p.status === 'active').length,
        interventionsCompleted,
        highRiskCount,
      }),
      averages: Object.freeze({
        plantHealth: _avg(healthScores),
      }),
      generatedAt: _safe(() => new Date().toISOString(), ''),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
    organizationId: '',
    hasAnySignal: false,
    totals: Object.freeze({}),
    averages: Object.freeze({}),
    generatedAt: '',
  }));
}

export function programSummary(ctx: SummaryCtx & { programId?: string }) {
  return _safe(() => {
    const c    = _isObj(ctx) ? ctx : {} as any;
    const pid  = _str(c.programId);
    const program = _arr(c.programs)
      .map((p) => _isObj(p) ? p : null)
      .find((p) => p && _str(p.id) === pid);
    if (!program) {
      return Object.freeze({
        runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
        programId: pid,
        hasAnySignal: false,
        program: null,
        totals: Object.freeze({}),
      });
    }
    const participants = _arr(c.participants).filter((p) =>
      _isObj(p) && _str(p.programId) === pid);
    const userIds = new Set(participants.map((p) => _str(p.userId)));
    const plants = _arr(c.plants).filter((p) =>
      _isObj(p) && userIds.has(_str(p.userId)));
    const healthScores = plants
      .map((p) => _num(p.healthScore))
      .filter((v): v is number => v != null);
    const interventions = _arr(c.interventions).filter((i) =>
      _isObj(i) && _str(i.programId) === pid);
    const interventionsCompleted = interventions.filter((i) =>
      i.status === INTERVENTION_STATUSES.COMPLETED).length;
    const completionRate = interventions.length === 0 ? null
      : Math.round((interventionsCompleted / interventions.length) * 100);
    const taskCompletionRate = participants.length === 0 ? null
      : Math.round((_countEvents(_arr(c.events), 'task_completed')
          / Math.max(1, participants.length)) * 10) / 10;

    return Object.freeze({
      runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
      programId: pid,
      hasAnySignal: participants.length > 0 || plants.length > 0,
      program,
      totals: Object.freeze({
        enrolled:                 participants.length,
        activeFarmers:            participants.filter((p) => p.status === 'active').length,
        farms:                    new Set(participants.map((p) => _str(p.farmId))
                                    .filter(Boolean)).size,
        gardens:                  new Set(participants.map((p) => _str(p.gardenId))
                                    .filter(Boolean)).size,
        plants:                   plants.length,
        scansCompleted:           _countEvents(_arr(c.events), 'scan_completed'),
        interventionsTotal:       interventions.length,
        interventionsCompleted,
        interventionCompletionRatePct: completionRate,
      }),
      averages: Object.freeze({
        plantHealth: _avg(healthScores),
        taskCompletionPerFarmer: taskCompletionRate,
      }),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
    programId: '', hasAnySignal: false, program: null,
    totals: Object.freeze({}), averages: Object.freeze({}),
  }));
}

export function cohortSummary(ctx: SummaryCtx & { cohortId?: string }) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as any;
    const cid = _str(c.cohortId);
    const cohort = _arr(c.cohorts)
      .map((x) => _isObj(x) ? x : null)
      .find((x) => x && _str(x.id) === cid);
    if (!cohort) {
      return Object.freeze({
        runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
        cohortId: cid, hasAnySignal: false,
        cohort: null, totals: Object.freeze({}),
      });
    }
    const participants = _arr(c.participants).filter((p) =>
      _isObj(p) && _str(p.cohortId) === cid);
    const userIds = new Set(participants.map((p) => _str(p.userId)));
    const plants = _arr(c.plants).filter((p) =>
      _isObj(p) && userIds.has(_str(p.userId)));
    const healthScores = plants
      .map((p) => _num(p.healthScore))
      .filter((v): v is number => v != null);
    return Object.freeze({
      runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
      cohortId: cid,
      hasAnySignal: participants.length > 0 || plants.length > 0,
      cohort,
      totals: Object.freeze({
        farmers: participants.length,
        farms:   new Set(participants.map((p) => _str(p.farmId)).filter(Boolean)).size,
        plants:  plants.length,
        scansCompleted: _countEvents(_arr(c.events), 'scan_completed'),
        riskLevel: _num(_avg(healthScores)) != null
          && (_avg(healthScores) as number) < 55 ? 'high' : 'normal',
      }),
      averages: Object.freeze({
        plantHealth: _avg(healthScores),
      }),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
    cohortId: '', hasAnySignal: false,
    cohort: null, totals: Object.freeze({}), averages: Object.freeze({}),
  }));
}

export function regionSummary(ctx: SummaryCtx & { region?: string }) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as any;
    const region = _str(c.region);
    const farms = _arr(c.farms).filter((f) =>
      _isObj(f) && _str(f.region) === region);
    const gardens = _arr(c.gardens).filter((g) =>
      _isObj(g) && _str(g.region) === region);
    const userIds = new Set(
      farms.concat(gardens).map((x) => _str(x.userId)));
    const plants = _arr(c.plants).filter((p) =>
      _isObj(p) && userIds.has(_str(p.userId)));
    const healthScores = plants
      .map((p) => _num(p.healthScore))
      .filter((v): v is number => v != null);
    return Object.freeze({
      runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
      region,
      hasAnySignal: userIds.size > 0,
      totals: Object.freeze({
        farms: farms.length, gardens: gardens.length,
        farmers: userIds.size, plants: plants.length,
      }),
      averages: Object.freeze({ plantHealth: _avg(healthScores) }),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_ANALYTICS_VERSION,
    region: '', hasAnySignal: false,
    totals: Object.freeze({}), averages: Object.freeze({}),
  }));
}

// Re-export for callers that want the per-intervention shape too.
export { summarizeIntervention };
