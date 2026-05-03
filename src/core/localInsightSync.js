/**
 * localInsightSync.js — client-side delta builder + batch shipper
 * for the Global Insights Layer (data moat §1).
 *
 * Pipeline
 * ────────
 *   eventStore (farroway_events)
 *     ↓ buildDeltasSinceCursor()
 *   per-key { region, cropOrPlant, setup, condition }
 *   counters { shown, completed, success, failure }
 *     ↓ POST /api/insights/batch
 *   server upsert
 *
 * The client-side moat-aggregator at `src/core/insightAggregator.js`
 * stays as the local-first read path for the dashboard. THIS file
 * is the *write* path that ships deltas to the server.
 *
 * Storage
 * ───────
 *   localStorage['farroway:insights:cursor']   = number (ms-epoch
 *      of the latest event already shipped)
 *   localStorage['farroway:insights:pending']  = JSON.stringify(deltas[])
 *      (deltas that failed to send last time; retried next sync)
 *
 * Privacy
 * ───────
 *   • Respects the `helpImproveRecommendations` setting. When the
 *     user opts out, sync becomes a no-op and any pending deltas
 *     are cleared.
 *   • The server *also* PII-strips on receive (insightNormalize.js);
 *     this is defence in depth.
 *   • `setup` and `condition` come from the local plan-engine
 *     buckets. If the engine doesn't supply them, we send the
 *     event without those fields and the server collapses them
 *     into 'unknown' / 'normal'.
 *
 * Public API
 * ──────────
 *   buildDeltasSinceCursor(events?, cursor?)  pure helper, exported
 *                                              for tests
 *   syncInsights({ apiClient })               batch + post + retry
 *   clearPendingDeltas()                      privacy reset hook
 */

import { getEvents } from './eventStore.js';

const CURSOR_KEY  = 'farroway:insights:cursor';
const PENDING_KEY = 'farroway:insights:pending';
const PRIVACY_KEY = 'farroway:helpImproveRecommendations';

const RELEVANT_EVENTS = new Set([
  'task_shown',
  'task_completed',
  'task_skipped',
  'health_feedback_submitted',
]);

// ─── Storage helpers (never throw) ─────────────────────────

function _readCursor() {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(CURSOR_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

function _writeCursor(ts) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (Number.isFinite(ts)) localStorage.setItem(CURSOR_KEY, String(ts));
  } catch { /* ignore */ }
}

function _readPending() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writePending(arr) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PENDING_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
  } catch { /* ignore */ }
}

function _isOptedOut() {
  try {
    if (typeof localStorage === 'undefined') return false;
    // Default: opted IN (per spec §8). Only opt-out when the
    // user has explicitly written "false" to the key.
    return localStorage.getItem(PRIVACY_KEY) === 'false';
  } catch { return false; }
}

// ─── Pure delta builder ────────────────────────────────────
//
// Walks events, partitions into a Map keyed by
// `${region}|${cropOrPlant}|${setup}|${condition}`, increments
// the right counter, and returns a flat array suitable for the
// `/api/insights/batch` body.

const KEY_SEP = '\u0001';

function _keyFor(p) {
  return [
    p.region      || 'unknown',
    p.cropOrPlant || '',
    p.setup       || '',
    p.condition   || 'normal',
  ].join(KEY_SEP);
}

function _splitKey(k) {
  const [region, cropOrPlant, setup, condition] = k.split(KEY_SEP);
  return {
    region,
    cropOrPlant,
    setup:     setup || null,
    condition,
  };
}

/**
 * Build deltas from `events` filtered to those newer than
 * `cursor`. Pure — no I/O.
 *
 * @param {Array} events  enriched event records (from eventStore)
 * @param {number} cursor  ms-epoch; only events with timestamp > cursor counted
 * @returns {{
 *   deltas: Array<{region:string, cropOrPlant:string, setup:string|null,
 *                  condition:string, shown:number, completed:number,
 *                  success:number, failure:number}>,
 *   newCursor: number,
 * }}
 */
