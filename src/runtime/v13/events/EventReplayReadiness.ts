/**
 * Farroway · Event Replay Readiness (event-sourcing-v13)
 *
 * Composition-only, self-contained readiness probe over the locally stored
 * event log. It reads ONLY real stored data via the `_ls()` helper below and
 * never fabricates history. Same-folder sibling import of the pure
 * idempotency helper is permitted; no deep / project imports.
 *
 * It reports whether the stored log looks append-only-shaped, whether every
 * record carries an idempotency key, and whether replay therefore looks safe.
 * When the log is empty it returns an honest "Not enough data yet" result.
 *
 * NEVER throws. All returned envelopes are frozen.
 */

import { hasIdempotencyKey } from './EventIdempotency';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

type Confidence = 'low' | 'medium' | 'high';

export interface EventReplayEnvelope {
  appendOnlyReady: boolean;
  idempotencyReady: boolean;
  replayReady: boolean;
  eventCount: number;
  confidence: Confidence;
  explanation: string;
}

/**
 * An append-only-shaped record carries a monotonic-ish ordering signal
 * (sequence / version / a stored timestamp) and a stable event name.
 * We do NOT mutate or sort anything — we only inspect shape.
 */
function _looksAppendOnly(rec: any): boolean {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
  const hasName =
    typeof rec.eventName === 'string' || typeof rec.type === 'string' || typeof rec.name === 'string';
  const hasOrder =
    typeof rec.sequence === 'number' ||
    typeof rec.version === 'number' ||
    typeof rec.occurredAt === 'string' ||
    typeof rec.recordedAt === 'string' ||
    typeof rec.ts === 'string' ||
    typeof rec.ts === 'number';
  return hasName && hasOrder;
}

export function eventReplayReadiness(): EventReplayEnvelope {
  return _safe(
    () => {
      const log = _arr(_ls('farroway_event_log'));
      const eventCount = log.length;

      if (eventCount === 0) {
        return Object.freeze({
          appendOnlyReady: false,
          idempotencyReady: false,
          replayReady: false,
          eventCount: 0,
          confidence: 'low' as Confidence,
          explanation: 'Not enough data yet — no events have been recorded on this device.',
        }) as EventReplayEnvelope;
      }

      let appendOnlyCount = 0;
      let idempotentCount = 0;
      for (let i = 0; i < log.length; i++) {
        const rec = log[i];
        if (_looksAppendOnly(rec)) appendOnlyCount++;
        if (hasIdempotencyKey(rec)) idempotentCount++;
      }

      const appendOnlyReady = appendOnlyCount === eventCount;
      const idempotencyReady = idempotentCount === eventCount;
      const replayReady = appendOnlyReady && idempotencyReady;

      const confidence: Confidence =
        replayReady && eventCount >= 5 ? 'high' : appendOnlyReady || idempotencyReady ? 'medium' : 'low';

      const explanation = replayReady
        ? 'Stored event log looks append-only and every record carries an idempotency key, so replay looks safe.'
        : 'Stored event log is present but ' +
          (!appendOnlyReady ? 'some records are missing an ordering/name signal; ' : '') +
          (!idempotencyReady ? 'some records are missing an idempotency key; ' : '') +
          'replay should be treated with caution.';

      return Object.freeze({
        appendOnlyReady,
        idempotencyReady,
        replayReady,
        eventCount,
        confidence,
        explanation,
      }) as EventReplayEnvelope;
    },
    Object.freeze({
      appendOnlyReady: false,
      idempotencyReady: false,
      replayReady: false,
      eventCount: 0,
      confidence: 'low' as Confidence,
      explanation: 'Not enough data yet — event replay readiness could not be determined.',
    }) as EventReplayEnvelope,
  );
}
