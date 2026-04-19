/**
 * analyticsClient — thin fire-and-forget event logger for the
 * browser. Matches the canonical event-type list in
 * server/src/services/analytics/eventLogService.js.
 *
 *   logClientEvent('onboarding_language_selected', { lang: 'hi' });
 *
 * Behavior:
 *   - POSTs to /api/v2/analytics/events (best-effort — no retry loop,
 *     no user-visible error).
 *   - If the fetch fails or we're offline, the event is buffered in
 *     localStorage under FARROWAY_EVT_BUFFER and flushed on next
 *     logClientEvent or on demand via flushClientEvents().
 *   - Never throws. Never blocks the caller.
 *
 * Minimal by design. If there's later appetite for a richer analytics
 * story, this file is the one place to change.
 */

import { ONBOARDING_EVENT_TYPES } from './onboardingEventTypes.js';

const BUFFER_KEY = 'farroway:evt:buffer';
const MAX_BUFFER = 50;

function readBuffer() {
  try {
    const raw = globalThis.localStorage?.getItem(BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeBuffer(arr) {
  try {
    globalThis.localStorage?.setItem(BUFFER_KEY, JSON.stringify(arr.slice(-MAX_BUFFER)));
  } catch { /* storage full / private mode → drop */ }
}

function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
}

async function postOne(entry) {
  try {
    const res = await fetch('/api/v2/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(entry),
      keepalive: true,
    });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

/** Public — enqueue and best-effort flush. Never throws. */
export function logClientEvent(eventType, metadata) {
  if (!eventType) return;
  const entry = {
    eventType: String(eventType),
    metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    occurredAt: new Date().toISOString(),
  };
  if (!isOnline()) {
    const buf = readBuffer();
    buf.push(entry);
    writeBuffer(buf);
    return;
  }
  // Try to flush anything we already buffered, then the new one.
  const buf = readBuffer();
  (async () => {
    const remaining = [];
    for (const e of buf) {
      if (!(await postOne(e))) remaining.push(e);
    }
    if (!(await postOne(entry))) remaining.push(entry);
    writeBuffer(remaining);
  })();
}

/** Flush anything the buffer still has. Useful on `online` events. */
export async function flushClientEvents() {
  if (!isOnline()) return { drained: 0, remaining: readBuffer().length };
  const buf = readBuffer();
  const remaining = [];
  let drained = 0;
  for (const e of buf) {
    if (await postOne(e)) drained += 1;
    else remaining.push(e);
  }
  writeBuffer(remaining);
  return { drained, remaining: remaining.length };
}

export { ONBOARDING_EVENT_TYPES };
