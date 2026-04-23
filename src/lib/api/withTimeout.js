/**
 * withTimeout.js — shared fetch/request timeout strategy.
 *
 * The audit found dashboards (Organization, CropRecommendations) can
 * hang forever on flaky networks because top-level `useEffect`
 * loaders have no timeout. This helper wraps any promise-returning
 * fetch with a deadline + AbortController so the caller always
 * resolves — with either data or a typed error — within the budget.
 *
 *   withTimeout(signalFactory, { ms = 15000, label })
 *     signalFactory: (signal) => Promise
 *     → { ok: true,  data }
 *     → { ok: false, code: 'timeout' | 'aborted' | 'network'
 *                         | 'http' | 'parse' | 'unknown',
 *                    status?, message?, details? }
 *
 * Contract
 *   • Never throws. Callers branch on `ok`.
 *   • Callers can `setLoading(false)` unconditionally on resolution.
 *   • Typed error codes let the UI show the right message:
 *       timeout → "Network is slow — tap retry"
 *       http    → "Server error — we'll try again"
 *       aborted → silent (user navigated away)
 *
 * Usage:
 *   const res = await withTimeout((signal) =>
 *     fetch(url, { signal }).then((r) => {
 *       if (!r.ok) throw Object.assign(new Error('http'),
 *         { code: 'http', status: r.status });
 *       return r.json();
 *     }),
 *     { ms: 15000, label: 'dashboard.load' });
 *   if (!res.ok) setError(translateErrorCode(res.code));
 *   else        setData(res.data);
 *   setLoading(false);
 */

export async function withTimeout(signalFactory, { ms = 15000, label = null } = {}) {
  const controller = new AbortController();
  const signal = controller.signal;
  let timer = null;
  let timedOut = false;

  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      try { controller.abort(); } catch { /* ignore */ }
      resolve({ ok: false, code: 'timeout', message: `Timed out after ${ms}ms`,
                 details: label ? { label } : null });
    }, ms);
  });

  const work = (async () => {
    try {
      const data = await signalFactory(signal);
      return { ok: true, data };
    } catch (err) {
      if (timedOut) return null;    // timeout wins
      // AbortError (user navigated / re-ran query).
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        return { ok: false, code: 'aborted' };
      }
      // Typed error thrown by the caller (e.g. HTTP !ok).
      if (err && err.code === 'http') {
        return { ok: false, code: 'http',
                  status: err.status,
                  message: err.message || 'HTTP error' };
      }
      if (err && (err.name === 'TypeError' || /network|failed to fetch/i.test(String(err.message)))) {
        return { ok: false, code: 'network',
                  message: String(err && err.message || 'Network error') };
      }
      if (err && /json|parse|unexpected token/i.test(String(err.message))) {
        return { ok: false, code: 'parse',
                  message: String(err && err.message) };
      }
      return { ok: false, code: 'unknown',
                message: String(err && err.message || err || 'Unknown error') };
    }
  })();

  const result = await Promise.race([work, timeout]);
  if (timer) clearTimeout(timer);
  // If `work` settled AFTER timeout was announced, prefer the timeout
  // outcome — the caller already got its deadline response.
  return result || { ok: false, code: 'timeout', message: `Timed out after ${ms}ms` };
}

/**
 * translateErrorCode(code, t)
 *   UI helper: resolves the structured error code to an i18n key so
 *   error states stay language-safe.
 */
export function translateErrorCode(code) {
  const keys = {
    timeout: 'error.timeout',
    network: 'error.network',
    http:    'error.server',
    parse:   'error.parse',
    aborted: 'error.aborted',
    unknown: 'error.unknown',
  };
  return keys[code] || 'error.unknown';
}

export const _internal = Object.freeze({ /* reserved */ });
