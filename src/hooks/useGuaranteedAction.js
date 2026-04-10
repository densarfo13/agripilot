import { useState, useRef, useCallback } from 'react';

/**
 * useGuaranteedAction — shared first-use guarantee layer.
 *
 * Wraps any critical async action with:
 *   - explicit state (idle | loading | success | error | retryable | saved_offline)
 *   - timeout protection (no indefinite spinner)
 *   - double-submit guard
 *   - retry with state preservation
 *   - offline detection + fallback
 *
 * Usage:
 *   const { run, state, error, message, reset } = useGuaranteedAction({
 *     timeoutMs: 10000,
 *     onOffline: (args) => { ... queue to IDB ... },
 *   });
 *
 *   await run(async () => { ... your action ... });
 */

/** Action states */
export const ACTION_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  RETRYABLE: 'retryable',
  SAVED_OFFLINE: 'saved_offline',
};

const DEFAULT_TIMEOUT_MS = 10000;
const STILL_WORKING_MS = 4000; // show "Still working..." after this

export default function useGuaranteedAction(opts = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onOffline,
  } = opts;

  const [state, setState] = useState(ACTION_STATE.IDLE);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stillWorking, setStillWorking] = useState(false);
  const guardRef = useRef(false);
  const lastArgsRef = useRef(null);
  const lastActionRef = useRef(null);
  const abortRef = useRef(null);

  /**
   * Run a critical action with full guarantee layer.
   * @param {Function} actionFn - async function to execute
   * @param {*} args - optional args (preserved for retry)
   * @returns {*} result of actionFn if successful
   */
  const run = useCallback(async (actionFn, args) => {
    // Double-submit guard
    if (guardRef.current) return;
    guardRef.current = true;

    lastActionRef.current = actionFn;
    lastArgsRef.current = args;

    setState(ACTION_STATE.LOADING);
    setError('');
    setMessage('');
    setStillWorking(false);

    // "Still working..." timer
    const stillTimer = setTimeout(() => setStillWorking(true), STILL_WORKING_MS);

    // Timeout race
    let timedOut = false;
    const timeoutPromise = new Promise((_, reject) => {
      abortRef.current = setTimeout(() => {
        timedOut = true;
        reject(new Error('__timeout__'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        actionFn(args),
        timeoutPromise,
      ]);

      clearTimeout(abortRef.current);
      clearTimeout(stillTimer);
      setState(ACTION_STATE.SUCCESS);
      setMessage('');
      guardRef.current = false;
      return result;
    } catch (err) {
      clearTimeout(abortRef.current);
      clearTimeout(stillTimer);
      guardRef.current = false;

      // Timeout
      if (timedOut || err?.message === '__timeout__') {
        setState(ACTION_STATE.RETRYABLE);
        setError('Taking too long. Please try again.');
        setMessage('');
        return;
      }

      // Offline / network failure
      const isNetworkError = !err?.response && (
        err?.code === 'ERR_NETWORK' ||
        err?.message === 'Network Error' ||
        !navigator.onLine
      );

      if (isNetworkError) {
        if (onOffline) {
          try {
            await onOffline(lastArgsRef.current);
            setState(ACTION_STATE.SAVED_OFFLINE);
            setMessage('Saved offline. Will sync when you reconnect.');
            return;
          } catch {
            // Offline save failed — fall through to retryable
          }
        }
        setState(ACTION_STATE.RETRYABLE);
        setError('No internet connection. Please try again.');
        return;
      }

      // Server error (4xx/5xx)
      const serverMsg = err?.response?.data?.error || err?.message || 'Something went wrong.';
      const status = err?.response?.status;

      // 409 = already processed (idempotency) — treat as success
      if (status === 409) {
        setState(ACTION_STATE.SUCCESS);
        setMessage('Already saved.');
        return;
      }

      // 4xx = client error (non-retryable unless 429)
      if (status >= 400 && status < 500 && status !== 429) {
        setState(ACTION_STATE.ERROR);
        setError(serverMsg);
        return;
      }

      // 5xx or 429 = retryable
      setState(ACTION_STATE.RETRYABLE);
      setError(serverMsg);
    }
  }, [timeoutMs, onOffline]);

  /**
   * Retry the last action with same args.
   */
  const retry = useCallback(async () => {
    if (lastActionRef.current) {
      return run(lastActionRef.current, lastArgsRef.current);
    }
  }, [run]);

  /**
   * Reset to idle state.
   */
  const reset = useCallback(() => {
    setState(ACTION_STATE.IDLE);
    setError('');
    setMessage('');
    setStillWorking(false);
    guardRef.current = false;
  }, []);

  return {
    run,
    retry,
    reset,
    state,
    error,
    message,
    stillWorking,
    isIdle: state === ACTION_STATE.IDLE,
    isLoading: state === ACTION_STATE.LOADING,
    isSuccess: state === ACTION_STATE.SUCCESS,
    isError: state === ACTION_STATE.ERROR,
    isRetryable: state === ACTION_STATE.RETRYABLE,
    isSavedOffline: state === ACTION_STATE.SAVED_OFFLINE,
  };
}
