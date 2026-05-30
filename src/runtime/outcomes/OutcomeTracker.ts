/**
 * src/runtime/outcomes/OutcomeTracker.ts — Append-only outcome
 * store backed by a single locally-owned localStorage key.
 *
 *   import {
 *     appendOutcome, listOutcomes, getOutcome,
 *     readOutcomesRaw, deriveOutcomeId,
 *     OUTCOME_TRACKER_VERSION,
 *   } from 'src/runtime/outcomes/OutcomeTracker';
 *
 * What this is
 * ────────────
 *   The ONLY writer of  localStorage['farroway.outcomes'].  UI must
 *   never touch the key directly; everything routes through this
 *   module. Append-only, deduped by outcomeId, capped at 200 rows
 *   (oldest dropped on overflow).
 *
 * Strict-rule audit
 *   • Composition only — no new schema beyond the one localStorage
 *     key. No server routes, no Prisma models.
 *   • SSR-safe. Every storage access wrapped.
 *   • Never throws. Frozen envelopes / arrays.
 *   • Never writes PII. Notes are truncated + control-stripped.
 *   • Single-writer invariant — only this module persists to the
 *     storage key.
 */

import {
  OUTCOME_STORAGE_KEY, OUTCOME_STORAGE_CAP, OUTCOME_NOTES_MAX,
  OUTCOME_STATUS, OUTCOME_STATUS_VALUES,
  type OutcomeRecord,
} from './outcomeContracts';

export const OUTCOME_TRACKER_VERSION = 'farroway-outcome-tracker-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';

const _str = (v: unknown): string =>
  typeof v === 'string' ? v : '';

const _arrStr = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === 'string' && x.length > 0) out.push(x);
  }
  return out;
};

const _validStatus = new Set<string>(OUTCOME_STATUS_VALUES as readonly string[]);

/**
 * Sanitise the notes field — truncate to OUTCOME_NOTES_MAX, strip
 * control chars (including newlines normalised to spaces) so notes
 * cannot smuggle structured data. We deliberately do NOT attempt to
 * detect PII inside free-text — that is the caller's responsibility,
 * per the runtime's no-PII contract.
 */
function _sanitiseNotes(raw: unknown): string {
  const s = _str(raw);
  if (!s) return '';
  let cleaned = '';
  for (let i = 0; i < s.length && cleaned.length < OUTCOME_NOTES_MAX; i++) {
    const code = s.charCodeAt(i);
    if (code < 32 || code === 127) cleaned += ' ';
    else cleaned += s[i];
  }
  return cleaned.trim().slice(0, OUTCOME_NOTES_MAX);
}

/**
 * deriveOutcomeId — Pure derivation. Stable per (plantId, scanIds[0])
 * so the same plant+follow-up-scan pair always deduplicates.
 */
export function deriveOutcomeId(plantId: string, firstScanId: string): string {
  return _safe(() => {
    const p = _str(plantId).trim();
    const s = _str(firstScanId).trim();
    if (!p) return '';
    const base = p + '|' + (s || 'no-scan');
    let h = 0;
    for (let i = 0; i < base.length; i++) {
      h = (h * 31 + base.charCodeAt(i)) | 0;
    }
    return 'outcome_' + (h >>> 0).toString(36) + '_'
      + (s ? s.slice(0, 8) : 'noscan');
  }, '');
}

/**
 * SSR-safe localStorage read. Returns the raw string or null.
 * Pure — never writes anything.
 */
function _readRaw(): string | null {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(OUTCOME_STORAGE_KEY);
  }, null);
}

/**
 * SSR-safe localStorage write. Returns true on success. The ONLY
 * writer in the system — single-writer invariant.
 */
function _writeRaw(payload: string): boolean {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(OUTCOME_STORAGE_KEY, payload);
    return true;
  }, false);
}

/**
 * Parse the raw payload into a typed array. Never throws — bad
 * payloads collapse to an empty list. Returns a frozen array of
 * frozen records.
 */
function _parse(raw: string | null): ReadonlyArray<OutcomeRecord> {
  return _safe(() => {
    if (!raw) return Object.freeze([] as OutcomeRecord[]);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Object.freeze([] as OutcomeRecord[]);
    const out: OutcomeRecord[] = [];
    for (const row of parsed) {
      if (!_isObj(row)) continue;
      const outcomeId = _str(row.outcomeId);
      const plantId   = _str(row.plantId);
      if (!outcomeId || !plantId) continue;
      const status = _str(row.outcomeStatus);
      const statusFinal = _validStatus.has(status)
        ? status : OUTCOME_STATUS.UNKNOWN;
      out.push(Object.freeze({
        outcomeId,
        plantId,
        scanIds:          Object.freeze(_arrStr(row.scanIds)),
        taskIds:          Object.freeze(_arrStr(row.taskIds)),
        recommendationId: row.recommendationId != null
          ? _str(row.recommendationId) : null,
        beforePhoto:      row.beforePhoto != null
          ? _str(row.beforePhoto) : null,
        afterPhoto:       row.afterPhoto != null
          ? _str(row.afterPhoto) : null,
        outcomeStatus:    statusFinal,
        notes:            _str(row.notes),
        timestamp:        _str(row.timestamp),
      }) as OutcomeRecord);
    }
    return Object.freeze(out);
  }, Object.freeze([] as OutcomeRecord[]));
}

