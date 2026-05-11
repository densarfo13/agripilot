/**
 * withBootstrapTimeout — safely race a promise against a wall-clock limit.
 *
 * Unlike a reject-based race, this ALWAYS resolves (never throws) so callers
 * can use it without a try/catch. On timeout the `fallback` value is returned
 * and a greppable warning is emitted.
 *
 * Usage:
 *   const data = await withBootstrapTimeout(fetchFarm(), 3000, null);
 *   // data is null if the fetch hung for > 3 seconds
 *
 * Promise.allSettled companion — use together for parallel steps:
 *   const [a, b] = await Promise.allSettled([
 *     withBootstrapTimeout(loadFarm(),    3000, null),
 *     withBootstrapTimeout(loadWeather(), 3000, null),
 *   ]);
 *   const farm    = a.status === 'fulfilled' ? a.value : null;
 *   const weather = b.status === 'fulfilled' ? b.value : null;
 *
 * @param {Promise<T>}  promise   - any promise
 * @param {number}      ms        - timeout in milliseconds (default 3000)
 * @param {T}           fallback  - value to return on timeout (default null)
 * @param {string}      [label]   - optional label for the warning log
 * @returns {Promise<T>}
 */
export function withBootstrapTimeout(promise, ms = 3000, fallback = null, label = '') {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        // eslint-disable-next-line no-console
        console.warn(
          '[FARROWAY_TIMEOUT]',
          label || 'Bootstrap step',
          `timed out after ${ms}ms — using fallback.`,
        );
      } catch { /* never throw from a diagnostic */ }
      resolve(fallback);
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Suppress the expected "not authenticated" / 401 shape —
        // the lib/api.js gate intentionally rejects authenticated
        // requests with this when the session is dead / missing.
        // Surfacing it here as a [FARROWAY_TIMEOUT] warn looks like
        // a real failure to readers of the DevTools console; the
        // bootstrap fallback path already handles the outcome.
        const isAuthNoise =
          err && (err.status === 401 || err.notAuthenticated === true);
        if (!isAuthNoise) {
          try {
            // eslint-disable-next-line no-console
            console.warn(
              '[FARROWAY_TIMEOUT]',
              label || 'Bootstrap step',
              'rejected:',
              err && (err.message || err),
            );
          } catch { /* swallow */ }
        }
        resolve(fallback);
      },
    );
  });
}

/**
 * allSettledSafe — Promise.allSettled wrapper that enforces a per-call
 * timeout and always resolves. Every item gets an independent timeout
 * so one slow call can't hold the others hostage.
 *
 * Returns an array of the resolved/fallback values (not SettledResult
 * objects) — simpler to consume when you just need the data.
 *
 * @param {Array<{promise: Promise, ms?: number, fallback?: *, label?: string}>} steps
 * @returns {Promise<Array<*>>}
 */
export function allSettledSafe(steps) {
  return Promise.all(
    steps.map(({ promise, ms = 3000, fallback = null, label = '' }) =>
      withBootstrapTimeout(promise, ms, fallback, label)),
  );
}
