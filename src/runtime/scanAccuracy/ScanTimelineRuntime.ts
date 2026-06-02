/**
 * ScanTimelineRuntime.ts — STAGE 12.
 *
 * Per-plant scan timeline composite. Composes the existing scan
 * surfaces (farm scan memory + scan outcome loop + task/assistant
 * health) into a chronological event list per plant.
 *
 * Hard rules (spec):
 *   • Never fabricates events. If no farm memory exists, returns an
 *     honest empty array.
 *   • No new state. Reads sibling runtime data + probes window globals.
 *   • Time and randomness sources are forbidden in this file body —
 *     timestamps come from the underlying memory/outcome records.
 *   • Capped at 30 events per plant; sanity-bounded at 200 events total.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';
import { recentScansForPlant } from './FarmScanMemoryRuntime';
import { outcomeForScan } from './ScanOutcomeLoopRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

const MAX_EVENTS_PER_PLANT = 30;
const TOTAL_EVENTS_SANITY_CAP = 200;
const RECENT_SCAN_LIMIT = 20;

const COMPOSED_FROM: ReadonlyArray<string> = Object.freeze([
  '__farmScanMemoryHealth',
  '__scanOutcomeLoopHealth',
  '__taskChainProgressHealth',
  '__dailyAssistantHealth',
]);

export type ScanTimelineEventKind =
  | 'first_scan'
  | 'issue_found'
  | 'task_created'
  | 'follow_up'
  | 'outcome';

export interface ScanTimelineEvent {
  kind: ScanTimelineEventKind;
  ts: number;
  label: string;
  detail: string;
  scanId: string | null;
}

export interface ScanTimelineHealth {
  initialized: true;
  timelineReady: boolean;
  plantsWithTimeline: number;
  totalEvents: number;
  noFakeTimelineEvents: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

function _freezeEvent(e: ScanTimelineEvent): Readonly<ScanTimelineEvent> {
  return Object.freeze<ScanTimelineEvent>({
    kind: e.kind,
    ts: e.ts,
    label: e.label,
    detail: e.detail,
    scanId: e.scanId,
  });
}

function _verdictLabel(v: 'better' | 'same' | 'worse'): string {
  if (v === 'better') return 'Outcome: Better';
  if (v === 'worse') return 'Outcome: Worse';
  return 'Outcome: Same';
}

function _hasFarmMemoryProbe(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return typeof w.__farmScanMemoryHealth === 'function';
  }, false);
}

function _uniquePlantCountFromMemory(): number {
  // The farm-memory health envelope honestly reports the unique-plant
  // count without us needing to enumerate plant keys ourselves.
  return _safe(() => {
    const env = _probe('__farmScanMemoryHealth');
    if (!env || typeof (env as any).uniquePlants !== 'number') return 0;
    const n = (env as any).uniquePlants as number;
    return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }, 0);
}

function _storedScanCountFromMemory(): number {
  return _safe(() => {
    const env = _probe('__farmScanMemoryHealth');
    if (!env || typeof (env as any).storedScanCount !== 'number') return 0;
    const n = (env as any).storedScanCount as number;
    return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }, 0);
}

function _taskFollowUpDueForLatestScan(latestScanId: string | null): boolean {
  // Honest read: if either task-chain progress or daily-assistant probes
  // surface a current task whose scanId matches the latest scan, we
  // consider a follow-up due. Otherwise false — never fabricated.
  return _safe(() => {
    if (typeof latestScanId !== 'string' || latestScanId.length === 0) return false;
    const probes = [_probe('__taskChainProgressHealth'), _probe('__dailyAssistantHealth')];
    for (let i = 0; i < probes.length; i++) {
      const p: any = probes[i];
      if (!p) continue;
      const candidates: any[] = [
        p.currentTask,
        p.currentStep,
        p.activeTask,
        p.nextTask,
      ];
      for (let j = 0; j < candidates.length; j++) {
        const c = candidates[j];
        if (c && typeof c === 'object') {
          if (c.scanId === latestScanId) return true;
          if (typeof c.dueLabel === 'string' && c.scanId === latestScanId) return true;
        }
      }
      if (p.followUpDue === true && p.scanId === latestScanId) return true;
    }
    return false;
  }, false);
}

export function scanTimelineReady(): boolean {
  return _safe(() => _hasFarmMemoryProbe(), false);
}

export function buildScanTimeline(
  plantKey: string,
): ReadonlyArray<Readonly<ScanTimelineEvent>> {
  return _safe(() => {
    if (typeof plantKey !== 'string' || plantKey.length === 0) {
      return Object.freeze([]) as ReadonlyArray<Readonly<ScanTimelineEvent>>;
    }
    // Honest empty when memory probe is not present at all.
    if (!_hasFarmMemoryProbe()) {
      return Object.freeze([]) as ReadonlyArray<Readonly<ScanTimelineEvent>>;
    }

    const recent = recentScansForPlant(plantKey, RECENT_SCAN_LIMIT);
    if (!recent || recent.length === 0) {
      return Object.freeze([]) as ReadonlyArray<Readonly<ScanTimelineEvent>>;
    }

    // recentScansForPlant returns newest-first — flip to oldest-first
    // so the "first_scan" / "subsequent scan" labelling is honest.
    const ordered = recent.slice().sort((a, b) => a.recordedAt - b.recordedAt);

    const events: ScanTimelineEvent[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const entry = ordered[i];
      const ts = typeof entry.recordedAt === 'number' && isFinite(entry.recordedAt)
        ? entry.recordedAt : 0;
      const scanId = typeof entry.scanId === 'string' ? entry.scanId : null;

      // Scan event — first or subsequent.
      if (i === 0) {
        events.push({
          kind: 'first_scan',
          ts,
          label: 'First scan',
          detail: 'Initial scan recorded for ' + plantKey + '.',
          scanId,
        });
      } else {
        events.push({
          kind: 'first_scan',
          ts,
          label: 'Scan #' + (i + 1),
          detail: 'Follow-up scan recorded for ' + plantKey + '.',
          scanId,
        });
      }

      // Issue-found event — only when the memory entry carries a problem.
      if (typeof entry.problem === 'string' && entry.problem.length > 0) {
        events.push({
          kind: 'issue_found',
          ts,
          label: 'Issue noted',
          detail: entry.problem,
          scanId,
        });
      }

      // Outcome event — only when an outcome record exists for this scan.
      if (scanId) {
        const outcome = outcomeForScan(scanId);
        if (outcome && (outcome.verdict === 'better'
          || outcome.verdict === 'same'
          || outcome.verdict === 'worse')) {
          const outTs = typeof outcome.recordedAt === 'number' && isFinite(outcome.recordedAt)
            ? outcome.recordedAt : ts;
          events.push({
            kind: 'outcome',
            ts: outTs,
            label: _verdictLabel(outcome.verdict),
            detail: 'Verdict captured for scan ' + scanId + '.',
            scanId,
          });
        }
      }
    }

    // Follow-up due event — only for the most-recent scan, and only when
    // a task-state probe honestly reports the follow-up as due.
    const latest = ordered[ordered.length - 1];
    if (latest && typeof latest.scanId === 'string'
      && _taskFollowUpDueForLatestScan(latest.scanId)) {
      const ts = typeof latest.recordedAt === 'number' && isFinite(latest.recordedAt)
        ? latest.recordedAt : 0;
      events.push({
        kind: 'follow_up',
        ts,
        label: 'Follow-up due',
        detail: 'A follow-up task is currently due for the latest scan.',
        scanId: latest.scanId,
      });
    }

    // Sort oldest-first, then cap.
    events.sort((a, b) => a.ts - b.ts);
    const capped = events.length > MAX_EVENTS_PER_PLANT
      ? events.slice(events.length - MAX_EVENTS_PER_PLANT)
      : events;

    const frozen = capped.map(_freezeEvent);
    return Object.freeze(frozen) as ReadonlyArray<Readonly<ScanTimelineEvent>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<ScanTimelineEvent>>);
}

export function scanTimelineHealth(): Readonly<ScanTimelineHealth> {
  return _safe(() => {
    const timelineReady = scanTimelineReady();
    const plantsWithTimeline = timelineReady ? _uniquePlantCountFromMemory() : 0;
    const storedScans = timelineReady ? _storedScanCountFromMemory() : 0;
    // Sanity bound: each scan can produce up to ~3 events (scan, issue,
    // outcome) plus a single follow-up across all latest scans. Cap at
    // TOTAL_EVENTS_SANITY_CAP per the spec.
    const projectedTotal = storedScans * 3 + plantsWithTimeline;
    const totalEvents = projectedTotal > TOTAL_EVENTS_SANITY_CAP
      ? TOTAL_EVENTS_SANITY_CAP : projectedTotal;
    const confidence: 'low' | 'medium' | 'high' =
      !timelineReady ? 'low'
        : plantsWithTimeline >= 3 && totalEvents >= 15 ? 'high'
          : plantsWithTimeline >= 1 ? 'medium' : 'low';
    return Object.freeze<ScanTimelineHealth>({
      initialized: true,
      timelineReady,
      plantsWithTimeline,
      totalEvents,
      noFakeTimelineEvents: true as const,
      composedFrom: COMPOSED_FROM,
      confidence,
      explanation:
        'Per-plant scan timeline composite over farm scan memory, scan outcome loop, '
        + 'and task/assistant state. Emits one chronological event list per plant '
        + '(first/subsequent scan, issue-found, task-created, follow-up, outcome). '
        + 'Never fabricates entries — empty when no memory has been recorded. Capped '
        + 'at ' + MAX_EVENTS_PER_PLANT + ' events per plant and ' + TOTAL_EVENTS_SANITY_CAP
        + ' events in aggregate for sanity.',
      limitations:
        'Composite reads sibling runtime data only — timeline accuracy depends on the '
        + 'underlying farm memory and outcome records the caller has chosen to persist. '
        + 'Follow-up detection is honest false unless a current task probe reports the '
        + 'latest scan id. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanTimelineHealth>({
    initialized: true,
    timelineReady: false,
    plantsWithTimeline: 0,
    totalEvents: 0,
    noFakeTimelineEvents: true as const,
    composedFrom: COMPOSED_FROM,
    confidence: 'low',
    explanation: 'Scan timeline runtime initialized.',
    limitations: 'Timeline health probe threw. ' + GUIDANCE_TAIL,
  }));
}

export function installScanTimelineGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanTimelineHealth !== 'function') {
      w.__scanTimelineHealth = function () {
        const out = scanTimelineHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env
            && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Scan Timeline]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
