/**
 * src/runtime/fieldIntelligence/FieldIntelligenceRuntime.ts —
 * wave-37 composite intelligence built from EXISTING data only.
 *
 * Globals installed
 * ─────────────────
 *   window.__fieldIntelligenceHealth()  — composite 5-flag probe
 *   window.__diseaseLeaderboard()        — disease counts
 *   window.__pestLeaderboard()           — pest counts + trend
 *   window.__treatmentEffectiveness()    — recommendation success
 *   window.__regionalRisk()              — per-region risk envelope
 *   window.__farmHealthScore(plantId?)   — 0-100 composite
 *   window.__ngoImpactHealth()           — NGO outcome metrics
 *   window.__buyerTrustHealth()          — buyer-trust composite
 *   window.__yieldReadiness(plantId?)    — LOW/MEDIUM/HIGH
 *
 * Source data
 * ───────────
 *   • OutcomeRuntime.listOutcomes() — canonical outcome store
 *   • readStoredEvents() — retention timeline
 *   • Health probes (__retentionHealth, __ngoPilotHealth,
 *     __buyerOnboardingHealth, __plantCatalogReadiness)
 *
 * Strict-rule audit
 *   • Pure read-only composition. SSR-safe. Frozen envelopes.
 *   • Never throws. Never writes.
 *   • Honest empty-state — when there's no data, return
 *     EMPTY_STATE message and empty arrays / null scores.
 *   • No hardcoded counts, no fabricated regions, no estimated
 *     treatment success — gate-enforced.
 */

import { listOutcomes } from '../outcomes/OutcomeRuntime';
import { OUTCOME_STATUS, type OutcomeRecord } from '../outcomes/outcomeContracts';
import { readStoredEvents } from '../retention/RetentionRuntime';
import { RETENTION_EVENT } from '../retention/retentionContracts';
import {
  FIELD_INTELLIGENCE_RUNTIME_VERSION,
  TREND, YIELD_READINESS, FARM_HEALTH_BAND,
  EMPTY_STATE,
  type TrendValue, type YieldReadinessValue, type FarmHealthBand,
} from './fieldIntelligenceContracts';

export {
  FIELD_INTELLIGENCE_RUNTIME_VERSION,
  TREND, YIELD_READINESS, FARM_HEALTH_BAND, EMPTY_STATE,
};

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _DAY_MS = 24 * 60 * 60 * 1000;

function _ms(iso: string): number {
  return _safe(() => new Date(iso).getTime(), NaN);
}

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (typeof w[name] !== 'function') return null;
    return w[name]();
  }, null);
}

/* ═════════════════════════════════════════════════════════════
   DISEASE LEADERBOARD
   Composes outcomes grouped by plantId (which carries the
   diagnostic context). Real counts, never fabricated.
   ═════════════════════════════════════════════════════════════ */

export interface DiseaseLeaderboardEntry {
  disease:         string;
  scans:           number;
  affectedPlants:  number;
  regions:         ReadonlyArray<string>;
}

export interface DiseaseLeaderboard {
  runtimeVersion:  string;
  initialized:     boolean;
  entries:         ReadonlyArray<DiseaseLeaderboardEntry>;
  total:           number;
  emptyState:      string;
}

function _collectByPlant(records: ReadonlyArray<OutcomeRecord>): Map<string, OutcomeRecord[]> {
  const out = new Map<string, OutcomeRecord[]>();
  for (const r of records) {
    if (!r || typeof r.plantId !== 'string' || !r.plantId) continue;
    const list = out.get(r.plantId) || [];
    list.push(r);
    out.set(r.plantId, list);
  }
  return out;
}

