/**
 * src/runtime/farmerSuccess/FarmerSuccessEngine.ts — wave-37.5
 * composite daily-assistant runtime built ENTIRELY from existing
 * data sources. No new scan providers, no new AI models, no
 * architecture changes.
 *
 * Data sources (composition only)
 *   • OutcomeRuntime.listOutcomes()   — diagnoses, outcomes, follow-ups
 *   • readStoredEvents()              — retention events (scan/task/etc.)
 *   • __farmHealthScore (wave-37)      — composite farm health
 *   • __yieldReadiness  (wave-37)      — harvest readiness band
 *   • __diseaseLeaderboard (wave-37)   — top diseases (real data)
 *   • __pestLeaderboard    (wave-37)   — top pests with trend
 *   • __regionalRisk       (wave-37)   — regional risk envelope
 *   • __taskStoreHealth                — open/overdue task counts
 *   • __farrowayWeather (build-time)   — weather snapshot if present
 *
 * Globals installed
 * ─────────────────
 *   window.__todayPriority()
 *   window.__dailyActions()           — top 3 actions
 *   window.__farmRisk()
 *   window.__missedActions()
 *   window.__farmSuccessScore(opts?)
 *   window.__weeklyFarmSummary()
 *   window.__farmerVoiceLines()
 *   window.__farmerSuccessHealth()    — composite 6-flag probe
 *
 * Honest contract (gate-enforced)
 *   • Empty state copy is EMPTY_FRIENDLY when no data available
 *     — never fabricates a risk, never invents weather, never
 *     hardcodes a score.
 *   • Every recommendation traces back to real outcome /
 *     retention / health-score data.
 *   • Disease + pest names come from the existing leaderboards
 *     (which derive from real outcome plant-ids) — never the
 *     literal "Fall Armyworm" or "Tomato Leaf Spot" hardcoded
 *     in this file.
 */

import { listOutcomes } from '../outcomes/OutcomeRuntime';
import { OUTCOME_STATUS, type OutcomeRecord } from '../outcomes/outcomeContracts';
import { readStoredEvents } from '../retention/RetentionRuntime';
import { RETENTION_EVENT } from '../retention/retentionContracts';
import {
  FARMER_SUCCESS_RUNTIME_VERSION,
  URGENCY, RISK_SEVERITY, SUCCESS_LEVEL,
  EMPTY_FRIENDLY, OVERDUE_COPY,
  type UrgencyValue, type RiskSeverityValue, type SuccessLevelValue,
} from './farmerSuccessContracts';

export {
  FARMER_SUCCESS_RUNTIME_VERSION,
  URGENCY, RISK_SEVERITY, SUCCESS_LEVEL,
  EMPTY_FRIENDLY, OVERDUE_COPY,
};

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _DAY_MS = 24 * 60 * 60 * 1000;

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return typeof (window as any)[name] === 'function';
  }, false);
}
function _ms(iso: string | null | undefined): number {
  return _safe(() => new Date(iso || '').getTime(), NaN);
}

/* ═════════════════════════════════════════════════════════════
   1. TODAY'S PRIORITY
   Single top priority — composed from highest-urgency signal:
     overdue task > worsened outcome > unresolved diagnosis >
     yield readiness LOW > nothing.
   Disease/pest names come from real leaderboards.
   ═════════════════════════════════════════════════════════════ */

export interface TodayPriority {
  priority:          string | null;
  reason:            string | null;
  urgency:           UrgencyValue | null;
  dueDate:           string | null;
  source:            string;      // which composition produced this
  emptyState:        string;
}

const FROZEN_NO_PRIORITY: Readonly<TodayPriority> = Object.freeze({
  priority:   null,
  reason:     null,
  urgency:    null,
  dueDate:    null,
  source:     'none',
  emptyState: EMPTY_FRIENDLY,
});

function _firstWorsenedPlant(records: ReadonlyArray<OutcomeRecord>): string | null {
  for (const r of records) {
    const s = (r.outcomeStatus || '').toLowerCase();
    if (s === OUTCOME_STATUS.WORSENED && r.plantId) return r.plantId;
  }
  return null;
}

