/**
 * src/runtime/pilotObservability/PilotFeedbackRuntime.ts — §9 PILOT
 * FEEDBACK. Captures 1-5 rating + 3 free-text fields (confusing /
 * worked / improve) per pilot session and persists to localStorage
 * 'farroway_pilot_feedback_log'.
 *
 * Self-contained — ZERO imports. Never throws. PII-free: free-text
 * is sanitized at write time (emails stripped, 10+ digit runs
 * stripped) using the same patterns as PilotErrorMonitoringRuntime.
 *
 * Bounded list: 100 most-recent artifacts. Idempotent on the
 * (sessionId + submittedAt) composite key supplied by the caller.
 *
 *   recordPilotFeedback({ sessionId, rating, confusing, worked,
 *     improve, nowMs }) → boolean
 *   listPilotFeedback(limit = 20) → ReadonlyArray<...>
 *   sanitizeFeedbackText(text) → string (exported for gate)
 *   pilotFeedbackReady() → boolean
 *   pilotFeedbackHealth() → frozen envelope
 *   installPilotFeedbackGlobal() → pins window.__pilotFeedbackHealth
 *
 * Time/randomness are forbidden in the file body — callers supply
 * `nowMs`. averageRating is null when no feedback exists (honest
 * NEEDS_DATA, never a misleading 0.0). Limitations tail ends with
 * "Decision support, not a guarantee."
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

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

const FEEDBACK_KEY = 'farroway_pilot_feedback_log';
const MAX_ENTRIES = 100;

type Confidence = 'low' | 'medium' | 'high';
type Rating = 1 | 2 | 3 | 4 | 5;

export const PILOT_FEEDBACK_VERSION = 'pilot-feedback-v1' as const;

export interface PilotFeedbackArtifact {
  sessionId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  confusing: string;
  worked: string;
  improve: string;
  submittedAt: number;
}

export interface PilotFeedbackHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  totalCount: number;
  averageRating: number | null;
  noPII: true;
  sanitizedBeforeWrite: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

/**
 * PII sanitizer — strips emails and any run of 10+ consecutive
 * digits. Same patterns used by PilotErrorMonitoringRuntime so the
 * gate can verify a single canonical implementation. Exported for
 * direct gate consumption.
 */
export function sanitizeFeedbackText(text: string): string {
  return _safe(() => {
    if (typeof text !== 'string') return '';
    let out = text;
    // Strip emails — local@domain.tld with common TLD shapes.
    out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted]');
    // Strip any run of 10 or more consecutive digits (phone, ID, etc.).
    out = out.replace(/\d{10,}/g, '[redacted]');
    // Cap length defensively to keep storage bounded.
    if (out.length > 2000) out = out.slice(0, 2000);
    return out;
  }, '');
}

function _isValidRating(r: unknown): r is Rating {
  return typeof r === 'number'
    && Number.isFinite(r)
    && Math.floor(r) === r
    && r >= 1
    && r <= 5;
}

function _readLog(): PilotFeedbackArtifact[] {
  const raw = _ls(FEEDBACK_KEY);
  if (!Array.isArray(raw)) return [];
  const out: PilotFeedbackArtifact[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.sessionId !== 'string' || !r.sessionId) continue;
    if (!_isValidRating(r.rating)) continue;
    if (typeof r.submittedAt !== 'number' || !Number.isFinite(r.submittedAt)) continue;
    out.push({
      sessionId: r.sessionId,
      rating: r.rating as Rating,
      confusing: typeof r.confusing === 'string' ? r.confusing : '',
      worked: typeof r.worked === 'string' ? r.worked : '',
      improve: typeof r.improve === 'string' ? r.improve : '',
      submittedAt: r.submittedAt,
    });
  }
  return out;
}

