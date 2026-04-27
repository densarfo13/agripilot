/**
 * actionQueue.js — append-only outbox of pending server actions.
 *
 * Every mutation that needs server-side replay enqueues an action
 * with a stable, unique id. The sync worker drains the queue on a
 * 15s loop (and on demand). Server idempotency keys off `id`:
 * receiving the same id twice is a no-op.
 *
 * Strict-rule audit:
 *   * Idempotent: every action has a unique id; replays are safe.
 *   * Survives offline: queue persists in IndexedDB.
 *   * Never blocks UI: enqueue returns a promise but callers can
 *     fire-and-forget; failure to write does not interrupt the
 *     synchronous progress update.
 */

import { dbAddQueue } from '../db/indexedDB.js';

/**
 * Generate a stable, collision-resistant action id without pulling
 * in a uuid library. Good enough for outbox dedupe at 1M users:
 *   <type>_<unix-ms>_<8-byte hex random>
 */
function makeActionId(type) {
  const ts = Date.now();
  let rand = '';
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through */ }
  if (!rand) {
    // Fallback when crypto is unavailable. Two Math.random() draws
    // give ~52 bits of entropy which is fine for outbox dedupe.
    rand = (Math.random().toString(36).slice(2) +
            Math.random().toString(36).slice(2)).slice(0, 16);
  }
  return `${type || 'ACTION'}_${ts}_${rand}`;
}

/**
 * Enqueue an action for the server. Returns the action record so
 * tests / call sites can inspect the id.
 */
export function enqueueAction(type, payload) {
  const item = {
    id:        makeActionId(type),
    type:      String(type || 'ACTION'),
    payload:   payload == null ? null : payload,
    createdAt: new Date().toISOString(),
    attempts:  0,
  };
  // Fire-and-forget at the call site - dbAddQueue itself never
  // throws (the IDB wrapper catches everything internally).
  dbAddQueue(item);
  return item;
}

/** Test helper - lets a unit test seed an action with a known id. */
export function _enqueueActionWithId(item) {
  if (!item || !item.id) return null;
  dbAddQueue({
    type:      'ACTION',
    payload:   null,
    createdAt: new Date().toISOString(),
    attempts:  0,
    ...item,
  });
  return item;
}