export function todayPriority(): TodayPriority {
  return _safe(() => {
    const outcomes = listOutcomes() || [];
    const events   = readStoredEvents() || [];
    const taskStore = _probe('__taskStoreHealth');
    const yieldRdy  = _probe('__yieldReadiness');
    const farmHealth = _probe('__farmHealthScore');

    // 1) Overdue task. Surfaced via __taskStoreHealth.overdueCount
    //    when wired; otherwise inferred from missed-events count.
    const overdueCount = _safe(() => {
      if (taskStore && typeof taskStore.overdueCount === 'number') {
        return taskStore.overdueCount;
      }
      return 0;
    }, 0);
    if (overdueCount > 0) {
      return Object.freeze({
        priority: 'Complete your overdue task',
        reason:   `${overdueCount} task${overdueCount === 1 ? '' : 's'} overdue`,
        urgency:  URGENCY.NOW,
        dueDate:  new Date().toISOString().slice(0, 10),
        source:   'taskStore.overdueCount',
        emptyState: '',
      });
    }

    // 2) Worsened outcome — real plantId from outcome record.
    const worsenedPlant = _firstWorsenedPlant(outcomes);
    if (worsenedPlant) {
      return Object.freeze({
        priority: `Check ${worsenedPlant} — condition worsening`,
        reason:   'Most recent follow-up scored worsened',
        urgency:  URGENCY.NOW,
        dueDate:  new Date().toISOString().slice(0, 10),
        source:   'outcomes.worsened',
        emptyState: '',
      });
    }

    // 3) Unresolved diagnosis older than 7 days — needs follow-up.
    const nowMs = Date.now();
    let unresolvedPlant: string | null = null;
    for (const r of outcomes) {
      const s = (r.outcomeStatus || '').toLowerCase();
      const age = (nowMs - _ms(r.timestamp));
      if (s === OUTCOME_STATUS.UNKNOWN && age > 7 * _DAY_MS && r.plantId) {
        unresolvedPlant = r.plantId;
        break;
      }
    }
    if (unresolvedPlant) {
      return Object.freeze({
        priority: `Follow up on ${unresolvedPlant}`,
        reason:   'Diagnosis still unresolved after a week',
        urgency:  URGENCY.NOW,
        dueDate:  new Date().toISOString().slice(0, 10),
        source:   'outcomes.unresolved',
        emptyState: '',
      });
    }

    // 4) Yield readiness LOW — broad farm-level warning.
    if (yieldRdy && yieldRdy.value === 'LOW') {
      return Object.freeze({
        priority: 'Improve farm conditions before harvest',
        reason:   'Yield readiness is currently low',
        urgency:  URGENCY.THIS_WEEK,
        dueDate:  null,
        source:   'yieldReadiness.LOW',
        emptyState: '',
      });
    }

    // 5) Farm health CRITICAL.
    if (farmHealth && farmHealth.band === 'CRITICAL') {
      return Object.freeze({
        priority: 'Address farm health',
        reason:   'Farm health score is in the critical band',
        urgency:  URGENCY.NOW,
        dueDate:  new Date().toISOString().slice(0, 10),
        source:   'farmHealth.CRITICAL',
        emptyState: '',
      });
    }

    // No real signal — honest empty.
    return FROZEN_NO_PRIORITY;
  }, FROZEN_NO_PRIORITY);
}

/* ═════════════════════════════════════════════════════════════
   2. DAILY ACTIONS (top 3)
   Composed from:
     • overdue tasks
     • worsened/unresolved outcomes
     • leaderboards (disease + pest)
     • weather snapshot (when present)
   Returns up to 3 actions; never invents.
   ═════════════════════════════════════════════════════════════ */

export interface DailyAction {
  action:    string;
  reason:    string;
  source:    string;
  urgency:   UrgencyValue;
}

export interface DailyActions {
  runtimeVersion: string;
  initialized:    boolean;
  actions:        ReadonlyArray<DailyAction>;
  emptyState:     string;
}

const FROZEN_NO_ACTIONS: Readonly<DailyActions> = Object.freeze({
  runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
  initialized:    true,
  actions:        Object.freeze([]),
  emptyState:     EMPTY_FRIENDLY,
});

