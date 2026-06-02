/**
 * PilotFieldTestSessionRuntime.ts — §10 FIELD TEST MODE.
 *
 * Tracks pilot field-test sessions: session length, tasks completed,
 * scans completed, outcomes recorded, abandonment point. Persists to
 * localStorage 'farroway_pilot_field_sessions' (bounded 50).
 *
 * No PII: stores only session ids, counts, timestamps, and an
 * abandonment-point label (a screen / route tag — never a farmer id,
 * name, coords, device id, IP, phone, or exact filename).
 *
 * Self-contained: zero imports. Never throws. Time is caller-supplied.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _lsWrite(key: string, value: unknown): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  }, false);
}

type Confidence = 'low' | 'medium' | 'high';

export const PILOT_FIELD_TEST_SESSION_VERSION = 'pilot-field-test-session-v1' as const;
const STORAGE_KEY = 'farroway_pilot_field_sessions';
const MAX_SESSIONS = 50;
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export interface PilotFieldSession {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  lengthMs: number | null;
  tasksCompleted: number;
  scansCompleted: number;
  outcomesRecorded: number;
  abandonmentPoint: string | null;
}

export interface PilotFieldTestSessionHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  activeSessionCount: number;
  totalSessions: number;
  averageLengthMs: number | null;
  mostCommonAbandonmentPoint: string | null;
  noPII: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

function _readSessions(): PilotFieldSession[] {
  return _safe(() => {
    const raw = _ls(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    const out: PilotFieldSession[] = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') continue;
      const sessionId = typeof r.sessionId === 'string' ? r.sessionId : null;
      const startedAt = typeof r.startedAt === 'number' && isFinite(r.startedAt) ? r.startedAt : null;
      if (!sessionId || startedAt === null) continue;
      const endedAt = typeof r.endedAt === 'number' && isFinite(r.endedAt) ? r.endedAt : null;
      const lengthMs = typeof r.lengthMs === 'number' && isFinite(r.lengthMs) ? r.lengthMs : null;
      const tasksCompleted = typeof r.tasksCompleted === 'number' && isFinite(r.tasksCompleted) ? r.tasksCompleted : 0;
      const scansCompleted = typeof r.scansCompleted === 'number' && isFinite(r.scansCompleted) ? r.scansCompleted : 0;
      const outcomesRecorded = typeof r.outcomesRecorded === 'number' && isFinite(r.outcomesRecorded) ? r.outcomesRecorded : 0;
      const abandonmentPoint = typeof r.abandonmentPoint === 'string' && r.abandonmentPoint ? r.abandonmentPoint : null;
      out.push({
        sessionId,
        startedAt,
        endedAt,
        lengthMs,
        tasksCompleted,
        scansCompleted,
        outcomesRecorded,
        abandonmentPoint,
      });
    }
    return out;
  }, []);
}

function _writeSessions(list: PilotFieldSession[]): boolean {
  return _safe(() => {
    const bounded = list.length > MAX_SESSIONS ? list.slice(list.length - MAX_SESSIONS) : list;
    return _lsWrite(STORAGE_KEY, bounded);
  }, false);
}

export function startFieldSession(sessionId: string, nowMs: number): boolean {
  return _safe(() => {
    if (typeof sessionId !== 'string' || !sessionId) return false;
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    const list = _readSessions();
    // Reject duplicate sessionId.
    for (const s of list) if (s.sessionId === sessionId) return false;
    list.push({
      sessionId,
      startedAt: nowMs,
      endedAt: null,
      lengthMs: null,
      tasksCompleted: 0,
      scansCompleted: 0,
      outcomesRecorded: 0,
      abandonmentPoint: null,
    });
    return _writeSessions(list);
  }, false);
}

export function tickFieldSession(
  sessionId: string,
  partial: Partial<{
    tasksCompleted: number;
    scansCompleted: number;
    outcomesRecorded: number;
    abandonmentPoint: string;
  }>,
): boolean {
  return _safe(() => {
    if (typeof sessionId !== 'string' || !sessionId) return false;
    if (!partial || typeof partial !== 'object') return false;
    const list = _readSessions();
    let found = false;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.sessionId !== sessionId) continue;
      found = true;
      const next: PilotFieldSession = {
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        lengthMs: s.lengthMs,
        tasksCompleted: typeof partial.tasksCompleted === 'number' && isFinite(partial.tasksCompleted)
          ? partial.tasksCompleted : s.tasksCompleted,
        scansCompleted: typeof partial.scansCompleted === 'number' && isFinite(partial.scansCompleted)
          ? partial.scansCompleted : s.scansCompleted,
        outcomesRecorded: typeof partial.outcomesRecorded === 'number' && isFinite(partial.outcomesRecorded)
          ? partial.outcomesRecorded : s.outcomesRecorded,
        abandonmentPoint: typeof partial.abandonmentPoint === 'string' && partial.abandonmentPoint
          ? partial.abandonmentPoint : s.abandonmentPoint,
      };
      list[i] = next;
      break;
    }
    if (!found) return false;
    return _writeSessions(list);
  }, false);
}

export function endFieldSession(sessionId: string, nowMs: number): boolean {
  return _safe(() => {
    if (typeof sessionId !== 'string' || !sessionId) return false;
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    const list = _readSessions();
    let found = false;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.sessionId !== sessionId) continue;
      found = true;
      if (s.endedAt !== null) return false; // already ended
      const lengthMs = nowMs >= s.startedAt ? nowMs - s.startedAt : 0;
      list[i] = {
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        endedAt: nowMs,
        lengthMs,
        tasksCompleted: s.tasksCompleted,
        scansCompleted: s.scansCompleted,
        outcomesRecorded: s.outcomesRecorded,
        abandonmentPoint: s.abandonmentPoint,
      };
      break;
    }
    if (!found) return false;
    return _writeSessions(list);
  }, false);
}

export function listFieldSessions(limit = 20): ReadonlyArray<Readonly<PilotFieldSession>> {
  return _safe(() => {
    const list = _readSessions();
    const n = typeof limit === 'number' && isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
    const sliced = list.slice(Math.max(0, list.length - n));
    return Object.freeze(sliced.map((s) => Object.freeze({ ...s }))) as ReadonlyArray<Readonly<PilotFieldSession>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<PilotFieldSession>>);
}

export function fieldTestSessionReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

function _computeAverageLengthMs(list: PilotFieldSession[]): number | null {
  return _safe(() => {
    const lengths: number[] = [];
    for (const s of list) {
      if (typeof s.lengthMs === 'number' && isFinite(s.lengthMs) && s.lengthMs >= 0) {
        lengths.push(s.lengthMs);
      }
    }
    if (lengths.length === 0) return null;
    let sum = 0;
    for (const l of lengths) sum += l;
    return Math.round(sum / lengths.length);
  }, null);
}

function _computeMostCommonAbandonmentPoint(list: PilotFieldSession[]): string | null {
  return _safe(() => {
    const counts: Record<string, number> = {};
    for (const s of list) {
      if (typeof s.abandonmentPoint === 'string' && s.abandonmentPoint) {
        counts[s.abandonmentPoint] = (counts[s.abandonmentPoint] || 0) + 1;
      }
    }
    let top: string | null = null;
    let topCount = 0;
    for (const k of Object.keys(counts)) {
      if (counts[k] > topCount) {
        topCount = counts[k];
        top = k;
      }
    }
    return top;
  }, null);
}

const _EMPTY_HEALTH: Readonly<PilotFieldTestSessionHealthEnvelope> = Object.freeze({
  initialized: true,
  storageReady: false,
  activeSessionCount: 0,
  totalSessions: 0,
  averageLengthMs: null,
  mostCommonAbandonmentPoint: null,
  noPII: true as const,
  composedFrom: Object.freeze([]) as ReadonlyArray<string>,
  confidence: 'low' as Confidence,
  explanation: 'Pilot field-test session runtime initialized.',
  limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
});

export function pilotFieldTestSessionHealth(): Readonly<PilotFieldTestSessionHealthEnvelope> {
  return _safe(() => {
    const storageReady = fieldTestSessionReady();
    const list = _readSessions();
    const totalSessions = list.length;
    let activeSessionCount = 0;
    for (const s of list) if (s.endedAt === null) activeSessionCount++;
    const averageLengthMs = _computeAverageLengthMs(list);
    const mostCommonAbandonmentPoint = _computeMostCommonAbandonmentPoint(list);

    const confidence: Confidence =
      totalSessions >= 5 ? 'high'
        : totalSessions >= 1 ? 'medium' : 'low';

    return Object.freeze<PilotFieldTestSessionHealthEnvelope>({
      initialized: true,
      storageReady,
      activeSessionCount,
      totalSessions,
      averageLengthMs,
      mostCommonAbandonmentPoint,
      noPII: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_pilot_field_sessions',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        '§10 Field Test Mode — tracks pilot field sessions. Persists ' +
        'session id, start/end timestamps, length, tasks completed, scans ' +
        'completed, outcomes recorded, and abandonment point (a screen / ' +
        'route tag, never PII). Bounded to 50 most recent sessions. ' +
        'averageLengthMs averages ended sessions only (null when none). ' +
        'mostCommonAbandonmentPoint surfaces the top abandonment label ' +
        '(null when none recorded).',
      limitations:
        'Field-session counts reflect persisted local sessions only; no ' +
        'PII is stored or surfaced. ' + GUIDANCE_TAIL,
    });
  }, _EMPTY_HEALTH);
}

export function installPilotFieldTestSessionGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotFieldTestSessionHealth !== 'function') {
      w.__pilotFieldTestSessionHealth = function () {
        const out = pilotFieldTestSessionHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Pilot Field Test Session Health]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