export function recordPilotFeedback(input: {
  sessionId: string;
  rating: number;
  confusing: string;
  worked: string;
  improve: string;
  nowMs: number;
}): boolean {
  return _safe(() => {
    if (!input || typeof input !== 'object') return false;
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
    if (!sessionId) return false;
    if (!_isValidRating(input.rating)) return false;
    const nowMs = typeof input.nowMs === 'number' && Number.isFinite(input.nowMs)
      ? input.nowMs : null;
    if (nowMs === null) return false;

    const artifact: PilotFeedbackArtifact = {
      sessionId,
      rating: input.rating as Rating,
      confusing: sanitizeFeedbackText(input.confusing || ''),
      worked: sanitizeFeedbackText(input.worked || ''),
      improve: sanitizeFeedbackText(input.improve || ''),
      submittedAt: nowMs,
    };

    const log = _readLog();
    // Idempotent on the (sessionId + submittedAt) composite — caller
    // supplies the timestamp so duplicate submissions collapse.
    const dupe = log.some((e) =>
      e.sessionId === artifact.sessionId && e.submittedAt === artifact.submittedAt);
    if (dupe) return true;

    log.push(artifact);
    // Bound to MAX_ENTRIES, keeping the most-recent submissions.
    const trimmed = log.length > MAX_ENTRIES
      ? log.slice(log.length - MAX_ENTRIES)
      : log;
    return _lsWrite(FEEDBACK_KEY, trimmed);
  }, false);
}

export function listPilotFeedback(limit: number = 20)
  : ReadonlyArray<Readonly<PilotFeedbackArtifact>> {
  return _safe(() => {
    const cap = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), MAX_ENTRIES)
      : 20;
    const log = _readLog();
    // Most-recent first.
    const sorted = log.slice().sort((a, b) => b.submittedAt - a.submittedAt);
    const out = sorted.slice(0, cap).map((e) => Object.freeze<PilotFeedbackArtifact>({
      sessionId: e.sessionId,
      rating: e.rating,
      confusing: e.confusing,
      worked: e.worked,
      improve: e.improve,
      submittedAt: e.submittedAt,
    }));
    return Object.freeze(out) as ReadonlyArray<Readonly<PilotFeedbackArtifact>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<PilotFeedbackArtifact>>);
}

export function pilotFeedbackReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

const _EMPTY_HEALTH: Readonly<PilotFeedbackHealthEnvelope> = Object.freeze<PilotFeedbackHealthEnvelope>({
  initialized: true,
  storageReady: false,
  totalCount: 0,
  averageRating: null,
  noPII: true as const,
  sanitizedBeforeWrite: true as const,
  composedFrom: Object.freeze([]) as ReadonlyArray<string>,
  confidence: 'low' as Confidence,
  explanation: 'Pilot feedback runtime initialized.',
  limitations: 'Not enough data yet. Decision support, not a guarantee.',
});

export function pilotFeedbackHealth(): Readonly<PilotFeedbackHealthEnvelope> {
  return _safe(() => {
    const storageReady = pilotFeedbackReady();
    const log = _readLog();
    const totalCount = log.length;
    let averageRating: number | null = null;
    if (totalCount > 0) {
      let sum = 0;
      for (const e of log) sum += e.rating;
      averageRating = Math.round((sum / totalCount) * 10) / 10;
    }
    const confidence: Confidence =
      totalCount >= 10 ? 'high'
      : totalCount >= 3 ? 'medium'
      : 'low';
    return Object.freeze<PilotFeedbackHealthEnvelope>({
      initialized: true,
      storageReady,
      totalCount,
      averageRating,
      noPII: true as const,
      sanitizedBeforeWrite: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_pilot_feedback_log',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        '§9 Pilot Feedback — 1-5 rating plus three sanitized free-text ' +
        'fields (confusing / worked / improve). Persisted to localStorage ' +
        '(bounded 100, idempotent on sessionId+submittedAt). Free-text is ' +
        'PII-sanitized at write time (emails stripped, 10+ digit runs ' +
        'stripped) using the same patterns as PilotErrorMonitoringRuntime. ' +
        'averageRating is null when no feedback exists (honest NEEDS_DATA, ' +
        'never a misleading 0.0).',
      limitations:
        'On-device pilot feedback only; server-side aggregation may differ. ' +
        'Free-text reflects sanitizer output, not raw user input. ' +
        'Decision support, not a guarantee.',
    });
  }, _EMPTY_HEALTH);
}

export function installPilotFeedbackGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotFeedbackHealth !== 'function') {
      w.__pilotFeedbackHealth = function () {
        const out = pilotFeedbackHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Pilot Feedback]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
