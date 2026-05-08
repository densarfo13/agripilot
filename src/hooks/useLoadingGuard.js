/**
 * useLoadingGuard — 8-second loading timeout with safe fallback state.
 *
 * PROBLEM SOLVED
 * ──────────────
 * Any page or component that shows a spinner while waiting for data
 * risks getting stuck in an infinite loading state when:
 *   • The API call never resolves (network stall)
 *   • A context provider is missing above the component
 *   • A promise is rejected but not caught
 *   • The loading flag is never set to false after an error
 *
 * useLoadingGuard adds a hard 8-second deadline. After it fires,
 * the hook returns `timedOut: true` so the component can render its
 * safe fallback state instead of an infinite spinner.
 *
 * USAGE
 * ─────
 *   const { timedOut, resetTimeout } = useLoadingGuard(isLoading);
 *
 *   if (isLoading && !timedOut) return <LoadingSpinner />;
 *   if (timedOut)  return <FallbackContent />;
 *   return <Content data={data} />;
 *
 *   // With custom timeout:
 *   const { timedOut } = useLoadingGuard(isLoading, { timeoutMs: 5000 });
 *
 *   // With callback when timeout fires:
 *   const { timedOut } = useLoadingGuard(isLoading, {
 *     onTimeout: () => console.warn('Page load timed out'),
 *   });
 *
 * BEHAVIOUR
 * ─────────
 *   • Timer starts when `loading` transitions to true OR on mount
 *     if `loading` is already true.
 *   • Timer is CLEARED as soon as `loading` becomes false (data arrived).
 *   • `timedOut` reverts to false when `loading` becomes false (safe reset).
 *   • `resetTimeout` lets the caller retry: clears timedOut + restarts the timer.
 *   • Multiple rapid `loading` → false → true cycles each get a fresh timer.
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • All hooks unconditional — rules-of-hooks compliant.
 *   • No context dependency — usable in any component tree.
 *   • Cleanup on unmount — no setState after unmount.
 *   • SSR-safe — setTimeout guarded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * @param {boolean} loading
 * @param {{
 *   timeoutMs?: number,
 *   onTimeout?:  () => void,
 * }} [opts]
 * @returns {{ timedOut: boolean, resetTimeout: () => void }}
 */
export function useLoadingGuard(loading, opts = {}) {
  const { timeoutMs, onTimeout } = opts;
  const deadline = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;

  const [timedOut, setTimedOut]   = useState(false);
  const timerRef  = useRef(null);
  const aliveRef  = useRef(true);

  // Mark alive on mount, dead on unmount.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Start/stop the countdown in sync with `loading`.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!loading) {
      // Data arrived — clear any timed-out state.
      if (aliveRef.current) setTimedOut(false);
      return;
    }

    // Data is loading — arm the deadline.
    timerRef.current = setTimeout(() => {
      if (!aliveRef.current) return;
      setTimedOut(true);
      try { onTimeout?.(); } catch { /* never throw from watchdog */ }
    }, deadline);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading, deadline, onTimeout]);

  /** Manual reset — clears timedOut and restarts the timer if still loading. */
  const resetTimeout = useCallback(() => {
    if (!aliveRef.current) return;
    setTimedOut(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (loading) {
      timerRef.current = setTimeout(() => {
        if (!aliveRef.current) return;
        setTimedOut(true);
        try { onTimeout?.(); } catch { /* never throw */ }
      }, deadline);
    }
  }, [loading, deadline, onTimeout]);

  return { timedOut, resetTimeout };
}

export default useLoadingGuard;