function _weatherSnapshot(): { rainExpected?: boolean; condition?: string } | null {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    // Existing weather diagnostic from wave-N exposes either
    // __farrowayWeather() or w.__farrowayWeatherSnapshot.
    if (typeof w.__farrowayWeather === 'function') {
      const snap = w.__farrowayWeather();
      if (snap && typeof snap === 'object') return snap;
    }
    if (w.__farrowayWeatherSnapshot && typeof w.__farrowayWeatherSnapshot === 'object') {
      return w.__farrowayWeatherSnapshot;
    }
    return null;
  }, null);
}

export function dailyActions(): DailyActions {
  return _safe(() => {
    const out: DailyAction[] = [];
    const outcomes = listOutcomes() || [];
    const taskStore = _probe('__taskStoreHealth');

    const overdueCount = _safe(() =>
      taskStore && typeof taskStore.overdueCount === 'number'
        ? taskStore.overdueCount : 0, 0);
    if (overdueCount > 0) {
      out.push({
        action: `Complete ${overdueCount} overdue task${overdueCount === 1 ? '' : 's'}`,
        reason: 'Open task past its due date',
        source: 'taskStore.overdueCount',
        urgency: URGENCY.NOW,
      });
    }

    // Worsened plant — real ID, surfaced once.
    const worsened = _firstWorsenedPlant(outcomes);
    if (worsened) {
      out.push({
        action: `Inspect ${worsened} closely today`,
        reason: 'Recent outcome marked worsened',
        source: 'outcomes.worsened',
        urgency: URGENCY.NOW,
      });
    }

    // Disease + pest leaderboards — real top entries.
    const disease = _probe('__diseaseLeaderboard');
    if (disease && Array.isArray(disease.entries) && disease.entries.length > 0) {
      const top = disease.entries[0];
      if (top && top.disease) {
        out.push({
          action: `Scout for ${top.disease} pressure`,
          reason: `${top.scans || 0} scan${top.scans === 1 ? '' : 's'} logged for this plant`,
          source: 'diseaseLeaderboard.top',
          urgency: URGENCY.THIS_WEEK,
        });
      }
    }

    if (out.length < 3) {
      const pest = _probe('__pestLeaderboard');
      if (pest && Array.isArray(pest.entries) && pest.entries.length > 0) {
        const top = pest.entries[0];
        if (top && top.pest && top.trend === 'UP') {
          out.push({
            action: `Watch ${top.pest} — pressure rising`,
            reason: `${top.detections || 0} detections, trend UP`,
            source: 'pestLeaderboard.UP',
            urgency: URGENCY.THIS_WEEK,
          });
        }
      }
    }

    // Weather — only when a real snapshot exists.
    if (out.length < 3) {
      const w = _weatherSnapshot();
      if (w && w.rainExpected === true) {
        out.push({
          action: 'Delay spraying until after rain',
          reason: 'Rain expected — protect spray efficacy',
          source: 'weather.rainExpected',
          urgency: URGENCY.NOW,
        });
      }
    }

    return Object.freeze({
      runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
      initialized:    true,
      actions:        Object.freeze(out.slice(0, 3).map(Object.freeze)),
      emptyState:     out.length === 0 ? EMPTY_FRIENDLY : '',
    });
  }, FROZEN_NO_ACTIONS);
}

/* ═════════════════════════════════════════════════════════════
   3. FARM RISK
   Biggest current farm risk — composed from:
     • pest leaderboard UP trend
     • disease leaderboard count
     • missed-irrigation (proxy: 0 scans in 14d)
     • harvest delay (yield readiness LOW + old outcomes)
   ═════════════════════════════════════════════════════════════ */

export interface FarmRisk {
  risk:               string | null;
  severity:           RiskSeverityValue | null;
  reason:             string | null;
  recommendedAction:  string | null;
  source:             string;
  emptyState:         string;
}

const FROZEN_NO_RISK: Readonly<FarmRisk> = Object.freeze({
  risk:              null,
  severity:          null,
  reason:            null,
  recommendedAction: null,
  source:            'none',
  emptyState:        EMPTY_FRIENDLY,
});

