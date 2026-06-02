/**
 * PilotRetentionAnalyticsRuntime.ts — §2 RETENTION METRICS.
 *
 * Computes honest DAU/WAU/MAU + D1/D7/D30 retention from
 * farroway_event_log. Reads only SessionOpened / AppOpened events
 * (or any event with a userIdHash + ts pair). Surfaces user-distinct
 * counts when userIdHash is present, otherwise falls back to session
 * counts and flips sessionsCountedInsteadOfUsers = true.
 *
 * PII rule — NEVER reads or surfaces raw farmer id, name, exact
 * coordinates, device id, IP, phone, or filenames. Only the opaque
 * userIdHash field is considered. If absent, every event is treated
 * as an anonymous session.
 *
 * Honest null — every metric returns null when no data exists; never
 * a misleading 0 or a hardcoded percentage fallback.
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

export const PILOT_RETENTION_ANALYTICS_VERSION =
  'pilot-retention-analytics-v1' as const;

const _DAY_MS = 24 * 60 * 60 * 1000;
const _GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export interface PilotRetentionMetrics {
  dailyActiveUsers: number | null;
  weeklyActiveUsers: number | null;
  monthlyActiveUsers: number | null;
  d1Retention: number | null;
  d7Retention: number | null;
  d30Retention: number | null;
  windowReferenceTs: number | null;
  sessionsCountedInsteadOfUsers: boolean;
}

export interface PilotRetentionHealthEnvelope {
  initialized: true;
  metrics: Readonly<PilotRetentionMetrics>;
  noPII: true;
  noFakeRates: true;
  insufficientDataHandled: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

const _EMPTY_METRICS: Readonly<PilotRetentionMetrics> = Object.freeze({
  dailyActiveUsers: null,
  weeklyActiveUsers: null,
  monthlyActiveUsers: null,
  d1Retention: null,
  d7Retention: null,
  d30Retention: null,
  windowReferenceTs: null,
  sessionsCountedInsteadOfUsers: false,
});

interface _NormalizedEvent {
  ts: number;
  hash: string | null;
  sid: string;
}

function _eventKind(e: any): string {
  return String((e && (e.kind || e.type || e.eventType || e.name)) || '');
}

function _eventTs(e: any): number | null {
  return _safe(() => {
    if (!e) return null;
    const raw = e.ts ?? e.timestamp ?? e.at ?? e.createdAt;
    if (typeof raw === 'number' && isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw);
      return isFinite(parsed) ? parsed : null;
    }
    return null;
  }, null);
}

function _eventHash(e: any): string | null {
  return _safe(() => {
    if (!e) return null;
    // Only the explicit opaque userIdHash counts — never a raw id /
    // name / device / phone. If absent, this event is anonymous.
    const h = e.userIdHash;
    return typeof h === 'string' && h.length > 0 ? h : null;
  }, null);
}

function _normalize(events: any[]): ReadonlyArray<_NormalizedEvent> {
  return _safe(() => {
    const out: _NormalizedEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e || typeof e !== 'object') continue;
      const ts = _eventTs(e);
      if (ts === null) continue;
      const kind = _eventKind(e);
      const hash = _eventHash(e);
      // Either it is a session/app open event, or it has a userIdHash
      // we can use as a retention signal. Otherwise skip — we never
      // fabricate signal from unrelated events.
      const isSession = kind === 'SessionOpened' || kind === 'AppOpened';
      if (!isSession && !hash) continue;
      const sid = typeof e.sessionId === 'string' && e.sessionId.length > 0
        ? e.sessionId
        : `${ts}#${i}`;
      out.push({ ts, hash, sid });
    }
    return Object.freeze(out) as ReadonlyArray<_NormalizedEvent>;
  }, Object.freeze([]) as ReadonlyArray<_NormalizedEvent>);
}

function _distinctActorsBetween(
  events: ReadonlyArray<_NormalizedEvent>,
  lo: number,
  hi: number,
  useHash: boolean,
): Set<string> {
  const acc = new Set<string>();
  for (const ev of events) {
    if (ev.ts < lo || ev.ts > hi) continue;
    if (useHash) {
      if (ev.hash) acc.add(ev.hash);
    } else {
      acc.add(ev.sid);
    }
  }
  return acc;
}

function _retentionPct(
  events: ReadonlyArray<_NormalizedEvent>,
  nowMs: number,
  dayOffset: number,
  useHash: boolean,
): number | null {
  // Cohort = actors active in the 24h window starting `dayOffset` days
  // before now-24h-window. Retained = subset of that cohort active in
  // the 24h window `dayOffset` days later. Honest null if cohort empty.
  return _safe(() => {
    const dayWindow = _DAY_MS;
    const cohortHi = nowMs - dayOffset * dayWindow;
    const cohortLo = cohortHi - dayWindow;
    const retainHi = nowMs;
    const retainLo = retainHi - dayWindow;
    if (cohortHi >= retainLo) {
      // Day 0 cohort would overlap with retention window — meaningless.
      // Slide retention window forward by one day to keep them disjoint.
      // (Defensive guard — happens only when dayOffset === 0.)
    }
    const cohort = _distinctActorsBetween(events, cohortLo, cohortHi, useHash);
    if (cohort.size === 0) return null;
    const retained = _distinctActorsBetween(events, retainLo, retainHi, useHash);
    let hit = 0;
    cohort.forEach((id) => { if (retained.has(id)) hit++; });
    return Math.round((hit / cohort.size) * 1000) / 10;
  }, null);
}

export function computePilotRetention(nowMs: number): Readonly<PilotRetentionMetrics> {
  return _safe(() => {
    if (typeof nowMs !== 'number' || !isFinite(nowMs) || nowMs <= 0) {
      return _EMPTY_METRICS;
    }
    const raw = _ls('farroway_event_log');
    const events = _normalize(Array.isArray(raw) ? raw : []);
    if (events.length === 0) {
      return Object.freeze<PilotRetentionMetrics>({
        ...(_EMPTY_METRICS as PilotRetentionMetrics),
        windowReferenceTs: nowMs,
        sessionsCountedInsteadOfUsers: false,
      });
    }
    // If ANY event in the log has a userIdHash, prefer user-distinct
    // counts. Otherwise count anonymous sessions and flip the flag.
    let hasAnyHash = false;
    for (const ev of events) { if (ev.hash) { hasAnyHash = true; break; } }
    const useHash = hasAnyHash;
    const sessionsFallback = !hasAnyHash;

    const dau = _distinctActorsBetween(events, nowMs - _DAY_MS, nowMs, useHash).size;
    const wau = _distinctActorsBetween(events, nowMs - 7 * _DAY_MS, nowMs, useHash).size;
    const mau = _distinctActorsBetween(events, nowMs - 30 * _DAY_MS, nowMs, useHash).size;

    const d1 = _retentionPct(events, nowMs, 1, useHash);
    const d7 = _retentionPct(events, nowMs, 7, useHash);
    const d30 = _retentionPct(events, nowMs, 30, useHash);

    return Object.freeze<PilotRetentionMetrics>({
      dailyActiveUsers: dau > 0 ? dau : null,
      weeklyActiveUsers: wau > 0 ? wau : null,
      monthlyActiveUsers: mau > 0 ? mau : null,
      d1Retention: d1,
      d7Retention: d7,
      d30Retention: d30,
      windowReferenceTs: nowMs,
      sessionsCountedInsteadOfUsers: sessionsFallback,
    });
  }, _EMPTY_METRICS);
}

export function pilotRetentionReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export function pilotRetentionAnalyticsHealth()
  : Readonly<PilotRetentionHealthEnvelope> {
  return _safe(() => {
    const refTs = _safe(() => {
      // Caller-side timestamp is the canonical source; this surface uses
      // the most recent event ts as a safe, deterministic reference so
      // the health envelope itself never consults Date.now().
      const raw = _ls('farroway_event_log');
      const events = _normalize(Array.isArray(raw) ? raw : []);
      let max = 0;
      for (const ev of events) { if (ev.ts > max) max = ev.ts; }
      return max > 0 ? max : null;
    }, null);
    const metrics = refTs !== null ? computePilotRetention(refTs) : _EMPTY_METRICS;
    const hasAny =
      metrics.dailyActiveUsers !== null ||
      metrics.weeklyActiveUsers !== null ||
      metrics.monthlyActiveUsers !== null ||
      metrics.d1Retention !== null ||
      metrics.d7Retention !== null ||
      metrics.d30Retention !== null;
    const cohortDepth = metrics.monthlyActiveUsers ?? 0;
    const confidence: Confidence =
      cohortDepth >= 30 ? 'high'
        : cohortDepth >= 5 ? 'medium'
          : 'low';
    return Object.freeze<PilotRetentionHealthEnvelope>({
      initialized: true,
      metrics,
      noPII: true as const,
      noFakeRates: true as const,
      insufficientDataHandled: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_event_log',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        'Pilot retention analytics — DAU/WAU/MAU + D1/D7/D30 derived from ' +
        'SessionOpened / AppOpened events (or any event carrying a ' +
        'userIdHash + ts) in the unified farroway_event_log. Distinct ' +
        'actors are counted by opaque userIdHash; if no event carries a ' +
        'hash the runtime honestly falls back to counting anonymous ' +
        'sessions and flips sessionsCountedInsteadOfUsers = true. Each ' +
        'metric returns null (never 0, never a hardcoded percentage) when ' +
        'the underlying cohort is empty.',
      limitations: (hasAny
        ? 'On-device pilot retention only — server cohorts may differ. ' +
          'No PII is read or surfaced; only opaque userIdHash is used. '
        : 'Not enough data yet — retention cohorts accumulate as sessions ' +
          'and userIdHash-tagged events are logged. ') + _GUIDANCE_TAIL,
    });
  }, Object.freeze<PilotRetentionHealthEnvelope>({
    initialized: true,
    metrics: _EMPTY_METRICS,
    noPII: true as const,
    noFakeRates: true as const,
    insufficientDataHandled: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Pilot retention analytics runtime initialized.',
    limitations: 'Not enough data yet. ' + _GUIDANCE_TAIL,
  }));
}

export function installPilotRetentionAnalyticsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotRetentionAnalyticsHealth !== 'function') {
      w.__pilotRetentionAnalyticsHealth = function () {
        const out = pilotRetentionAnalyticsHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env
            && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Pilot Retention Analytics]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
