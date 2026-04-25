/**
 * normalizeApiResponse — P5.15
 *
 * The Farroway / agripilot backend has accumulated several response
 * shapes over its lifetime — older v1 routes return
 *   { success: true, data }  /  { success: false, error }
 * v2 routes return
 *   { ok: true, … }  /  { ok: false, error }
 * and a handful of routes return the data object directly. This
 * helper coerces any of those into ONE canonical shape:
 *
 *   { ok: boolean, data: any, error: string|null, code: string|null,
 *     fieldErrors: object, status: number|null, raw: any }
 *
 * Use it at every call site that reads an API response so UI code
 * doesn't have to guess which envelope the server returned. Once
 * every caller goes through this helper we can migrate the server
 * to a single shape without breaking the frontend.
 *
 * Contract:
 *   • Pure function. Never throws — even on malformed input.
 *   • If the input is an Error (thrown by `request()` in api.js),
 *     `ok` is false and `status` / `fieldErrors` are pulled off it.
 *   • If the input is a primitive / null / undefined, `ok` is false
 *     and `data` mirrors the input.
 *
 *   normalizeApiResponse({ success: true, profile: {...} })
 *     → { ok: true, data: { profile: {...} }, error: null, … }
 *
 *   normalizeApiResponse({ ok: false, error: 'nope', code: 'X' })
 *     → { ok: false, data: null, error: 'nope', code: 'X', … }
 *
 *   normalizeApiResponse(thrownError)
 *     → { ok: false, data: null, error: err.message,
 *         status: err.status ?? null, fieldErrors: err.fieldErrors ?? {} }
 */

const EMPTY = Object.freeze({});

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function normalizeApiResponse(input) {
  // ── Error branch — caller threw or passed a rejected payload ──
  if (input instanceof Error) {
    return Object.freeze({
      ok: false,
      data: null,
      error: input.message || 'Request failed',
      code: input.code || null,
      fieldErrors: input.fieldErrors || EMPTY,
      status: typeof input.status === 'number' ? input.status : null,
      raw: input,
    });
  }

  // ── Non-object branch — undefined / null / primitives ─────────
  if (!isPlainObject(input)) {
    return Object.freeze({
      ok: false,
      data: input ?? null,
      error: input == null ? 'Empty response' : null,
      code: null,
      fieldErrors: EMPTY,
      status: null,
      raw: input,
    });
  }

  // ── Detect ok-flag (prefer explicit ok, fall back to success) ─
  let ok;
  if (typeof input.ok === 'boolean') ok = input.ok;
  else if (typeof input.success === 'boolean') ok = input.success;
  else ok = !input.error;          // assume happy path when nothing's flagged

  // Pick the data payload. Priority order:
  //   1. explicit `data`
  //   2. explicit `result`
  //   3. the rest of the object minus envelope keys (so legacy
  //      `{ success: true, profile: {...} }` still surfaces profile)
  let data;
  if (input.data !== undefined) {
    data = input.data;
  } else if (input.result !== undefined) {
    data = input.result;
  } else {
    const rest = { ...input };
    delete rest.ok; delete rest.success;
    delete rest.error; delete rest.code; delete rest.message;
    delete rest.fieldErrors; delete rest.status;
    data = Object.keys(rest).length === 0 ? null : rest;
  }

  const error = ok
    ? null
    : (input.error || input.message || 'Request failed');

  return Object.freeze({
    ok,
    data: ok ? data : null,
    error,
    code: input.code || null,
    fieldErrors: input.fieldErrors || EMPTY,
    status: typeof input.status === 'number' ? input.status : null,
    raw: input,
  });
}

/**
 * Wrap a promise-returning api call so the consumer sees the
 * normalized shape regardless of throw / resolve.
 *
 *   const res = await safeCall(() => updateFarm(id, patch));
 *   if (!res.ok) showError(res.error);
 */
export async function safeCall(fn) {
  try {
    const value = await fn();
    return normalizeApiResponse(value);
  } catch (err) {
    return normalizeApiResponse(err);
  }
}

export default normalizeApiResponse;
