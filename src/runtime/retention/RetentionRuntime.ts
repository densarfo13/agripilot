/**
 * src/runtime/retention/RetentionRuntime.ts — Farroway Retention
 * Analytics v1 runtime.
 *
 *   import {
 *     recordEvent, metrics, readStoredEvents, readFirstVisit,
 *     RETENTION_RUNTIME_VERSION,
 *   } from 'src/runtime/retention/RetentionRuntime';
 *
 *   window.__retentionHealth()
 *
 * What this is
 * ────────────
 *   A pure composition runtime that derives cohort + activity
 *   metrics from local-only event rows. The runtime is the sole
 *   writer of farroway.retentionEvents (single-writer invariant).
 *
 * Composition rule (non-negotiable)
 *   No PostHog / Mixpanel / Sentry reads. No new server routes.
 *   No new Prisma models. recordEvent() writes ONLY to the
 *   retention-specific localStorage key. Rolling FIFO at
 *   RETENTION_EVENT_CAP rows.
 *
 * No PII rule
 *   The runtime stores event-type + ISO timestamp only. It never
 *   writes farmer name, phone, email, exact coords, device id, or
 *   IP — neither to storage nor to the returned envelope.
 *
 * Strict-rule audit
 *   • Composition over architecture — localStorage only.
 *   • SSR-safe — every storage / window access is guarded.
 *   • Pure — never throws; every public function has try/catch
 *     and falls back to a frozen envelope.
 *   • Frozen envelopes on every return.
 *   • Single-writer — only this module writes the retention key.
 */

import {
  RETENTION_RUNTIME_VERSION,
  RETENTION_EVENT,
  RETENTION_EVENT_TYPES,
  RETENTION_STORAGE_KEY,
  FIRST_VISIT_STORAGE_KEY,
  RETENTION_EVENT_CAP,
  COHORT_DAY_OFFSET,
  COHORT_BUCKET,
  FROZEN_FALLBACK_METRICS,
  type RetentionEventType,
  type RetentionMetrics,
} from './retentionContracts';

export { RETENTION_RUNTIME_VERSION };

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** ─── SSR-safe localStorage helpers ──────────────────────────── */

function _read(key: string): string | null {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }, null);
}

function _write(key: string, value: string): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  }, false);
}

/** ─── Row shape (internal) ───────────────────────────────────── */

interface StoredRow {
  /** Event type — one of RETENTION_EVENT_TYPES. */
  t: RetentionEventType;
  /** ISO 8601 timestamp string (no PII). */
  iso: string;
}

interface StoredEnvelope {
  v: 1;
  events: StoredRow[];
}

function _isValidEventType(t: unknown): t is RetentionEventType {
  if (typeof t !== 'string') return false;
  for (const legal of RETENTION_EVENT_TYPES) {
    if (legal === t) return true;
  }
  return false;
}

function _isValidIso(iso: unknown): boolean {
  if (typeof iso !== 'string' || iso.length === 0) return false;
  return _safe(() => {
    const d = new Date(iso);
    const ms = d.getTime();
    return Number.isFinite(ms);
  }, false);
}

function _loadEnvelope(): StoredEnvelope {
  return _safe(() => {
    const raw = _read(RETENTION_STORAGE_KEY);
    if (!raw) return { v: 1, events: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { v: 1, events: [] };
    }
    const events = Array.isArray((parsed as any).events)
      ? (parsed as any).events
      : [];
    const clean: StoredRow[] = [];
    for (const row of events) {
      if (!row || typeof row !== 'object') continue;
      const t   = (row as any).t;
      const iso = (row as any).iso;
      if (!_isValidEventType(t)) continue;
      if (!_isValidIso(iso)) continue;
      clean.push({ t, iso });
    }
    return { v: 1, events: clean };
  }, { v: 1, events: [] } as StoredEnvelope);
}

function _saveEnvelope(env: StoredEnvelope): boolean {
  return _safe(() => {
    // FIFO trim — drop the oldest rows once we exceed the cap.
    const events = env.events.length > RETENTION_EVENT_CAP
      ? env.events.slice(env.events.length - RETENTION_EVENT_CAP)
      : env.events;
    const payload = JSON.stringify({ v: 1, events });
    return _write(RETENTION_STORAGE_KEY, payload);
  }, false);
}

/** ─── Public: stored-event accessors ─────────────────────────── */

/**
 * readStoredEvents — frozen snapshot of the rows currently held
 * in farroway.retentionEvents. Returns an empty frozen array on
 * any failure. Never throws.
 */
