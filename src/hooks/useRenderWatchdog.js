/**
 * useRenderWatchdog — detects blank or near-empty renders and
 * triggers a safe fallback or retry.
 *
 * PROBLEM SOLVED
 * ──────────────
 * A component can technically "mount" and "render" from React's
 * perspective while producing zero visible content for the user.
 * This happens when:
 *   • All children are null / undefined (conditional rendering gone wrong)
 *   • An async loading gate never resolves (infinite loading)
 *   • CSS `display: none` hides everything due to a class conflict
 *   • The content area is empty because the data array is []
 *
 * The blank-screen watchdog in main.jsx catches app-level blanks at
 * 4 s. useRenderWatchdog is the per-component/per-route companion:
 * it fires after a configurable delay and runs a lightweight check
 * to decide if the component tree produced meaningful output.
 *
 * USAGE
 * ─────
 *   function TasksPage() {
 *     const { isEmpty, reported } = useRenderWatchdog({
 *       containerId: 'tasks-page',
 *       route: '/tasks',
 *       minTextLength: 30,
 *       delayMs: 3000,
 *     });
 *
 *     if (isEmpty) return <TasksFallback />;
 *     return <div id="tasks-page">...</div>;
 *   }
 *
 * BEHAVIOUR
 * ─────────
 *   1. After `delayMs` ms the watchdog reads the container element.
 *   2. If `children.length === 0` OR `innerText.length < minTextLength`
 *      it sets `isEmpty = true`.
 *   3. On `isEmpty`, `reported` is also set and a diagnostic event
 *      fires (once) so the engineering team can triage the route.
 *   4. The watchdog resets on every remount (route navigation).
 *
 * PROPS
 * ─────
 *   containerId   {string}  — ID of the container element to inspect
 *   route         {string}  — route label for reporting (not PII)
 *   minTextLength {number}  — minimum innerText length to consider non-empty (default 20)
 *   delayMs       {number}  — ms to wait before checking (default 3000)
 *   onEmpty       {fn}      — optional callback when blank is detected
 *   disabled      {boolean} — disable the watchdog (e.g. on pages that load slowly)
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • All hooks unconditional — rules-of-hooks compliant.
 *   • No forced re-renders on the happy path.
 *   • Cleanup on unmount — no setState after unmount.
 *   • DOM access wrapped in try/catch — never throws.
 *   • SSR-safe — document access guarded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS       = 3_000;
const DEFAULT_MIN_TEXT_LEN   = 20;

/**
 * @param {{
 *   containerId?:   string,
 *   route?:         string,
 *   minTextLength?: number,
 *   delayMs?:       number,
 *   onEmpty?:       (route: string) => void,
 *   disabled?:      boolean,
 * }} opts
 * @returns {{ isEmpty: boolean, reported: boolean, reset: () => void }}
 */
export function useRenderWatchdog(opts = {}) {
  const {
    containerId,
    route     = window?.location?.pathname || '(unknown)',
    minTextLength = DEFAULT_MIN_TEXT_LEN,
    delayMs       = DEFAULT_DELAY_MS,
    onEmpty,
    disabled  = false,
  } = opts;

  const [isEmpty,  setIsEmpty]  = useState(false);
  const [reported, setReported] = useState(false);
  const timerRef  = useRef(null);
  const aliveRef  = useRef(true);
  const firedRef  = useRef(false);

  const _check = useCallback(() => {
    if (!aliveRef.current) return;
    if (firedRef.current)  return;

    try {
      const el = containerId
        ? document.getElementById(containerId)
        : document.getElementById('root');

      if (!el) return; // Element not mounted yet — not a blank.

      const childCount = el.children ? el.children.length : 0;
      const textLength = typeof el.innerText === 'string' ? el.innerText.trim().length : 9999;

      const isBlank = (childCount === 0) || (textLength < minTextLength);

      if (isBlank) {
        firedRef.current = true;
        setIsEmpty(true);
        setReported(true);

        // Callback for caller.
        try { onEmpty?.(route); } catch { /* swallow */ }

        // Report to analytics (fire-and-forget).
        try {
          import('../lib/analytics.js')
            .then((m) => {
              try {
                m.safeTrackEvent?.('blank_render_detected', {
                  route,
                  containerId: containerId || 'root',
                  childCount,
                  textLength,
                });
              } catch { /* ignore */ }
            })
            .catch(() => { /* ignore */ });
        } catch { /* ignore */ }

        // Diagnostic log (dev only).
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
           
          console.warn(
            `[useRenderWatchdog] Blank render detected at "${route}" — `
            + `container=${containerId || 'root'}, `
            + `children=${childCount}, textLen=${textLength}`,
          );
        }
      }
    } catch { /* never crash the watchdog */ }
  }, [containerId, route, minTextLength, onEmpty]);

  // Arm watchdog after delayMs.
  useEffect(() => {
    aliveRef.current = true;
    firedRef.current = false;

    if (disabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(_check, delayMs);

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [_check, delayMs, disabled]);

  /** Manual reset — clears isEmpty + re-arms the watchdog. */
  const reset = useCallback(() => {
    if (!aliveRef.current) return;
    firedRef.current = false;
    setIsEmpty(false);
    setReported(false);
    if (!disabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(_check, delayMs);
    }
  }, [_check, delayMs, disabled]);

  return { isEmpty, reported, reset };
}

export default useRenderWatchdog;
