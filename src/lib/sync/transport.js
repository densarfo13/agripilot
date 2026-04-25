/**
 * transport.js — real implementation of the syncEngine transport
 * contract. Given a queued action, route it to the right server
 * endpoint and normalise the response into the shape syncEngine
 * expects.
 *
 *   transport.send(action) → Promise<{
 *     ok:      boolean,
 *     code?:   string,        // 'duplicate' | 'already_synced' | 'network_error' | 'server_error' | ...
 *     message?:string,
 *   }>
 *
 * Supported action types (v1)
 *   task.completed        payload: { farmId, templateId, completedAt }
 *   task.uncompleted      payload: { farmId, templateId }
 *   crop.update           payload: { farmId, crop, cropStage?, plantingDate? }
 *   farm.update           payload: { farmId, ...patch }
 *   photo.metadata        payload: { farmId, kind, metadata, clientId }
 *   listing.draft         payload: { crop, quantity, price?, location?, region? }
 *
 * Contract
 *   • A 2xx response OR 409 with {error: 'duplicate'} → ok:true.
 *   • Network error (fetch threw) → ok:false, code:'network_error'.
 *     The sync engine will leave the action queued and retry later.
 *   • 4xx (other than 409 duplicate) → ok:false, code:'validation_error'.
 *     The action will stay queued; pruneSynced won't drop it until the
 *     farmer manually clears. For v1 we accept that bad payloads linger.
 *   • 5xx → ok:false, code:'server_error'. Will retry next drain.
 *
 * Every request sets an Idempotency-Key header derived from the
 * action's stable id so the server can dedup if the same action is
 * retried after a flaky timeout.
 */

// ─── Route table ────────────────────────────────────────────────
// Each entry = { method, pathBuilder(action) → string, bodyBuilder(action) → object|null }
// Kept declarative so tests can assert the routing by type without
// mocking fetch itself.
export const ROUTES = Object.freeze({
  // Legacy names used by src/lib/dailyTasks/taskScheduler.js
  task_complete: {
    method: 'POST',
    path:  () => '/api/tasks/completed',
    body:  (a) => ({
      farmId:      (a.farmId || (a.payload && a.payload.farmId)) || null,
      templateId:  (a.taskId || (a.payload && a.payload.templateId)) || null,
      completedAt: (a.payload && a.payload.completedAt) || new Date(a.createdAt || Date.now()).toISOString(),
    }),
  },
  task_skip: {
    method: 'POST',
    path:  () => '/api/tasks/skipped',
    body:  (a) => ({
      farmId:     (a.farmId || (a.payload && a.payload.farmId)) || null,
      templateId: (a.taskId || (a.payload && a.payload.templateId)) || null,
      skippedAt:  (a.payload && a.payload.skippedAt) || new Date(a.createdAt || Date.now()).toISOString(),
    }),
  },
  task_uncomplete: {
    method: 'DELETE',
    path:  () => '/api/tasks/completed',
    body:  (a) => ({
      farmId:     (a.farmId || (a.payload && a.payload.farmId)) || null,
      templateId: (a.taskId || (a.payload && a.payload.templateId)) || null,
    }),
  },
  'crop.update': {
    method: 'PATCH',
    path:  (a) => `/api/farms/${encodeURIComponent(a.farmId || (a.payload && a.payload.farmId))}`,
    body:  (a) => {
      const p = a.payload || {};
      const out = {};
      if (p.crop != null)          out.crop         = p.crop;
      if (p.cropStage != null)     out.cropStage    = p.cropStage;
      if (p.plantingDate != null)  out.plantingDate = p.plantingDate;
      return out;
    },
  },
  'farm.update': {
    method: 'PATCH',
    path:  (a) => `/api/farms/${encodeURIComponent(a.farmId || (a.payload && a.payload.farmId))}`,
    body:  (a) => (a.payload && typeof a.payload === 'object' ? { ...a.payload } : {}),
  },
  'photo.metadata': {
    method: 'POST',
    path:  () => '/api/photos/metadata',
    body:  (a) => ({
      farmId:   (a.farmId || (a.payload && a.payload.farmId)) || null,
      kind:     (a.payload && a.payload.kind) || 'crop',
      metadata: (a.payload && a.payload.metadata) || null,
      clientId: (a.payload && a.payload.clientId) || null,
    }),
  },
  'listing.draft': {
    method: 'POST',
    path:  () => '/api/marketplace/list',
    body:  (a) => {
      const p = a.payload || {};
      const out = { crop: p.crop, quantity: Number(p.quantity) };
      if (p.price != null)    out.price    = Number(p.price);
      if (p.location)         out.location = p.location;
      if (p.region)           out.region   = p.region;
      if (p.farmId)           out.farmId   = p.farmId;
      return out;
    },
  },
});