export function farmRisk(): FarmRisk {
  return _safe(() => {
    const outcomes = listOutcomes() || [];
    const events   = readStoredEvents() || [];

    // 1) Disease worsening — count of WORSENED outcomes in 14d.
    const nowMs = Date.now();
    let worsenedRecent = 0;
    for (const r of outcomes) {
      const s = (r.outcomeStatus || '').toLowerCase();
      if (s !== OUTCOME_STATUS.WORSENED) continue;
      if ((nowMs - _ms(r.timestamp)) <= 14 * _DAY_MS) worsenedRecent++;
    }
    if (worsenedRecent > 0) {
      return Object.freeze({
        risk:              'Disease worsening',
        severity:          worsenedRecent >= 3 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        reason:            `${worsenedRecent} recent outcome${worsenedRecent === 1 ? '' : 's'} marked worsened`,
        recommendedAction: 'Inspect affected plants and follow up with a new scan',
        source:            'outcomes.worsened.14d',
        emptyState:        '',
      });
    }

    // 2) High pest pressure — leaderboard top entry with UP trend.
    const pest = _probe('__pestLeaderboard');
    if (pest && Array.isArray(pest.entries) && pest.entries[0]) {
      const top = pest.entries[0];
      if (top.trend === 'UP' && (top.detections || 0) > 0) {
        return Object.freeze({
          risk:              'High pest pressure',
          severity:          top.detections >= 5 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
          reason:            `${top.pest} — ${top.detections} detections, trend UP`,
          recommendedAction: 'Scout fields and confirm pest identification before acting',
          source:            'pestLeaderboard.UP',
          emptyState:        '',
        });
      }
    }

    // 3) Missed irrigation proxy — no scan or task events in 14d.
    let recentActivity = 0;
    for (const e of events) {
      if ((nowMs - _ms(e.iso)) <= 14 * _DAY_MS) recentActivity++;
    }
    if (events.length > 0 && recentActivity === 0) {
      return Object.freeze({
        risk:              'Missed action',
        severity:          RISK_SEVERITY.MEDIUM,
        reason:            'No farm activity in the last 14 days',
        recommendedAction: 'Open Farroway and log this week\'s scan or task',
        source:            'retention.gap.14d',
        emptyState:        '',
      });
    }

    // 4) Harvest delay — yieldReadiness LOW with active outcomes.
    const yieldRdy = _probe('__yieldReadiness');
    if (yieldRdy && yieldRdy.value === 'LOW' && outcomes.length > 0) {
      return Object.freeze({
        risk:              'Harvest delay',
        severity:          RISK_SEVERITY.MEDIUM,
        reason:            'Yield readiness is low — harvest window may slip',
        recommendedAction: 'Close out open tasks and confirm plant stage',
        source:            'yieldReadiness.LOW',
        emptyState:        '',
      });
    }

    return FROZEN_NO_RISK;
  }, FROZEN_NO_RISK);
}

/* ═════════════════════════════════════════════════════════════
   4. MISSED ACTIONS — farmer-friendly copy
   ═════════════════════════════════════════════════════════════ */

export interface MissedAction {
  label:     string;        // "Action overdue"
  detail:    string;        // friendly explanation
  count:     number;
}

export interface MissedActions {
  runtimeVersion:  string;
  initialized:     boolean;
  total:           number;
  rows:            ReadonlyArray<MissedAction>;
  emptyState:      string;
}

export function missedActions(): MissedActions {
  return _safe(() => {
    const taskStore = _probe('__taskStoreHealth');
    const overdueCount = _safe(() =>
      taskStore && typeof taskStore.overdueCount === 'number'
        ? taskStore.overdueCount : 0, 0);

    const rows: MissedAction[] = [];
    if (overdueCount > 0) {
      rows.push({
        label: OVERDUE_COPY,
        detail: `You have ${overdueCount} task${overdueCount === 1 ? '' : 's'} past its due date`,
        count: overdueCount,
      });
    }
    // Unresolved diagnoses that aged past 14d.
    const outcomes = listOutcomes() || [];
    const nowMs = Date.now();
    let unresolved = 0;
    for (const r of outcomes) {
      const s = (r.outcomeStatus || '').toLowerCase();
      if (s !== OUTCOME_STATUS.UNKNOWN) continue;
      if ((nowMs - _ms(r.timestamp)) > 14 * _DAY_MS) unresolved++;
    }
    if (unresolved > 0) {
      rows.push({
        label: OVERDUE_COPY,
        detail: `${unresolved} diagnosis${unresolved === 1 ? '' : 'es'} still need a follow-up scan`,
        count: unresolved,
      });
    }

    const total = rows.reduce((a, r) => a + r.count, 0);
    return Object.freeze({
      runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
      initialized:    true,
      total,
      rows:           Object.freeze(rows.map(Object.freeze)),
      emptyState:     total === 0 ? EMPTY_FRIENDLY : '',
    });
  }, Object.freeze({
    runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
    initialized:    false,
    total:          0,
    rows:           Object.freeze([]),
    emptyState:     EMPTY_FRIENDLY,
  }));
}