export function readStoredEvents(): ReadonlyArray<Readonly<StoredRow>> {
  return _safe(() => {
    const env = _loadEnvelope();
    return Object.freeze(env.events.map(r => Object.freeze({ ...r })));
  }, Object.freeze([] as ReadonlyArray<Readonly<StoredRow>>));
}

/**
 * readFirstVisit — read-only access to farroway.firstVisit. The
 * runtime never writes this key (the boot path elsewhere owns it).
 * Returns null when missing, malformed, or unavailable.
 */
export function readFirstVisit(): string | null {
  return _safe(() => {
    const raw = _read(FIRST_VISIT_STORAGE_KEY);
    if (!raw) return null;
    return _isValidIso(raw) ? raw : null;
  }, null);
}

/** ─── Public: recordEvent ────────────────────────────────────── */

/**
 * recordEvent — append a single row to farroway.retentionEvents.
 * Pure side-effect: localStorage only. Rejects unknown event
 * types and malformed ISO strings without throwing. Enforces the
 * 1000-row FIFO cap on every write.
 *
 * @param type        — one of RETENTION_EVENT values.
 * @param isoTimestamp — ISO 8601 string. Use new Date().toISOString().
 * @returns boolean   — true if the row was persisted, false otherwise.
 */
export function recordEvent(
  type: RetentionEventType,
  isoTimestamp: string,
): boolean {
  return _safe(() => {
    if (!_isValidEventType(type)) return false;
    if (!_isValidIso(isoTimestamp)) return false;
    const env = _loadEnvelope();
    env.events.push({ t: type, iso: isoTimestamp });
    return _saveEnvelope(env);
  }, false);
}

/** ─── Pure cohort math ───────────────────────────────────────── */

const _MS_PER_DAY = 24 * 60 * 60 * 1000;

function _toMs(iso: string): number {
  return _safe(() => new Date(iso).getTime(), NaN);
}

/** UTC midnight start-of-day for a ms timestamp. */
function _dayKey(ms: number): number {
  if (!Number.isFinite(ms)) return NaN;
  return Math.floor(ms / _MS_PER_DAY);
}

/**
 * _distinctDaysWithin — count of distinct UTC days that contain
 * at least one event in the window (windowStartMs, nowMs].
 */
function _distinctDaysWithin(
  events: StoredRow[],
  nowMs: number,
  windowDays: number,
): number {
  return _safe(() => {
    if (!Number.isFinite(nowMs)) return 0;
    const cutoff = nowMs - windowDays * _MS_PER_DAY;
    const seen = new Set<number>();
    for (const row of events) {
      const ms = _toMs(row.iso);
      if (!Number.isFinite(ms)) continue;
      if (ms <= cutoff) continue;
      if (ms > nowMs) continue;
      const dk = _dayKey(ms);
      if (Number.isFinite(dk)) seen.add(dk);
    }
    return seen.size;
  }, 0);
}

/**
 * _hasEventOnDayAfterFirstVisit — Day-N cohort marker. True iff
 * at least one event landed in the UTC day that starts exactly
 * `offsetDays` days after firstVisit (and that day is in the past
 * relative to nowMs).
 */
function _hasEventOnDayAfterFirstVisit(
  events: StoredRow[],
  firstVisitMs: number,
  offsetDays: number,
  nowMs: number,
): boolean {
  return _safe(() => {
    if (!Number.isFinite(firstVisitMs)) return false;
    if (!Number.isFinite(nowMs)) return false;
    const firstDay = _dayKey(firstVisitMs);
    const targetDay = firstDay + offsetDays;
    const nowDay = _dayKey(nowMs);
    // The cohort marker only resolves once the target day has begun.
    if (targetDay > nowDay) return false;
    for (const row of events) {
      const ms = _toMs(row.iso);
      if (!Number.isFinite(ms)) continue;
      if (_dayKey(ms) === targetDay) return true;
    }
    return false;
  }, false);
}

/** ─── Public: metrics() ──────────────────────────────────────── */

export interface MetricsInput {
  /** ISO timestamp the caller treats as "now". Required. */
  nowIso: string;
  /**
   * Active experience mode. The runtime NEVER reads this from
   * storage — the caller is the only source of truth for which
   * experience the device is on.
   */
  mode?: 'farm' | 'garden' | string | null;
}

