/**
 * ScanOutcomeLoopRuntime.ts — §PHASE 8.
 *
 * Outcome capture (Better / Same / Worse) when a follow-up task
 * completes. Writes a bounded, idempotent log to localStorage so the
 * outcome loop can compute trends without fabricating data.
 *
 * Hard rules (spec):
 *   • Never invents an outcome — only records what the caller asserts.
 *   • Bounded to last 200 entries (newest wins on overflow).
 *   • Idempotent on (scanId, taskId) — re-recording overwrites in place.
 *   • Time source is caller-supplied (nowMs); this file imports nothing
 *     beyond ScanAccuracyContracts and never reads Date.now().
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export type OutcomeVerdict = 'better' | 'same' | 'worse';

export interface ScanOutcomeRecord {
  scanId: string;
  taskId: string;
  verdict: OutcomeVerdict;
  recordedAt: number;
}

export interface ScanOutcomeLoopHealth {
  initialized: true;
  outcomeLoopReady: boolean;
  storageReady: boolean;
  recordedCount: number;
  noFakeOutcomes: true;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

const STORAGE_KEY = 'farroway_scan_outcome_log';
const MAX_ENTRIES = 200;

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _lsWrite(key: string, value: any): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  }, false);
}

function _isVerdict(v: any): v is OutcomeVerdict {
  return v === 'better' || v === 'same' || v === 'worse';
}

function _isWellFormed(e: any): e is ScanOutcomeRecord {
  return !!e
    && typeof e.scanId === 'string' && e.scanId.length > 0
    && typeof e.taskId === 'string' && e.taskId.length > 0
    && _isVerdict(e.verdict)
    && typeof e.recordedAt === 'number' && isFinite(e.recordedAt);
}

function _readAll(): ScanOutcomeRecord[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter(_isWellFormed);
  }, [] as ScanOutcomeRecord[]);
}

/** Persist a new outcome record. Returns true on a successful write.
 *  Idempotent on (scanId, taskId) — an existing entry is overwritten
 *  in place rather than duplicated. Caller supplies the timestamp. */
export function recordScanOutcome(
  scanId: string,
  taskId: string,
  verdict: OutcomeVerdict,
  nowMs: number,
): boolean {
  return _safe(() => {
    if (typeof scanId !== 'string' || scanId.length === 0) return false;
    if (typeof taskId !== 'string' || taskId.length === 0) return false;
    if (!_isVerdict(verdict)) return false;
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    if (typeof window === 'undefined' || !window.localStorage) return false;

    const all = _readAll();
    const next: ScanOutcomeRecord = {
      scanId, taskId, verdict, recordedAt: nowMs,
    };

    // Idempotent on (scanId, taskId) — replace in place if present.
    const existingIdx = all.findIndex(
      (e) => e.scanId === scanId && e.taskId === taskId,
    );
    if (existingIdx >= 0) {
      all[existingIdx] = next;
    } else {
      all.push(next);
    }

    // Bound to last MAX_ENTRIES by recordedAt (newest wins on overflow).
    all.sort((a, b) => a.recordedAt - b.recordedAt);
    const trimmed = all.length > MAX_ENTRIES
      ? all.slice(all.length - MAX_ENTRIES)
      : all;

    return _lsWrite(STORAGE_KEY, trimmed);
  }, false);
}

/** Read the outcome log, newest-first, filtered to well-formed entries.
 *  Default limit = 20. Returned envelope and entries are frozen. */
export function listScanOutcomes(
  limit: number = 20,
): ReadonlyArray<Readonly<ScanOutcomeRecord>> {
  return _safe(() => {
    const cap = (typeof limit === 'number' && isFinite(limit) && limit > 0)
      ? Math.floor(limit) : 20;
    const all = _readAll();
    all.sort((a, b) => b.recordedAt - a.recordedAt);
    const sliced = all.slice(0, cap).map((e) => Object.freeze<ScanOutcomeRecord>({
      scanId: e.scanId,
      taskId: e.taskId,
      verdict: e.verdict,
      recordedAt: e.recordedAt,
    }));
    return Object.freeze(sliced) as ReadonlyArray<Readonly<ScanOutcomeRecord>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<ScanOutcomeRecord>>);
}

/** Most-recent outcome for a given scan, or null if none. */
export function outcomeForScan(scanId: string): Readonly<ScanOutcomeRecord> | null {
  return _safe(() => {
    if (typeof scanId !== 'string' || scanId.length === 0) return null;
    const all = _readAll().filter((e) => e.scanId === scanId);
    if (all.length === 0) return null;
    all.sort((a, b) => b.recordedAt - a.recordedAt);
    const top = all[0];
    return Object.freeze<ScanOutcomeRecord>({
      scanId: top.scanId,
      taskId: top.taskId,
      verdict: top.verdict,
      recordedAt: top.recordedAt,
    });
  }, null);
}

/** True when localStorage is reachable. */
export function outcomeLoopReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function scanOutcomeLoopHealth(): Readonly<ScanOutcomeLoopHealth> {
  return _safe(() => {
    const storageReady = outcomeLoopReady();
    const all = storageReady ? _readAll() : [];
    const recordedCount = all.length;
    const confidence: 'low' | 'medium' | 'high' =
      !storageReady ? 'low'
        : recordedCount >= 25 ? 'high'
          : recordedCount >= 5 ? 'medium' : 'low';
    return Object.freeze<ScanOutcomeLoopHealth>({
      initialized: true,
      outcomeLoopReady: storageReady,
      storageReady,
      recordedCount,
      noFakeOutcomes: true as const,
      confidence,
      explanation:
        'Outcome loop captures Better/Same/Worse verdicts after follow-up tasks ' +
        'complete. Records are persisted to localStorage (bounded to the last 200 '
        + 'entries, idempotent on scan+task), never fabricated. The loop only '
        + 'reports what the user or caller asserts.',
      limitations:
        'Outcome data lives in the browser only; clearing site data wipes the log. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanOutcomeLoopHealth>({
    initialized: true,
    outcomeLoopReady: false,
    storageReady: false,
    recordedCount: 0,
    noFakeOutcomes: true as const,
    confidence: 'low',
    explanation: 'Scan outcome loop runtime initialized.',
    limitations: 'Outcome loop probe threw. ' + GUIDANCE_TAIL,
  }));
}

export function installScanOutcomeLoopGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanOutcomeLoopHealth !== 'function') {
      w.__scanOutcomeLoopHealth = function () {
        const out = scanOutcomeLoopHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Scan Outcome Loop]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