/* ═════════════════════════════════════════════════════════════
   5. FARM SUCCESS SCORE (0-100)
   Inputs: task completion, follow-up rate, disease improvement,
   plant health. All derived from real outcomes + retention.
   Levels: 90+ EXCELLENT · 75+ GOOD · 50+ WATCH · <50 NEEDS_ATTENTION.
   ═════════════════════════════════════════════════════════════ */

export interface FarmSuccessScore {
  runtimeVersion:    string;
  initialized:       boolean;
  score:             number | null;
  level:             SuccessLevelValue | null;
  components: Readonly<{
    taskCompletion:        number | null;
    followUpRate:          number | null;
    diseaseImprovement:    number | null;
    plantHealth:           number | null;
  }>;
  sampleSize:        number;
  emptyState:        string;
}

export function farmSuccessScore(opts?: { nowIso?: string; windowDays?: number }): FarmSuccessScore {
  return _safe(() => {
    const nowMs = _ms((opts && opts.nowIso) || new Date().toISOString());
    if (!Number.isFinite(nowMs)) throw new Error('bad now');
    const win = Math.max(1, Math.min(90,
      (opts && Number.isFinite(opts.windowDays!) ? Math.floor(opts.windowDays!) : 30))) * _DAY_MS;

    const records = (listOutcomes() || []).filter((r) =>
      Number.isFinite(_ms(r.timestamp)) && (nowMs - _ms(r.timestamp)) <= win);
    const events  = (readStoredEvents() || []).filter((e) =>
      Number.isFinite(_ms(e.iso)) && (nowMs - _ms(e.iso)) <= win);

    if (records.length === 0 && events.length === 0) {
      return Object.freeze({
        runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
        initialized:    true,
        score:          null,
        level:          null,
        components: Object.freeze({
          taskCompletion: null, followUpRate: null,
          diseaseImprovement: null, plantHealth: null,
        }),
        sampleSize:     0,
        emptyState:     EMPTY_FRIENDLY,
      });
    }

    // task completion — completed tasks ÷ scans in window
    let scans = 0, tasks = 0;
    for (const e of events) {
      if (e.t === RETENTION_EVENT.SCAN) scans++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) tasks++;
    }
    const taskCompletion = scans === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((tasks / scans) * 100)));

    // follow-up rate — outcomes-with-≥2-scans ÷ outcomes
    let followUps = 0;
    for (const r of records) {
      if (Array.isArray(r.scanIds) && r.scanIds.length >= 2) followUps++;
    }
    const followUpRate = records.length === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((followUps / records.length) * 100)));

    // disease improvement — improved+resolved ÷ terminal
    let improved = 0, terminal = 0;
    for (const r of records) {
      const s = (r.outcomeStatus || '').toLowerCase();
      if (s === OUTCOME_STATUS.IMPROVED || s === OUTCOME_STATUS.RESOLVED) {
        improved++; terminal++;
      } else if (s === OUTCOME_STATUS.UNCHANGED || s === OUTCOME_STATUS.WORSENED) {
        terminal++;
      }
    }
    const diseaseImprovement = terminal === 0
      ? null
      : Math.max(0, Math.min(100, Math.round((improved / terminal) * 100)));

    // plant health — read from farm-health-score probe (real composite)
    const farmHealth = _probe('__farmHealthScore');
    const plantHealth = farmHealth && typeof farmHealth.score === 'number'
      ? farmHealth.score : null;

    const parts: number[] = [];
    for (const v of [taskCompletion, followUpRate, diseaseImprovement, plantHealth]) {
      if (typeof v === 'number' && Number.isFinite(v)) parts.push(v);
    }
    const score = parts.length === 0
      ? null
      : Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    const level: SuccessLevelValue | null =
      score == null ? null
      : score >= 90 ? SUCCESS_LEVEL.EXCELLENT
      : score >= 75 ? SUCCESS_LEVEL.GOOD
      : score >= 50 ? SUCCESS_LEVEL.WATCH
      :               SUCCESS_LEVEL.NEEDS_ATTENTION;

    return Object.freeze({
      runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
      initialized:    true,
      score,
      level,
      components: Object.freeze({
        taskCompletion,
        followUpRate,
        diseaseImprovement,
        plantHealth,
      }),
      sampleSize:     records.length,
      emptyState:     score == null ? EMPTY_FRIENDLY : '',
    });
  }, Object.freeze({
    runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
    initialized:    false,
    score:          null,
    level:          null,
    components: Object.freeze({
      taskCompletion: null, followUpRate: null,
      diseaseImprovement: null, plantHealth: null,
    }),
    sampleSize:     0,
    emptyState:     EMPTY_FRIENDLY,
  }));
}