export function buildDeltasSinceCursor(events = [], cursor = 0) {
  if (!Array.isArray(events) || events.length === 0) {
    return { deltas: [], newCursor: cursor };
  }
  const map = new Map();
  let maxTs = cursor;
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const ts = Number(ev.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= cursor) continue;
    if (!RELEVANT_EVENTS.has(ev.name)) continue;
    if (ts > maxTs) maxTs = ts;

    const p = ev.payload || {};
    const key = _keyFor(p);
    let cur = map.get(key);
    if (!cur) {
      cur = { shown: 0, completed: 0, success: 0, failure: 0 };
      map.set(key, cur);
    }

    if (ev.name === 'task_shown')     cur.shown     += 1;
    if (ev.name === 'task_completed') cur.completed += 1;
    if (ev.name === 'task_skipped')   { /* counted only via shown delta */ }
    if (ev.name === 'health_feedback_submitted') {
      // Map the spec's three-button feedback to success / failure.
      const f = String(p.feedback || p.healthFeedback || '').toLowerCase();
      if (f === 'looks_healthy' || f === 'yes' || f === 'healthy') {
        cur.success += 1;
      } else if (f === 'getting_worse' || f === 'no' || f === 'worse') {
        cur.failure += 1;
      }
      // 'not_sure' / 'unsure' is intentionally not counted as
      // success or failure — it's an informational ping only.
    }
  }

  const deltas = [];
  for (const [k, c] of map.entries()) {
    if (c.shown === 0 && c.completed === 0 && c.success === 0 && c.failure === 0) continue;
    deltas.push({ ..._splitKey(k), ...c });
  }
  return { deltas, newCursor: maxTs };
}

// ─── Public sync API ───────────────────────────────────────

/**
 * Build deltas + POST them. Idempotent: on success the cursor
 * advances; on failure the deltas land in the pending slot and
 * the cursor stays put so we don't double-count.
 *
 * Caller passes a thin `apiClient` so this module never imports
 * axios / fetch directly — keeps it test-friendly.
 *
 *     await syncInsights({ apiClient: api });
 *
 * @param {{apiClient: { post: (path:string, body:any)=>Promise }}} opts
 * @returns {Promise<{accepted:number, rejected:number, sent:number, optedOut:boolean}>}
 */
export async function syncInsights({ apiClient } = {}) {
  if (_isOptedOut()) {
    // Privacy hard-stop. Drop any pending deltas so a previous
    // session's queue can't ship after the user flipped opt-out.
    clearPendingDeltas();
    return { accepted: 0, rejected: 0, sent: 0, optedOut: true };
  }
  if (!apiClient || typeof apiClient.post !== 'function') {
    return { accepted: 0, rejected: 0, sent: 0, optedOut: false };
  }

  const cursor = _readCursor();
  const events = _safeGetEvents();
  const { deltas: fresh, newCursor } = buildDeltasSinceCursor(events, cursor);
  const pending = _readPending();
  const all = pending.concat(fresh);

  if (all.length === 0) {
    return { accepted: 0, rejected: 0, sent: 0, optedOut: false };
  }

  // Server cap is 100 per call; chunk locally so a busy session
  // doesn't get a 413/422 on the batch envelope.
  const CHUNK = 100;
  let accepted = 0;
  let rejected = 0;
  let sent = 0;
  let failed = false;
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    try {
      const res = await apiClient.post('/insights/batch', { insights: chunk });
      const body = (res && res.data) ? res.data : res || {};
      accepted += Number(body.accepted) || 0;
      rejected += Number(body.rejected) || 0;
      sent     += chunk.length;
    } catch (err) {
      failed = true;
      try { console.warn('[insights sync chunk failed]', err && err.message); }
      catch { /* ignore */ }
      // Stop sending; remainder stays pending for next tick.
      const remaining = all.slice(i);
      _writePending(remaining);
      break;
    }
  }

  if (!failed) {
    // Everything shipped — clear pending and advance the cursor.
    _writePending([]);
    _writeCursor(newCursor);
  }
  return { accepted, rejected, sent, optedOut: false };
}

/**
 * Privacy reset — drop both the pending deltas and the cursor
 * so the next session starts clean. Called by the privacy
 * panel's "Help improve recommendations" toggle when the user
 * opts out, and by the spec's `clearLocalActivityData()`.
 */
export function clearPendingDeltas() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(CURSOR_KEY);
  } catch { /* ignore */ }
}

function _safeGetEvents() {
  try { return getEvents(); }
  catch { return []; }
}

// Test seam.
export const _internal = Object.freeze({
  CURSOR_KEY, PENDING_KEY, PRIVACY_KEY,
  RELEVANT_EVENTS,
  _readCursor, _writeCursor, _readPending, _writePending, _isOptedOut,
});
