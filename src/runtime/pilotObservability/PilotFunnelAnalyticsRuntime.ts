/**
 * PilotFunnelAnalyticsRuntime.ts — §5 FUNNEL ANALYTICS.
 *
 * 10-stage Signup → Sell funnel with honest counts + drop-off
 * percentages between consecutive stages. Reads farroway_event_log
 * entries by kind (plus farroway_scan_outcome_log as a secondary
 * source for the outcomeRecorded stage):
 *
 *   signup          ← 'UserSignedUp'
 *   onboarding      ← 'OnboardingCompleted'
 *   farmCreated     ← 'FarmCreated'
 *   cropAdded       ← 'CropAdded'
 *   taskStarted     ← 'TaskStarted'
 *   taskCompleted   ← 'TaskCompleted' OR 'SimpleActionCompleted'
 *   scanCompleted   ← 'ScanCompleted'
 *   outcomeRecorded ← 'OutcomeRecorded' OR a scan_outcome_log entry
 *   harvest         ← 'HarvestEvent' OR 'HarvestReady'
 *   sell            ← 'ListingCreated' OR 'SoldEvent'
 *
 * dropOffFromPrevPct is null when the previous stage count is 0
 * (honest NEEDS_DATA — never a misleading 0%). The biggest drop-off
 * is surfaced as an index + percentage to help find weakest stages.
 * No PII is stored or surfaced — only kinds and counts.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

export const PILOT_FUNNEL_ANALYTICS_VERSION = 'pilot-funnel-analytics-v1' as const;

export interface FunnelStage {
  kind: string;
  label: string;
  count: number;
  dropOffFromPrevPct: number | null;
}

export interface PilotFunnel {
  stages: ReadonlyArray<Readonly<FunnelStage>>;
  biggestDropOffIndex: number | null;
  biggestDropOffPct: number | null;
}

export interface PilotFunnelHealthEnvelope {
  initialized: true;
  funnel: Readonly<PilotFunnel>;
  noFakeStages: true;
  noPII: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

interface StageDef {
  kind: string;
  label: string;
  match: (e: any) => boolean;
}

const _STAGE_DEFS: ReadonlyArray<StageDef> = Object.freeze([
  { kind: 'signup',          label: 'Signup',           match: (e) => e && e.kind === 'UserSignedUp' },
  { kind: 'onboarding',      label: 'Onboarding',       match: (e) => e && e.kind === 'OnboardingCompleted' },
  { kind: 'farmCreated',     label: 'Farm Created',     match: (e) => e && e.kind === 'FarmCreated' },
  { kind: 'cropAdded',       label: 'Crop Added',       match: (e) => e && e.kind === 'CropAdded' },
  { kind: 'taskStarted',     label: 'Task Started',     match: (e) => e && e.kind === 'TaskStarted' },
  { kind: 'taskCompleted',   label: 'Task Completed',   match: (e) => e && (e.kind === 'TaskCompleted' || e.kind === 'SimpleActionCompleted') },
  { kind: 'scanCompleted',   label: 'Scan Completed',   match: (e) => e && e.kind === 'ScanCompleted' },
  { kind: 'outcomeRecorded', label: 'Outcome Recorded', match: (e) => e && e.kind === 'OutcomeRecorded' },
  { kind: 'harvest',         label: 'Harvest',          match: (e) => e && (e.kind === 'HarvestEvent' || e.kind === 'HarvestReady') },
  { kind: 'sell',            label: 'Sell',             match: (e) => e && (e.kind === 'ListingCreated' || e.kind === 'SoldEvent') },
]);

const _EMPTY_STAGES: ReadonlyArray<Readonly<FunnelStage>> = Object.freeze(
  _STAGE_DEFS.map((d) =>
    Object.freeze<FunnelStage>({
      kind: d.kind,
      label: d.label,
      count: 0,
      dropOffFromPrevPct: null,
    }),
  ),
);

const _EMPTY_FUNNEL: Readonly<PilotFunnel> = Object.freeze({
  stages: _EMPTY_STAGES,
  biggestDropOffIndex: null,
  biggestDropOffPct: null,
});

export function computePilotFunnel(): Readonly<PilotFunnel> {
  return _safe(() => {
    const eventLog = _ls('farroway_event_log');
    const outcomeLog = _ls('farroway_scan_outcome_log');
    const events: any[] = Array.isArray(eventLog) ? eventLog : [];
    const outcomes: any[] = Array.isArray(outcomeLog) ? outcomeLog : [];

    // Honest scan_outcome_log count — only canonical verdicts.
    const outcomeLogCount = outcomes.filter((o: any) => {
      if (!o) return false;
      const v = typeof o.verdict === 'string' ? o.verdict.toLowerCase() : '';
      return v === 'better' || v === 'same' || v === 'worse';
    }).length;

    const counts: number[] = _STAGE_DEFS.map((def) => {
      let n = 0;
      for (const e of events) if (def.match(e)) n++;
      // outcomeRecorded — fold in scan_outcome_log entries as well.
      if (def.kind === 'outcomeRecorded') n = Math.max(n, outcomeLogCount);
      return n;
    });

    const stages: ReadonlyArray<Readonly<FunnelStage>> = Object.freeze(
      _STAGE_DEFS.map((def, i) => {
        const count = counts[i];
        const prev = i > 0 ? counts[i - 1] : null;
        // dropOffFromPrevPct null when prev is 0 (honest NEEDS_DATA,
        // never a misleading 0% or 100%). First stage is always null.
        let dropOffFromPrevPct: number | null = null;
        if (i > 0 && prev !== null && prev > 0) {
          const lost = Math.max(0, prev - count);
          dropOffFromPrevPct = Math.round((lost / prev) * 1000) / 10;
        }
        return Object.freeze<FunnelStage>({
          kind: def.kind,
          label: def.label,
          count,
          dropOffFromPrevPct,
        });
      }),
    );

    let biggestDropOffIndex: number | null = null;
    let biggestDropOffPct: number | null = null;
    for (let i = 1; i < stages.length; i++) {
      const d = stages[i].dropOffFromPrevPct;
      if (d === null) continue;
      if (biggestDropOffPct === null || d > biggestDropOffPct) {
        biggestDropOffPct = d;
        biggestDropOffIndex = i;
      }
    }

    return Object.freeze<PilotFunnel>({
      stages,
      biggestDropOffIndex,
      biggestDropOffPct,
    });
  }, _EMPTY_FUNNEL);
}

export function pilotFunnelReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function pilotFunnelAnalyticsHealth(): Readonly<PilotFunnelHealthEnvelope> {
  return _safe(() => {
    const funnel = computePilotFunnel();
    const signupCount = funnel.stages.length > 0 ? funnel.stages[0].count : 0;
    const sellCount = funnel.stages.length > 0
      ? funnel.stages[funnel.stages.length - 1].count
      : 0;
    const confidence: Confidence =
      signupCount >= 20 ? 'high'
        : signupCount >= 5 ? 'medium'
          : 'low';
    return Object.freeze<PilotFunnelHealthEnvelope>({
      initialized: true,
      funnel,
      noFakeStages: true as const,
      noPII: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_event_log',
        'localStorage:farroway_scan_outcome_log',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        '§5 funnel analytics — 10 honest stages from Signup to Sell, ' +
        'derived from farroway_event_log kinds plus farroway_scan_outcome_log ' +
        'for the outcomeRecorded stage. Drop-off percentages compare each ' +
        'stage to the previous; null when the previous stage count is 0 ' +
        '(honest NEEDS_DATA, never a misleading 0%). biggestDropOffIndex ' +
        'surfaces the weakest transition. Counts are aggregate kinds only — ' +
        'no farmer id, name, coords, device id, IP, phone, or filename. ' +
        'sellCount=' + sellCount + ', signupCount=' + signupCount + '.',
      limitations:
        'Funnel counts reflect persisted on-device event-log artifacts only; ' +
        'empty values mean no data, never fabricated. Stages are linear ' +
        'reference markers — a farmer may legitimately skip a stage (e.g. ' +
        'recording an outcome before a follow-up scan). Decision support, not a guarantee.',
    });
  }, Object.freeze<PilotFunnelHealthEnvelope>({
    initialized: true,
    funnel: _EMPTY_FUNNEL,
    noFakeStages: true as const,
    noPII: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Pilot funnel analytics runtime initialized.',
    limitations: 'Not enough data yet. Decision support, not a guarantee.',
  }));
}

export function installPilotFunnelAnalyticsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotFunnelAnalyticsHealth !== 'function') {
      w.__pilotFunnelAnalyticsHealth = function () {
        const out = pilotFunnelAnalyticsHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Pilot Funnel Analytics]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__pilotFunnel !== 'function') {
      w.__pilotFunnel = function () {
        const out = computePilotFunnel();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Pilot Funnel]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
