/**
 * useBufferedAnalytics — thin wrapper that exposes just the buffer
 * surface to components that want to show buffer status in the UI
 * (e.g. "5 events queued, will send when online").
 *
 * For sending events, use useAnalytics. This hook is intentionally
 * read-mostly so it can be imported inside a component tree that
 * also uses useAnalytics without double-binding the reconnect
 * listener.
 */

import { useEffect, useState } from 'react';
import {
  bufferedAnalyticsCount,
  peekAnalyticsBuffer,
  flushAnalyticsBuffer,
} from '../utils/analyticsBuffer.js';

export function useBufferedAnalytics({ sendOne, pollMs = 2000 } = {}) {
  const [count, setCount] = useState(() => bufferedAnalyticsCount());

  // Poll is cheap — localStorage reads are O(n) in buffer length,
  // and the buffer is capped at 500. Two seconds is smooth enough
  // for a "queued" indicator without burning battery.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setCount(bufferedAnalyticsCount());
    };
    const id = setInterval(tick, Math.max(500, pollMs));
    const onStorage = () => tick();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      alive = false;
      clearInterval(id);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, [pollMs]);

  const flushNow = async () => {
    if (typeof sendOne !== 'function') return { sent: 0, failed: 0 };
    const res = await flushAnalyticsBuffer(sendOne);
    setCount(bufferedAnalyticsCount());
    return res;
  };

  return {
    count,
    peek: peekAnalyticsBuffer,
    flushNow,
  };
}

export default useBufferedAnalytics;
