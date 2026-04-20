/**
 * stepUpRetryQueue.js — holds API request configs that were
 * rejected with 401 STEP_UP_REQUIRED, so that after the user
 * completes the StepUpModal challenge we can auto-replay
 * those requests instead of leaving admin pages empty.
 *
 * Design:
 *   • the API client calls `enqueueStepUpRetry(config)` which
 *     returns a promise; the original caller awaits that promise
 *   • on step-up success, `flushStepUpRetryQueue(retrier)` is
 *     called by StepUpModal. Each queued item is re-run via
 *     `retrier(config)` and its resolver/rejector wired up
 *   • on step-up cancel, `rejectStepUpRetryQueue(reason)` is
 *     called and every pending caller gets a clean rejection
 *     — no orphaned promises
 *
 * This module is STATE-FULL across the app (module-scoped
 * queue). That's intentional: only one StepUpModal can be
 * visible at a time, so one queue suffices.
 *
 * Contract is test-pure — `retrier` is injected, no direct
 * dependency on axios. Tests pass in a fake retrier.
 */

let queue = [];

/**
 * enqueueStepUpRetry — parks a rejected request's config.
 * Returns a promise the original caller awaits; it settles
 * when the queue is flushed or rejected.
 *
 * Each entry is independent — callers don't wait on each
 * other's requests.
 */
export function enqueueStepUpRetry(config) {
  return new Promise((resolve, reject) => {
    queue.push({ config, resolve, reject });
  });
}

/**
 * flushStepUpRetryQueue — replay every queued request via
 * the provided retrier function. Each replay's result is
 * pushed back to the original caller.
 *
 * The queue is cleared BEFORE replay starts so re-entrant
 * enqueues (a replay that itself 401s again) go into a
 * fresh queue rather than the one we're iterating.
 */
export async function flushStepUpRetryQueue(retrier) {
  if (typeof retrier !== 'function') {
    // No retrier — reject everything so we don't leak promises.
    return rejectStepUpRetryQueue(new Error('no_retrier'));
  }
  const batch = queue;
  queue = [];
  const results = [];
  for (const item of batch) {
    try {
      // Mark the config so the interceptor doesn't re-queue it
      // the moment it comes back through the client.
      const retryConfig = { ...(item.config || {}), _stepUpRetried: true };
      const res = await retrier(retryConfig);
      item.resolve(res);
      results.push({ status: 'fulfilled', value: res });
    } catch (err) {
      item.reject(err);
      results.push({ status: 'rejected', reason: err });
    }
  }
  return results;
}

/**
 * rejectStepUpRetryQueue — fail every pending item. Called
 * when the user cancels the StepUpModal.
 */
export function rejectStepUpRetryQueue(reason) {
  const batch = queue;
  queue = [];
  const err = reason instanceof Error ? reason : new Error(String(reason || 'step_up_cancelled'));
  for (const item of batch) {
    try { item.reject(err); } catch { /* noop */ }
  }
  return batch.length;
}

/** Returns the number of queued items — handy for dev assertions. */
export function stepUpRetryQueueSize() {
  return queue.length;
}

/** Test-only reset. NOT exported from index — keep internal. */
export function _resetStepUpRetryQueue() {
  queue = [];
}