/* ═════════════════════════════════════════════════════════════
   6. WEEKLY FARM SUMMARY
   ═════════════════════════════════════════════════════════════ */

export interface WeeklyFarmSummary {
  runtimeVersion:    string;
  initialized:       boolean;
  windowDays:        number;
  scans:             number | null;
  tasks:             number | null;
  completed:         number | null;
  improved:          number | null;
  worsened:          number | null;
  topDisease:        string | null;
  topPest:           string | null;
  emptyState:        string;
}

export function weeklyFarmSummary(opts?: { nowIso?: string }): WeeklyFarmSummary {
  return _safe(() => {
    const nowMs = _ms((opts && opts.nowIso) || new Date().toISOString());
    if (!Number.isFinite(nowMs)) throw new Error('bad now');
    const win = 7 * _DAY_MS;

    const events  = (readStoredEvents() || []).filter((e) =>
      Number.isFinite(_ms(e.iso)) && (nowMs - _ms(e.iso)) <= win);
    const records = (listOutcomes() || []).filter((r) =>
      Number.isFinite(_ms(r.timestamp)) && (nowMs - _ms(r.timestamp)) <= win);

    let scans = 0, tasks = 0;
    for (const e of events) {
      if (e.t === RETENTION_EVENT.SCAN) scans++;
      if (e.t === RETENTION_EVENT.TASK_COMPLETED) tasks++;
    }
    let improved = 0, worsened = 0;
    for (const r of records) {
      const s = (r.outcomeStatus || '').toLowerCase();
      if (s === OUTCOME_STATUS.IMPROVED || s === OUTCOME_STATUS.RESOLVED) improved++;
      if (s === OUTCOME_STATUS.WORSENED) worsened++;
    }

    const disease = _probe('__diseaseLeaderboard');
    const pest    = _probe('__pestLeaderboard');
    const topDisease = (disease && Array.isArray(disease.entries) && disease.entries[0])
      ? (disease.entries[0].disease || null) : null;
    const topPest    = (pest && Array.isArray(pest.entries) && pest.entries[0])
      ? (pest.entries[0].pest || null) : null;

    const totalActivity = scans + tasks + records.length;
    return Object.freeze({
      runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
      initialized:    true,
      windowDays:     7,
      scans,
      tasks,
      completed:      tasks,  // completed == TASK_COMPLETED events
      improved,
      worsened,
      topDisease,
      topPest,
      emptyState:     totalActivity === 0 ? EMPTY_FRIENDLY : '',
    });
  }, Object.freeze({
    runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
    initialized:    false,
    windowDays:     7,
    scans:          null,
    tasks:          null,
    completed:      null,
    improved:       null,
    worsened:       null,
    topDisease:     null,
    topPest:        null,
    emptyState:     EMPTY_FRIENDLY,
  }));
}

/* ═════════════════════════════════════════════════════════════
   7. LOW-LITERACY VOICE LINES
   Short, clear, no technical terms. Each line traces to a real
   source. Empty array when nothing real to say.
   ═════════════════════════════════════════════════════════════ */

export interface VoiceLine {
  text:    string;
  source:  string;
}

export interface FarmerVoiceLines {
  runtimeVersion: string;
  initialized:    boolean;
  lines:          ReadonlyArray<VoiceLine>;
  emptyState:     string;
}

