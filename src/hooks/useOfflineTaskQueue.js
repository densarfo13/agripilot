/**
 * useOfflineTaskQueue — lightweight localStorage queue + sync loop
 * so a farmer with a flaky connection can still complete / skip
 * tasks.
 *
 * API:
 *   const { queue, enqueue, flush, pending, isOnline } = useOfflineTaskQueue({
 *     handlers: {
 *       complete: async ({ taskId, note }) => { … },
 *       skip:     async ({ taskId, reason }) => { … },
 *     },
 *   });
 *
 * Behavior:
 *   - enqueue writes to window.localStorage keyed by FARROWAY_OFFLINE_QUEUE
 *   - flush drains the queue one action at a time via the handler
 *     map. Failures leave the entry in place so next flush retries.
 *   - the hook flushes automatically when `navigator.onLine` flips
 *     back true and on first mount if the tab comes back online.
 *
 * The caller is responsible for optimistic UI — enqueue returns
 * immediately; the parent renders the task as complete even
 * before the sync runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const QUEUE_KEY = 'farroway:offline:queue';
const CACHE_KEY = 'farroway:offline:todayPayload';

function readQueue() {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeQueue(q) {
  try {
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch { /* quota / storage disabled → drop gracefully */ }
}

export function cacheTodayPayload(payload) {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify({
      at: Date.now(),
      payload,
    }));
  } catch { /* noop */ }
}

export function getCachedTodayPayload() {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    // Stale after 24h — avoid surfacing day-old Today state.
    if (!obj?.at || Date.now() - obj.at > 24 * 60 * 60 * 1000) return null;
    return obj.payload || null;
  } catch { return null; }
}

/** One-shot helper for callers that don't want the full hook. */
export function queueOfflineAction(action) {
  const q = readQueue();
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    queuedAt: new Date().toISOString(),
    ...action,
  });
  writeQueue(q);
}

export async function flushOfflineActions(handlers) {
  const q = readQueue();
  if (!q.length) return { drained: 0, remaining: 0 };
  const remaining = [];
  let drained = 0;
  for (const entry of q) {
    const handler = handlers?.[entry.type];
    if (!handler) { remaining.push(entry); continue; }
    try {
      await handler(entry);
      drained += 1;
    } catch {
      // Put it back; we'll retry on the next flush.
      remaining.push(entry);
    }
  }
  writeQueue(remaining);
  return { drained, remaining: remaining.length };
}

export default function useOfflineTaskQueue({ handlers } = {}) {
  const [queue, setQueue] = useState(() => readQueue());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? !!navigator.onLine : true,
  );
  const flushingRef = useRef(false);

  const enqueue = useCallback((action) => {
    queueOfflineAction(action);
    setQueue(readQueue());
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current || !handlers) return { drained: 0, remaining: queue.length };
    flushingRef.current = true;
    try {
      const result = await flushOfflineActions(handlers);
      setQueue(readQueue());
      return result;
    } finally {
      flushingRef.current = false;
    }
  }, [handlers, queue.length]);

  // Auto-flush when the tab comes back online.
  useEffect(() => {
    function onOnline() { setIsOnline(true); flush(); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush]);

  // First-mount flush if we reopened the app online with a queue.
  useEffect(() => {
    if (isOnline && queue.length > 0) { flush(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { queue, enqueue, flush, pending: queue.length, isOnline };
}
