/**
 * farmWorkerRegistry.js — lightweight async job runner for the
 * "Background AI Workers" layer (spec §5).
 *
 *   registerWorker('scan_enrichment', async (payload) => {
 *     return await enrichScan(payload);
 *   });
 *
 *   const result = await enqueueWork('scan_enrichment', { scanId });
 *
 * Honest design
 * ─────────────
 *   The spec lists "background workers" for weather analysis,
 *   outbreak clustering, scan enrichment, etc. The honest unit is
 *   NOT a Web Worker (overkill for the actual work we do — none
 *   of our helpers are CPU-bound enough to need a separate
 *   thread). What we DO need is:
 *
 *     • a registry so any caller can name a job kind
 *     • async fire-and-forget so the UI never blocks
 *     • telemetry hooks (count, timing, error rate) per job kind
 *     • backpressure: per-worker concurrency cap so a slow job
 *       can't queue up infinitely
 *     • last-write-wins de-duplication for jobs with the same
 *       dedupeKey (so two rapid-fire "recalculate risks" calls
 *       only run once)
 *
 *   When real CPU work appears (e.g. ML inference), this module
 *   stays the public API — its impl can swap to actual Web Workers
 *   without touching callers.
 *
 * Strict-rule audit
 *   • Workers run via Promise.resolve().then() so they never block
 *     the calling stack.
 *   • Every job is wrapped in telemetry; failures don't propagate
 *     to other queued jobs.
 *   • The in-flight queue is bounded — when QUEUE_CAP is hit, new
 *     submissions reject so the caller can fall back gracefully.
 *   • Workers can be unregistered (sign-out / test reset).
 */

import { trackCount, trackTiming, trackError } from './farmTelemetry.js';

export const QUEUE_CAP = 32;
const _DEFAULT_CONCURRENCY = 2;

const _workers = new Map();   // name -> { fn, concurrency, inflight, queue, lastByKey }

// ─── Helpers ──────────────────────────────────────────────────

function _now() { try { return Date.now(); } catch { return 0; } }

function _safeName(n) {
  return (typeof n === 'string' && n) ? n : null;
}

function _err(msg) { return new Error(msg); }

// ─── Public API ──────────────────────────────────────────────

/**
 * Register an async worker. Re-registering the same name overrides
 * the previous impl (so feature flags can swap implementations).
 *
 * @param {string} name
 * @param {(payload: any) => Promise<any>} fn
 * @param {{ concurrency?: number }} [options]
 */
export function registerWorker(name, fn, options) {
  const n = _safeName(name);
  if (!n) return;
  if (typeof fn !== 'function') return;
  const concurrency = (options && typeof options.concurrency === 'number')
    ? Math.max(1, Math.floor(options.concurrency))
    : _DEFAULT_CONCURRENCY;
  _workers.set(n, {
    fn,
    concurrency,
    inflight:  0,
    queue:     [],       // pending { payload, dedupeKey, resolve, reject }
    lastByKey: new Map(),
  });
}

/**
 * Whether a worker is registered for a name.
 */
export function hasWorker(name) {
  return _workers.has(_safeName(name));
}

/**
 * Submit a job. Returns a promise that resolves with the worker's
 * return value (or rejects with its error).
 *
 * @param {string} name
 * @param {any} payload
 * @param {{ dedupeKey?: string }} [options]
 * @returns {Promise<any>}
 */
export function enqueueWork(name, payload, options) {
  const n = _safeName(name);
  if (!n) return Promise.reject(_err('worker_name_required'));
  const worker = _workers.get(n);
  if (!worker) return Promise.reject(_err('worker_not_registered:' + n));
  if (worker.queue.length >= QUEUE_CAP) {
    return Promise.reject(_err('worker_queue_full:' + n));
  }

  const dedupeKey = (options && typeof options.dedupeKey === 'string' && options.dedupeKey)
    ? options.dedupeKey : null;

  // Last-write-wins de-duplication: if a job with the same dedupeKey
  // is already queued, we replace its payload with the new one and
  // return the EXISTING promise so the caller awaits the same result.
  if (dedupeKey && worker.lastByKey.has(dedupeKey)) {
    const existing = worker.lastByKey.get(dedupeKey);
    if (existing && !existing._consumed) {
      existing.payload = payload;
      trackCount('worker.' + n + '.deduped');
      return existing.promise;
    }
  }

  let resolveOuter, rejectOuter;
  const promise = new Promise((res, rej) => { resolveOuter = res; rejectOuter = rej; });
  const job = { payload, dedupeKey, resolve: resolveOuter, reject: rejectOuter, promise, _consumed: false };
  worker.queue.push(job);
  if (dedupeKey) worker.lastByKey.set(dedupeKey, job);

  trackCount('worker.' + n + '.enqueued');
  // Kick the drain on the next microtask so the caller's stack
  // unwinds first — workers run truly async.
  Promise.resolve().then(() => _drain(n));
  return promise;
}

/**
 * Unregister a worker (sign-out / debug). Pending jobs reject.
 */
export function unregisterWorker(name) {
  const n = _safeName(name);
  if (!n) return;
  const w = _workers.get(n);
  if (!w) return;
  for (const job of w.queue) {
    try { job.reject(_err('worker_unregistered:' + n)); }
    catch { /* swallow */ }
  }
  _workers.delete(n);
}

/**
 * Read-only snapshot of every worker's current state. Handy for
 * a debug overlay.
 */
export function getWorkerRegistry() {
  const out = {};
  for (const [name, w] of _workers.entries()) {
    out[name] = {
      concurrency: w.concurrency,
      inflight:    w.inflight,
      queued:      w.queue.length,
    };
  }
  return out;
}

/**
 * Wipe everything. Test helper.
 */
export function _resetWorkers() {
  for (const w of _workers.values()) {
    for (const job of w.queue) {
      try { job.reject(_err('worker_reset')); } catch { /* swallow */ }
    }
  }
  _workers.clear();
}

// ─── Internal: drain loop ────────────────────────────────────

function _drain(name) {
  const worker = _workers.get(name);
  if (!worker) return;
  while (worker.inflight < worker.concurrency && worker.queue.length > 0) {
    const job = worker.queue.shift();
    job._consumed = true;
    worker.inflight += 1;
    if (job.dedupeKey) worker.lastByKey.delete(job.dedupeKey);

    const t = trackTiming('worker.' + name);
    Promise.resolve()
      .then(() => worker.fn(job.payload))
      .then((result) => {
        t.end();
        trackCount('worker.' + name + '.success');
        try { job.resolve(result); } catch { /* swallow */ }
      })
      .catch((err) => {
        t.end();
        trackCount('worker.' + name + '.failure');
        trackError('worker.' + name, err);
        try { job.reject(err); } catch { /* swallow */ }
      })
      .finally(() => {
        worker.inflight -= 1;
        // More work waiting? Drain on the next microtask so we
        // don't blow the stack.
        if (worker.queue.length > 0) Promise.resolve().then(() => _drain(name));
      });
  }
}

export default {
  registerWorker,
  hasWorker,
  enqueueWork,
  unregisterWorker,
  getWorkerRegistry,
  _resetWorkers,
  QUEUE_CAP,
};