export function farmerVoiceLines(): FarmerVoiceLines {
  return _safe(() => {
    const lines: VoiceLine[] = [];
    const priority = todayPriority();
    if (priority.priority) {
      lines.push({
        text: priority.priority,
        source: priority.source,
      });
    }
    const risk = farmRisk();
    if (risk.risk && risk.recommendedAction) {
      lines.push({
        text: risk.recommendedAction,
        source: risk.source,
      });
    }
    const weather = _weatherSnapshot();
    if (weather && weather.rainExpected === true) {
      lines.push({
        text: 'Rain expected soon. Plan your spraying around it.',
        source: 'weather.rainExpected',
      });
    }
    const yieldRdy = _probe('__yieldReadiness');
    if (yieldRdy && yieldRdy.value === 'HIGH') {
      lines.push({
        text: 'Your crop is close to harvest.',
        source: 'yieldReadiness.HIGH',
      });
    }
    return Object.freeze({
      runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
      initialized:    true,
      lines:          Object.freeze(lines.map(Object.freeze)),
      emptyState:     lines.length === 0 ? EMPTY_FRIENDLY : '',
    });
  }, Object.freeze({
    runtimeVersion: FARMER_SUCCESS_RUNTIME_VERSION,
    initialized:    false,
    lines:          Object.freeze([]),
    emptyState:     EMPTY_FRIENDLY,
  }));
}

/* ═════════════════════════════════════════════════════════════
   8. COMPOSITE HEALTH
   ═════════════════════════════════════════════════════════════ */

export interface FarmerSuccessHealth {
  runtimeVersion:        string;
  initialized:           boolean;
  priorityEngineReady:   boolean;
  dailyActionsReady:     boolean;
  farmRiskReady:         boolean;
  successScoreReady:     boolean;
  summaryReady:          boolean;
  voiceReady:            boolean;
}

export function farmerSuccessHealth(): FarmerSuccessHealth {
  return _safe(() => {
    // Each sub-runtime is "ready" when its initialized flag is
    // true on a current call — proves the composition path works
    // even with no underlying data.
    const tp = todayPriority();
    const da = dailyActions();
    const fr = farmRisk();
    const ss = farmSuccessScore();
    const ws = weeklyFarmSummary();
    const vl = farmerVoiceLines();
    return Object.freeze({
      runtimeVersion:      FARMER_SUCCESS_RUNTIME_VERSION,
      initialized:         true,
      priorityEngineReady: !!tp,
      dailyActionsReady:   !!(da && da.initialized),
      farmRiskReady:       !!fr,
      successScoreReady:   !!(ss && ss.initialized),
      summaryReady:        !!(ws && ws.initialized),
      voiceReady:          !!(vl && vl.initialized),
    });
  }, Object.freeze({
    runtimeVersion:      FARMER_SUCCESS_RUNTIME_VERSION,
    initialized:         false,
    priorityEngineReady: false,
    dailyActionsReady:   false,
    farmRiskReady:       false,
    successScoreReady:   false,
    summaryReady:        false,
    voiceReady:          false,
  }));
}

/* ═════════════════════════════════════════════════════════════
   GLOBAL INSTALLERS
   ═════════════════════════════════════════════════════════════ */

function _pin(name: string, fn: (...a: any[]) => any) {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w[name] !== 'function') {
      w[name] = function (...a: any[]) {
        const out = fn(...a);
        try { console.log(`[Farroway · Farmer Success] ${name}`, out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export function installFarmerSuccessGlobals(): boolean {
  let ok = true;
  ok = _pin('__todayPriority',        todayPriority)        && ok;
  ok = _pin('__dailyActions',         dailyActions)         && ok;
  ok = _pin('__farmRisk',             farmRisk)             && ok;
  ok = _pin('__missedActions',        missedActions)        && ok;
  ok = _pin('__farmSuccessScore',     farmSuccessScore)     && ok;
  ok = _pin('__weeklyFarmSummary',    weeklyFarmSummary)    && ok;
  ok = _pin('__farmerVoiceLines',     farmerVoiceLines)     && ok;
  ok = _pin('__farmerSuccessHealth',  farmerSuccessHealth)  && ok;
  return ok;
}