export const SUPPORTED_TYPES = Object.freeze(Object.keys(ROUTES));

// ─── send(action) ───────────────────────────────────────────────
export async function send(action, opts = {}) {
  const fetchFn = opts.fetchFn || globalFetch;
  if (!action || !action.type) {
    return { ok: false, code: 'missing_action_type' };
  }
  const route = ROUTES[action.type];
  if (!route) {
    return { ok: false, code: 'unsupported_type',
      message: `No transport route for type "${action.type}"` };
  }

  const method = route.method;
  const path   = route.path(action);
  const body   = method === 'GET' ? null : route.body(action);

  const headers = { 'Content-Type': 'application/json' };
  if (action.id) headers['Idempotency-Key'] = action.id;

  // Single send attempt. The wrapper below handles 401 → refresh → retry once.
  async function attempt() {
    let res;
    try {
      res = await fetchFn(path, {
        method,
        headers,
        credentials: 'include',
        body: body == null ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      return {
        ok: false, code: 'network_error',
        message: (err && err.message) || 'fetch threw',
      };
    }
    let parsed = null;
    try { parsed = await res.json(); } catch { /* no-op */ }

    if (res.ok) return { ok: true, code: 'sent' };

    if (res.status === 401) {
      return { ok: false, code: 'unauthorized',
                message: (parsed && (parsed.error || parsed.message)) || 'unauthorized' };
    }

    if (res.status === 409
        && parsed
        && (parsed.error === 'duplicate'
          || parsed.reason === 'duplicate'
          || parsed.error === 'already_synced'
          || parsed.reason === 'already_synced')) {
      return { ok: false, code: 'duplicate' };
    }

    if (res.status >= 500) {
      return {
        ok: false, code: 'server_error',
        message: (parsed && (parsed.error || parsed.message)) || `HTTP ${res.status}`,
      };
    }
    return {
      ok: false,
      code: (parsed && (parsed.error || parsed.reason)) || 'validation_error',
      message: (parsed && parsed.message) || `HTTP ${res.status}`,
    };
  }

  // Fix 1 — Production-stability hardening §1:
  //   401 during offline-queue sync triggers a token refresh + a
  //   single retry. If the refresh itself fails, we surface the
  //   401 unchanged so the engine moves the action to FAILED
  //   instead of looping. The refresh is deliberately optional —
  //   tests inject a stub; real callers wire the auth client.
  let result = await attempt();
  if (result.code === 'unauthorized' && typeof opts.refreshAuth === 'function') {
    let refreshed = false;
    try { refreshed = await opts.refreshAuth(); }
    catch { refreshed = false; }
    if (refreshed) {
      result = await attempt();
    }
  }
  return result;
}

function globalFetch(...args) {
  if (typeof fetch === 'function') return fetch(...args);
  throw new Error('fetch_unavailable');
}

/**
 * makeTransport({ fetchFn?, refreshAuth? }) — returns the `{ send }`
 * shape the syncEngine expects.
 *
 *   refreshAuth: async () => boolean   // returns true when refresh
 *                                       // succeeded; false otherwise
 *   fetchFn:     test-injected fetch (defaults to global fetch)
 *
 * On a 401 response from the server, send() invokes refreshAuth()
 * once and retries. If refresh fails (or isn't supplied), the 401
 * is surfaced unchanged and the syncEngine treats it like any other
 * non-retryable failure.
 */
export function makeTransport({ fetchFn, refreshAuth } = {}) {
  return Object.freeze({
    send: (action) => send(action, { fetchFn, refreshAuth }),
  });
}

export const _internal = Object.freeze({ ROUTES, SUPPORTED_TYPES });