/**
 * Public — raw read of the in-storage outcomes. Always returns a
 * frozen array (possibly empty). Never throws.
 */
export function readOutcomesRaw(): ReadonlyArray<OutcomeRecord> {
  return _parse(_readRaw());
}

/**
 * appendOutcome — the canonical writer. Dedupes by outcomeId
 * (newer write replaces older), caps the list at OUTCOME_STORAGE_CAP
 * by dropping the OLDEST rows, returns the frozen final record on
 * success or null on rejection. Never throws.
 *
 * Caller supplies the timestamp as an ISO string — this keeps the
 * write pure (the runtime does not consult the time API for writes).
 * If the timestamp is missing/invalid, the row is rejected.
 */
export function appendOutcome(input: {
  outcomeId:         string;
  plantId:           string;
  scanIds:           ReadonlyArray<string>;
  taskIds:           ReadonlyArray<string>;
  recommendationId?: string | null;
  beforePhoto?:      string | null;
  afterPhoto?:       string | null;
  outcomeStatus:     string;
  notes?:            string;
  timestamp:         string;
}): OutcomeRecord | null {
  return _safe(() => {
    if (!_isObj(input)) return null;
    const outcomeId = _str(input.outcomeId).trim();
    const plantId   = _str(input.plantId).trim();
    const status    = _str(input.outcomeStatus).trim();
    const ts        = _str(input.timestamp).trim();
    if (!outcomeId || !plantId || !ts) return null;
    if (!_validStatus.has(status)) return null;

    const scanIds = Object.freeze(_arrStr(input.scanIds));
    const taskIds = Object.freeze(_arrStr(input.taskIds));

    const rec: OutcomeRecord = Object.freeze({
      outcomeId,
      plantId,
      scanIds,
      taskIds,
      recommendationId: input.recommendationId != null
        ? _str(input.recommendationId) || null : null,
      beforePhoto: input.beforePhoto != null
        ? _str(input.beforePhoto) || null : null,
      afterPhoto:  input.afterPhoto != null
        ? _str(input.afterPhoto) || null : null,
      outcomeStatus: status,
      notes:         _sanitiseNotes(input.notes),
      timestamp:     ts,
    });

    const current = _parse(_readRaw());
    const next: OutcomeRecord[] = [];
    for (const row of current) {
      if (row.outcomeId === outcomeId) continue; // dedupe — replace
      next.push(row);
    }
    next.push(rec);
    // Cap by dropping oldest. Never throw on cap.
    while (next.length > OUTCOME_STORAGE_CAP) next.shift();

    // Serialise — Object.freeze does not affect JSON.stringify output.
    const payload = _safe(() => JSON.stringify(next), '');
    if (!payload) return null;
    _writeRaw(payload);
    return rec;
  }, null);
}

/**
 * listOutcomes — frozen, append-order copy of the stored rows.
 * Optional filters keep the read pure; result is always frozen.
 */
export function listOutcomes(opts?: {
  plantId?: string;
  limit?:   number;
}): ReadonlyArray<OutcomeRecord> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    const plantId = _str(o.plantId);
    const limit = typeof o.limit === 'number' && o.limit > 0
      ? Math.min(o.limit, OUTCOME_STORAGE_CAP) : OUTCOME_STORAGE_CAP;
    let pool = readOutcomesRaw().slice();
    if (plantId) pool = pool.filter((r) => r.plantId === plantId);
    return Object.freeze(pool.slice(-limit));
  }, Object.freeze([] as OutcomeRecord[]));
}

/**
 * getOutcome — fetch a single frozen record by outcomeId, or null.
 */
export function getOutcome(outcomeId: string): OutcomeRecord | null {
  return _safe(() => {
    const id = _str(outcomeId).trim();
    if (!id) return null;
    for (const row of readOutcomesRaw()) {
      if (row.outcomeId === id) return row;
    }
    return null;
  }, null);
}

/**
 * Stored count — used by the health envelope. Never throws.
 */
export function storedOutcomeCount(): number {
  return _safe(() => readOutcomesRaw().length, 0);
}

/**
 * Most recent timestamp in storage (ISO string) or null. Used by
 * the health envelope.
 */
export function lastOutcomeAt(): string | null {
  return _safe(() => {
    const rows = readOutcomesRaw();
    if (rows.length === 0) return null;
    // Append-only ordering means last() is the most recent write,
    // but the timestamp field is caller-supplied — pick the lexically
    // greatest ISO string for robustness.
    let best: string | null = null;
    for (const r of rows) {
      const t = r.timestamp;
      if (t && (!best || t > best)) best = t;
    }
    return best;
  }, null);
}
