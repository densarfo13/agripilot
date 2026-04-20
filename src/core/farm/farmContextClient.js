/**
 * farmContextClient.js — pure client for GET /api/farm/:id/context.
 *
 * Unwraps the server's { success, data } envelope, normalizes
 * errors into a stable shape, and provides a small state-machine
 * helper reducer so the hook layer can be trivially thin.
 *
 * Pure. Fetcher is injectable so tests stub it with a fake.
 */

const DEFAULT_BASE = '/api';

/**
 * fetchFarmContext(farmId, opts?) → Promise<Result>
 *
 * Result shape:
 *   { ok: true,  data: <the context object> }
 *   { ok: false, error: 'string', status?: number }
 *
 * Never rejects. Network errors become `{ok:false, error:'network'}`.
 * 4xx/5xx with a JSON error payload become `{ok:false, error, status}`.
 */
export async function fetchFarmContext(farmId, opts = {}) {
  if (!farmId || typeof farmId !== 'string') {
    return { ok: false, error: 'missing_farm_id', status: 400 };
  }
  const base   = opts.base || DEFAULT_BASE;
  const url    = `${base}/farm/${encodeURIComponent(farmId)}/context`;
  const fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) return { ok: false, error: 'no_fetch' };

  let response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      credentials: opts.credentials || 'include',
      signal: opts.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'aborted', aborted: true };
    return { ok: false, error: 'network', message: err?.message || 'unknown' };
  }

  const status = response?.status ?? 0;
  let body = null;
  try { body = await response.json(); }
  catch { body = null; }

  if (!response.ok) {
    const msg = (body && body.error) || `HTTP ${status}`;
    return { ok: false, error: String(msg), status };
  }

  // Expect the standard envelope { success, data }. Fall back to
  // treating the whole body as data if the server forgot to wrap.
  if (body && typeof body === 'object' && body.success === true && body.data !== undefined) {
    return { ok: true, data: body.data };
  }
  if (body && typeof body === 'object' && body.success === false) {
    return { ok: false, error: String(body.error || 'server_failure'), status };
  }
  return { ok: true, data: body };
}

// ─── Tiny state-machine reducer for the hook ─────────────────
// States: 'idle' | 'loading' | 'ready' | 'error'

export const INITIAL_CONTEXT_STATE = Object.freeze({
  status: 'idle',
  data:   null,
  error:  null,
  farmId: null,
});

export function contextStateReducer(state, action) {
  const a = action || {};
  switch (a.type) {
    case 'start':
      return { status: 'loading', data: state?.data || null, error: null, farmId: a.farmId || null };
    case 'resolve':
      return { status: 'ready', data: a.data || null, error: null, farmId: state?.farmId || null };
    case 'fail':
      return { status: 'error', data: state?.data || null, error: a.error || 'unknown', farmId: state?.farmId || null };
    case 'reset':
      return INITIAL_CONTEXT_STATE;
    default:
      return state || INITIAL_CONTEXT_STATE;
  }
}

/**
 * runFarmContextFetch — higher-order runner that wires the
 * fetcher into the reducer. Dispatcher is injected so both the
 * React hook and unit tests can drive the same state machine.
 */
export async function runFarmContextFetch({ farmId, dispatch, fetcher, signal, base, credentials }) {
  if (typeof dispatch !== 'function') return;
  dispatch({ type: 'start', farmId });
  const runner = typeof fetcher === 'function' ? fetcher : fetchFarmContext;
  const result = await runner(farmId, { signal, base, credentials });
  if (result?.aborted) return;
  if (result?.ok) dispatch({ type: 'resolve', data: result.data });
  else dispatch({ type: 'fail', error: result?.error || 'unknown' });
}