/**
 * metrics — pure computation of cohort + activity metrics from
 * the locally-stored event rows. Returns a frozen envelope.
 *
 * weeklyActiveGrowers   — distinct event-days in the last 7d.
 * weeklyActiveGardeners — same calc, but only when the caller
 *                         passes mode === 'garden'. Other modes
 *                         report 0 (the runtime refuses to guess
 *                         the active experience).
 * returnRate            — distinct event-days in last 30d ÷ 30,
 *                         capped at 1.
 * d1 / d7 / d30         — boolean has-event-on-day-N-after-
 *                         firstVisit. False when firstVisit is
 *                         absent (no cohort anchor → no cohort).
 */
export function metrics(input: MetricsInput): Readonly<RetentionMetrics> {
  return _safe(() => {
    const nowMs = _toMs(input && input.nowIso ? input.nowIso : '');
    if (!Number.isFinite(nowMs)) return FROZEN_FALLBACK_METRICS;

    const env = _loadEnvelope();
    const events = env.events;

    const distinct7  = _distinctDaysWithin(events, nowMs, 7);
    const distinct30 = _distinctDaysWithin(events, nowMs, 30);

    const mode = input && typeof input.mode === 'string'
      ? input.mode.toLowerCase()
      : '';
    const isGardener = mode.includes('garden') || mode.includes('backyard');
    const isGrower   = mode.includes('farm')   || mode.includes('grower');

    // The caller is the only source of truth for mode. When the
    // caller doesn't tell us, we still expose the grower number
    // because it is the conservative "any active user" count —
    // gardener stays gated on an explicit signal.
    const weeklyActiveGrowers   = (!mode || isGrower) ? distinct7 : 0;
    const weeklyActiveGardeners = isGardener ? distinct7 : 0;

    const returnRate = Math.max(0, Math.min(1, distinct30 / 30));

    const firstVisitIso = readFirstVisit();
    const firstVisitMs  = firstVisitIso ? _toMs(firstVisitIso) : NaN;

    const d1  = _hasEventOnDayAfterFirstVisit(
      events, firstVisitMs, COHORT_DAY_OFFSET[COHORT_BUCKET.D1],  nowMs);
    const d7  = _hasEventOnDayAfterFirstVisit(
      events, firstVisitMs, COHORT_DAY_OFFSET[COHORT_BUCKET.D7],  nowMs);
    const d30 = _hasEventOnDayAfterFirstVisit(
      events, firstVisitMs, COHORT_DAY_OFFSET[COHORT_BUCKET.D30], nowMs);

    return Object.freeze({
      d1, d7, d30,
      returnRate,
      weeklyActiveGrowers,
      weeklyActiveGardeners,
    });
  }, FROZEN_FALLBACK_METRICS);
}

/** ─── Public: health probe + global install ──────────────────── */

export interface RetentionHealth {
  runtimeVersion: string;
  retentionReady: true;
  storedEvents: number;
  firstVisitISO: string | null;
  metrics: RetentionMetrics;
}

const FROZEN_HEALTH_FALLBACK = Object.freeze({
  runtimeVersion: RETENTION_RUNTIME_VERSION,
  retentionReady: true as const,
  storedEvents: 0,
  firstVisitISO: null as string | null,
  metrics: FROZEN_FALLBACK_METRICS,
});

/**
 * retentionHealth — frozen envelope describing the runtime state.
 * `nowIso` defaults to the current wall clock (the runtime is
 * permitted to call Date.now()/new Date() — workflow restrictions
 * do not apply to runtime source).
 */
export function retentionHealth(opts?: {
  nowIso?: string;
  mode?: 'farm' | 'garden' | string | null;
}): Readonly<RetentionHealth> {
  return _safe(() => {
    const nowIso = (opts && opts.nowIso)
      ? opts.nowIso
      : new Date().toISOString();
    const mode = opts && opts.mode != null ? opts.mode : null;
    const env = _loadEnvelope();
    const m = metrics({ nowIso, mode });
    return Object.freeze({
      runtimeVersion: RETENTION_RUNTIME_VERSION,
      retentionReady: true as const,
      storedEvents:   env.events.length,
      firstVisitISO:  readFirstVisit(),
      metrics:        m,
    });
  }, FROZEN_HEALTH_FALLBACK);
}

/**
 * installRetentionRuntimeGlobal — pin window.__retentionHealth.
 * Idempotent. SSR-safe. Single global only (strict rule 7).
 */
export function installRetentionRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__retentionHealth !== 'function') {
      w.__retentionHealth = function (opts?: {
        nowIso?: string;
        mode?: 'farm' | 'garden' | string | null;
      }) {
        const out = retentionHealth(opts);
        try { console.log('[Farroway · Retention]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