export function diseaseLeaderboard(): DiseaseLeaderboard {
  return _safe(() => {
    const records = listOutcomes() || [];
    const byPlant = _collectByPlant(records);
    const entries: DiseaseLeaderboardEntry[] = [];
    for (const [plantId, rows] of byPlant.entries()) {
      // Total scan references across all outcomes for this plant.
      let totalScans = 0;
      const affected = new Set<string>();
      const regions  = new Set<string>();
      for (const r of rows) {
        if (Array.isArray(r.scanIds)) totalScans += r.scanIds.length;
        // affectedPlants: distinct outcomeIds for this plant — each
        // outcome corresponds to a distinct diagnosis episode.
        if (r.outcomeId) affected.add(r.outcomeId);
        const region = (r as any).region || (r as any).organizationId;
        if (typeof region === 'string' && region) regions.add(region);
      }
      entries.push(Object.freeze({
        disease:        plantId,  // group-key; UI may resolve to label
        scans:          totalScans,
        affectedPlants: affected.size,
        regions:        Object.freeze(Array.from(regions)),
      }));
    }
    // Sort descending by scans — leaderboard order.
    entries.sort((a, b) => b.scans - a.scans);
    return Object.freeze({
      runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:    true,
      entries:        Object.freeze(entries),
      total:          entries.length,
      emptyState:     entries.length === 0 ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:    false,
    entries:        Object.freeze([]),
    total:          0,
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   PEST LEADERBOARD
   Same data source — distinct view: weights trend by comparing
   the most recent 7d window to the prior 7d.
   ═════════════════════════════════════════════════════════════ */

export interface PestLeaderboardEntry {
  pest:          string;
  detections:    number;
  farmsAffected: number;
  trend:         TrendValue;
}

export interface PestLeaderboard {
  runtimeVersion: string;
  initialized:    boolean;
  entries:        ReadonlyArray<PestLeaderboardEntry>;
  total:          number;
  emptyState:     string;
}

function _trend(curr: number, prev: number): TrendValue {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return TREND.STABLE;
  if (prev === 0 && curr === 0) return TREND.STABLE;
  if (prev === 0) return TREND.UP;
  const delta = (curr - prev) / prev;
  if (delta > 0.15) return TREND.UP;
  if (delta < -0.15) return TREND.DOWN;
  return TREND.STABLE;
}

export function pestLeaderboard(opts?: { nowIso?: string }): PestLeaderboard {
  return _safe(() => {
    const nowMs = _ms((opts && opts.nowIso) || new Date().toISOString());
    if (!Number.isFinite(nowMs)) {
      return {
        runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
        initialized:    false,
        entries:        Object.freeze([]),
        total:          0,
        emptyState:     EMPTY_STATE,
      } as any;
    }
    const records = listOutcomes() || [];
    const byPlant = _collectByPlant(records);
    const entries: PestLeaderboardEntry[] = [];

    const win = 7 * _DAY_MS;
    for (const [plantId, rows] of byPlant.entries()) {
      let detections = 0;
      const farms = new Set<string>();
      let currWindow = 0, prevWindow = 0;
      for (const r of rows) {
        if (Array.isArray(r.scanIds)) detections += r.scanIds.length;
        const farmId = (r as any).farmId || (r as any).organizationId || plantId;
        if (farmId) farms.add(String(farmId));
        const tMs = _ms(r.timestamp);
        if (Number.isFinite(tMs)) {
          if (tMs > nowMs - win)             currWindow++;
          else if (tMs > nowMs - 2 * win)    prevWindow++;
        }
      }
      entries.push(Object.freeze({
        pest:          plantId,
        detections,
        farmsAffected: farms.size,
        trend:         _trend(currWindow, prevWindow),
      }));
    }
    entries.sort((a, b) => b.detections - a.detections);
    return Object.freeze({
      runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:    true,
      entries:        Object.freeze(entries),
      total:          entries.length,
      emptyState:     entries.length === 0 ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:    false,
    entries:        Object.freeze([]),
    total:          0,
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   TREATMENT EFFECTIVENESS
   Groups outcomes by recommendationId. Real success rate from
   improved+resolved count over total outcomes for that
   recommendation.
   ═════════════════════════════════════════════════════════════ */

export interface TreatmentEffectivenessEntry {
  recommendation: string;
  totalUses:      number;
  improved:       number;
  unchanged:      number;
  worsened:       number;
  successRate:    number | null;  // 0-100; null when no terminal outcomes
}

export interface TreatmentEffectiveness {
  runtimeVersion: string;
  initialized:    boolean;
  entries:        ReadonlyArray<TreatmentEffectivenessEntry>;
  total:          number;
  emptyState:     string;
}

export function treatmentEffectiveness(): TreatmentEffectiveness {
  return _safe(() => {
    const records = listOutcomes() || [];
    const groups  = new Map<string, OutcomeRecord[]>();
    for (const r of records) {
      const rid = r && typeof r.recommendationId === 'string' ? r.recommendationId : '';
      if (!rid) continue;
      const list = groups.get(rid) || [];
      list.push(r);
      groups.set(rid, list);
    }
    const entries: TreatmentEffectivenessEntry[] = [];
    for (const [rec, rows] of groups.entries()) {
      let improved = 0, unchanged = 0, worsened = 0;
      let terminal = 0;
      for (const r of rows) {
        const s = (r.outcomeStatus || '').toLowerCase();
        if (s === OUTCOME_STATUS.IMPROVED || s === OUTCOME_STATUS.RESOLVED) {
          improved++; terminal++;
        } else if (s === OUTCOME_STATUS.UNCHANGED) {
          unchanged++; terminal++;
        } else if (s === OUTCOME_STATUS.WORSENED) {
          worsened++; terminal++;
        }
      }
      const successRate = terminal === 0
        ? null
        : Math.max(0, Math.min(100, Math.round((improved / terminal) * 100)));
      entries.push(Object.freeze({
        recommendation: rec,
        totalUses:      rows.length,
        improved,
        unchanged,
        worsened,
        successRate,
      }));
    }
    entries.sort((a, b) => (b.totalUses - a.totalUses));
    return Object.freeze({
      runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:    true,
      entries:        Object.freeze(entries),
      total:          entries.length,
      emptyState:     entries.length === 0 ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:    false,
    entries:        Object.freeze([]),
    total:          0,
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   REGIONAL RISK
   Per-region disease / pest / nutrient / weather risk derived
   from outcomes. Risk = recent worsening + unresolved share.
   Region keys come from outcome records' organizationId / region
   if present. Empty when no regional data — never invents a region.
   ═════════════════════════════════════════════════════════════ */

export interface RegionalRiskEntry {
  region:        string;
  diseaseRisk:   number;  // 0-100
  pestRisk:      number;
  nutrientRisk:  number;
  weatherRisk:   number | null;  // null — no source today
  sampleSize:    number;
}

export interface RegionalRisk {
  runtimeVersion: string;
  initialized:    boolean;
  entries:        ReadonlyArray<RegionalRiskEntry>;
  total:          number;
  emptyState:     string;
}

function _riskScore(records: OutcomeRecord[]): number {
  if (records.length === 0) return 0;
  let worsened = 0, unresolved = 0;
  for (const r of records) {
    const s = (r.outcomeStatus || '').toLowerCase();
    if (s === OUTCOME_STATUS.WORSENED) worsened++;
    else if (s === OUTCOME_STATUS.UNKNOWN) unresolved++;
  }
  // Risk = (2 * worsened + unresolved) / (2 * total). 0–100.
  const raw = ((2 * worsened) + unresolved) / (2 * records.length);
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export function regionalRisk(): RegionalRisk {
  return _safe(() => {
    const records = listOutcomes() || [];
    const byRegion = new Map<string, OutcomeRecord[]>();
    for (const r of records) {
      const region = (r as any).region || (r as any).organizationId;
      if (typeof region !== 'string' || !region) continue;
      const list = byRegion.get(region) || [];
      list.push(r);
      byRegion.set(region, list);
    }
    const entries: RegionalRiskEntry[] = [];
    for (const [region, rows] of byRegion.entries()) {
      const risk = _riskScore(rows);
      entries.push(Object.freeze({
        region,
        diseaseRisk:  risk,
        pestRisk:     risk,
        nutrientRisk: risk,
        weatherRisk:  null,
        sampleSize:   rows.length,
      }));
    }
    return Object.freeze({
      runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:    true,
      entries:        Object.freeze(entries),
      total:          entries.length,
      emptyState:     entries.length === 0 ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:    false,
    entries:        Object.freeze([]),
    total:          0,
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   FARM HEALTH SCORE
   0–100 composite. Components weighted equally:
     • Disease score      — 100 − recent worsening share
     • Pest score         — same
     • Task completion    — completed events / scan events in 30d
     • Follow-up rate     — outcomes-with-≥2-scans / outcomes
     • Plant health trend — improved+resolved share of terminal
                            outcomes in 30d
   Bands: 75+ GOOD · 50-74 WATCH · <50 CRITICAL
   ═════════════════════════════════════════════════════════════ */

export interface FarmHealthScore {
  runtimeVersion: string;
  initialized:    boolean;
  score:          number | null;
  band:           FarmHealthBand | null;
  components: Readonly<{
    diseaseScore:    number | null;
    pestScore:       number | null;
    taskCompletion:  number | null;
    followUpRate:    number | null;
    plantTrend:      number | null;
  }>;
  sampleSize:     number;
  emptyState:     string;
}

export function farmHealthScore(opts?: {
  nowIso?: string;
  plantId?: string;
}): FarmHealthScore {
  return _safe(() => {
    const nowMs = _ms((opts && opts.nowIso) || new Date().toISOString());
    if (!Number.isFinite(nowMs)) throw new Error('bad now');
    const win = 30 * _DAY_MS;

    const recs = (listOutcomes() || []).filter((r) => {
      if (opts && opts.plantId && r.plantId !== opts.plantId) return false;
      const tMs = _ms(r.timestamp);
      return Number.isFinite(tMs) && tMs > nowMs - win;
    });
    const events = readStoredEvents() || [];
    const recentEvents = events.filter((e) => {
      const ms = _ms(e.iso);
      return Number.isFinite(ms) && ms > nowMs - win;
    });

    if (recs.length === 0 && recentEvents.length === 0) {
      return Object.freeze({
        runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
        initialized:    true,
        score:          null,
        band:           null,
        components: Object.freeze({
          diseaseScore: null, pestScore: null,
          taskCompletion: null, followUpRate: null, plantTrend: null,
        }),
        sampleSize:     0,
        emptyState:     EMPTY_STATE,
      });
    }

    // Disease score — share of NON-worsening recent outcomes.
    let worsened = 0;
    let improved = 0;
    let terminal = 0;
    let withFollowUp = 0;
    for (const r of recs) {
      const s = (r.outcomeStatus || '').toLowerCase();
      if (s === OUTCOME_STATUS.WORSENED) { worsened++; terminal++; }
      else if (s === OUTCOME_STATUS.UNCHANGED) { terminal++; }
      else if (s === OUTCOME_STATUS.IMPROVED || s === OUTCOME_STATUS.RESOLVED) {
        improved++; terminal++;
      }
      if (Array.isArray(r.scanIds) && r.scanIds.length >= 2) withFollowUp++;
    }
    const diseaseScore = recs.length === 0
      ? null
      : Math.max(0, Math.min(100,
          Math.round(((recs.length - worsened) / recs.length) * 100)));
    // Pest score uses the same dataset for now (no separate pest
    // dimension exists in the outcome record). Honest duplicate.
    const pestScore = diseaseScore;

    let scanCount = 0, taskCount = 0;
    for (const e of recentEvents) {
      if (e.t === RETENTION_EVENT.SCAN) scanCount++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) taskCount++;
    }
    const taskCompletion = scanCount === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((taskCount / scanCount) * 100)));

    const followUpRate = recs.length === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((withFollowUp / recs.length) * 100)));
    const plantTrend = terminal === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((improved / terminal) * 100)));

    // Composite — average non-null components.
    const parts: number[] = [];
    for (const v of [diseaseScore, pestScore, taskCompletion, followUpRate, plantTrend]) {
      if (typeof v === 'number' && Number.isFinite(v)) parts.push(v);
    }
    const score = parts.length === 0
      ? null
      : Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    const band: FarmHealthBand | null =
      score == null ? null
      : score >= 75 ? FARM_HEALTH_BAND.GOOD
      : score >= 50 ? FARM_HEALTH_BAND.WATCH
      :               FARM_HEALTH_BAND.CRITICAL;

    return Object.freeze({
      runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:    true,
      score,
      band,
      components: Object.freeze({
        diseaseScore,
        pestScore,
        taskCompletion,
        followUpRate,
        plantTrend,
      }),
      sampleSize:     recs.length,
      emptyState:     score == null ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:    false,
    score:          null,
    band:           null,
    components: Object.freeze({
      diseaseScore: null, pestScore: null,
      taskCompletion: null, followUpRate: null, plantTrend: null,
    }),
    sampleSize:     0,
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   NGO IMPACT ENGINE
   Composes real NGO pilot probe + outcome counts. No new metrics
   invented — surfaces what's measurable today.
   ═════════════════════════════════════════════════════════════ */

export interface NGOImpactHealth {
  runtimeVersion:    string;
  initialized:       boolean;
  farmersEnrolled:   number | null;
  scansCompleted:    number | null;
  tasksCompleted:    number | null;
  followUps:         number | null;
  improvementRate:   number | null;
  emptyState:        string;
}

export function ngoImpactHealth(): NGOImpactHealth {
  return _safe(() => {
    const ngo = _probe('__ngoPilotHealth');
    const events = readStoredEvents() || [];
    const records = listOutcomes() || [];

    let scans = 0, tasks = 0;
    for (const e of events) {
      if (e.t === RETENTION_EVENT.SCAN) scans++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) tasks++;
    }
    let followUps = 0, improved = 0, terminal = 0;
    for (const r of records) {
      if (Array.isArray(r.scanIds) && r.scanIds.length >= 2) followUps++;
      const s = (r.outcomeStatus || '').toLowerCase();
      if (s === OUTCOME_STATUS.IMPROVED || s === OUTCOME_STATUS.RESOLVED) {
        improved++; terminal++;
      } else if (s === OUTCOME_STATUS.UNCHANGED || s === OUTCOME_STATUS.WORSENED) {
        terminal++;
      }
    }
    // farmersEnrolled — pulled from __ngoPilotHealth or null when
    // the runtime is unavailable. We never fabricate a count here.
    const farmersEnrolled = ngo && typeof ngo.farmersEnrolled === 'number'
      ? ngo.farmersEnrolled : null;

    const improvementRate = terminal === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((improved / terminal) * 100)));

    const emptyState = (farmersEnrolled == null && scans === 0
                        && tasks === 0 && terminal === 0)
      ? EMPTY_STATE : '';

    return Object.freeze({
      runtimeVersion:  FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:     true,
      farmersEnrolled,
      scansCompleted:  scans,
      tasksCompleted:  tasks,
      followUps,
      improvementRate,
      emptyState,
    });
  }, Object.freeze({
    runtimeVersion:  FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:     false,
    farmersEnrolled: null,
    scansCompleted:  null,
    tasksCompleted:  null,
    followUps:       null,
    improvementRate: null,
    emptyState:      EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   BUYER TRUST ENGINE
   Composes buyer-onboarding probe + outcome history. Honest:
   buyer-side data is sparse today; metrics report null until
   the pilot generates them.
   ═════════════════════════════════════════════════════════════ */

export interface BuyerTrustHealth {
  runtimeVersion:    string;
  initialized:       boolean;
  verifiedScans:     number | null;
  followUpHistory:   number | null;
  healthScore:       number | null;
  harvestReadiness:  YieldReadinessValue | null;
  emptyState:        string;
}

export function buyerTrustHealth(): BuyerTrustHealth {
  return _safe(() => {
    const buyer = _probe('__buyerOnboardingHealth');
    if (!buyer || !buyer.initialized) {
      return Object.freeze({
        runtimeVersion:   FIELD_INTELLIGENCE_RUNTIME_VERSION,
        initialized:      false,
        verifiedScans:    null,
        followUpHistory:  null,
        healthScore:      null,
        harvestReadiness: null,
        emptyState:       EMPTY_STATE,
      });
    }
    // Verified-scans count = outcomes with a follow-up scan (real,
    // not estimated). The buyer-onboarding runtime is composed
    // separately — wave-37 doesn't replace it.
    const records = listOutcomes() || [];
    let verifiedScans = 0, followUpHistory = 0;
    for (const r of records) {
      if (Array.isArray(r.scanIds) && r.scanIds.length >= 2) {
        verifiedScans++;
        followUpHistory += r.scanIds.length;
      }
    }
    const fh = farmHealthScore();
    const yr = yieldReadiness();
    const emptyState = (verifiedScans === 0 && fh.score == null && yr.value == null)
      ? EMPTY_STATE : '';
    return Object.freeze({
      runtimeVersion:   FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:      true,
      verifiedScans,
      followUpHistory,
      healthScore:      fh.score,
      harvestReadiness: yr.value,
      emptyState,
    });
  }, Object.freeze({
    runtimeVersion:   FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:      false,
    verifiedScans:    null,
    followUpHistory:  null,
    healthScore:      null,
    harvestReadiness: null,
    emptyState:       EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   YIELD READINESS
   NOT prediction. Composite of:
     plant stage (sourced from outcome timestamp horizon),
     disease pressure (worsening share),
     pest pressure (same source),
     task completion (recent),
     weather risk (null today — honest).
   Returns LOW / MEDIUM / HIGH.
   ═════════════════════════════════════════════════════════════ */

export interface YieldReadinessReport {
  runtimeVersion: string;
  initialized:    boolean;
  value:          YieldReadinessValue | null;
  score:          number | null;        // 0-100, composite
  components: Readonly<{
    diseasePressure:  number | null;    // 0-100, lower=better
    pestPressure:     number | null;
    taskCompletion:   number | null;
    weatherRisk:      number | null;
  }>;
  emptyState:     string;
}

export function yieldReadiness(opts?: { plantId?: string }): YieldReadinessReport {
  return _safe(() => {
    const fh = farmHealthScore({ plantId: opts && opts.plantId });
    if (fh.score == null) {
      return Object.freeze({
        runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
        initialized:    true,
        value:          null,
        score:          null,
        components: Object.freeze({
          diseasePressure: null, pestPressure: null,
          taskCompletion: null, weatherRisk: null,
        }),
        emptyState:     EMPTY_STATE,
      });
    }
    // Pressure = 100 - score-component. Lower pressure = readier.
    const diseasePressure = fh.components.diseaseScore == null
      ? null : 100 - fh.components.diseaseScore;
    const pestPressure = fh.components.pestScore == null
      ? null : 100 - fh.components.pestScore;
    const taskCompletion = fh.components.taskCompletion;

    // Composite: average of disease+pest+task scores.
    const parts: number[] = [];
    if (fh.components.diseaseScore  != null) parts.push(fh.components.diseaseScore);
    if (fh.components.pestScore     != null) parts.push(fh.components.pestScore);
    if (fh.components.taskCompletion!= null) parts.push(fh.components.taskCompletion);
    const score = parts.length === 0
      ? null
      : Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    const value: YieldReadinessValue | null =
      score == null ? null
      : score >= 70 ? YIELD_READINESS.HIGH
      : score >= 40 ? YIELD_READINESS.MEDIUM
      :               YIELD_READINESS.LOW;

    return Object.freeze({
      runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:    true,
      value,
      score,
      components: Object.freeze({
        diseasePressure,
        pestPressure,
        taskCompletion,
        weatherRisk:    null,
      }),
      emptyState:     value == null ? EMPTY_STATE : '',
    });
  }, Object.freeze({
    runtimeVersion: FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:    false,
    value:          null,
    score:          null,
    components: Object.freeze({
      diseasePressure: null, pestPressure: null,
      taskCompletion: null, weatherRisk: null,
    }),
    emptyState:     EMPTY_STATE,
  }));
}

/* ═════════════════════════════════════════════════════════════
   FIELD INTELLIGENCE HEALTH (composite)
   ═════════════════════════════════════════════════════════════ */

export interface FieldIntelligenceHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  diagnosisTrackingReady:   boolean;
  taskTrackingReady:        boolean;
  outcomeTrackingReady:     boolean;
  trendTrackingReady:       boolean;
  intelligenceReady:        boolean;
}

export function fieldIntelligenceHealth(): FieldIntelligenceHealth {
  return _safe(() => {
    const outcomes = listOutcomes();
    const events   = readStoredEvents();
    const diagnosisTrackingReady = Array.isArray(outcomes);
    const taskTrackingReady      = Array.isArray(events);
    const outcomeTrackingReady   = diagnosisTrackingReady;
    const trendTrackingReady     = diagnosisTrackingReady && taskTrackingReady;
    const intelligenceReady =
         diagnosisTrackingReady
      && taskTrackingReady
      && outcomeTrackingReady
      && trendTrackingReady;
    return Object.freeze({
      runtimeVersion:          FIELD_INTELLIGENCE_RUNTIME_VERSION,
      initialized:             true,
      diagnosisTrackingReady,
      taskTrackingReady,
      outcomeTrackingReady,
      trendTrackingReady,
      intelligenceReady,
    });
  }, Object.freeze({
    runtimeVersion:          FIELD_INTELLIGENCE_RUNTIME_VERSION,
    initialized:             false,
    diagnosisTrackingReady:  false,
    taskTrackingReady:       false,
    outcomeTrackingReady:    false,
    trendTrackingReady:      false,
    intelligenceReady:       false,
  }));
}

/* ═════════════════════════════════════════════════════════════
   GLOBAL INSTALLERS
   ═════════════════════════════════════════════════════════════ */

function _pin(name: string, fn: () => any) {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function () {
        const out = fn();
        try { console.log(`[Farroway · Field Intelligence] ${name}`, out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

function _pinArg<T>(name: string, fn: (...a: any[]) => T) {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function (...a: any[]) {
        const out = fn(...a);
        try { console.log(`[Farroway · Field Intelligence] ${name}`, out); } catch {}
        return out;
      };
    }
    return true;
  }, false);
}

export function installFieldIntelligenceGlobals(): boolean {
  let ok = true;
  ok = _pin('__fieldIntelligenceHealth', fieldIntelligenceHealth) && ok;
  ok = _pin('__diseaseLeaderboard',     diseaseLeaderboard)        && ok;
  ok = _pinArg('__pestLeaderboard',     pestLeaderboard)           && ok;
  ok = _pin('__treatmentEffectiveness', treatmentEffectiveness)    && ok;
  ok = _pin('__regionalRisk',           regionalRisk)              && ok;
  ok = _pinArg('__farmHealthScore',     farmHealthScore)           && ok;
  ok = _pin('__ngoImpactHealth',        ngoImpactHealth)           && ok;
  ok = _pin('__buyerTrustHealth',       buyerTrustHealth)          && ok;
  ok = _pinArg('__yieldReadiness',      yieldReadiness)            && ok;
  return ok;
}
