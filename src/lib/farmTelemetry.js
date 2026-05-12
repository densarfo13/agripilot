/**
 * farmTelemetry.js — observability primitive for the event-driven
 * architecture (spec §8).
 *
 *   trackCount('scan.completed');
 *   const t = trackTiming('weather_fetch');
 *   await doWeatherFetch();
 *   t.end();
 *   trackError('weather_fetch', err);
 *
 *   const snap = getTelemetrySnapshot();
 *   // → { counts, timings, errors, sinceMs }
 *
 * What it is
 * ──────────
 *   A pure, in-memory rolling-window aggregator over:
 *     • counts        — { eventName: integer }
 *     • timings       — { opName: { count, avgMs, p50Ms, p95Ms } }
 *     • errors        — { opName: { count, lastError, lastAt } }
 *
 *   We DELIBERATELY don't ship to a network endpoint. That's a
 *   product decision (which analytics vendor? which PII rules?)
 *   and belongs in its own spec. This layer's job is to make
 *   diagnostic data available locally so any future shipper can
 *   read from one place.
 *
 *   The existing analyticsStore + moatTrack continue to handle
 *   product analytics. FarmTelemetry is the OPERATIONAL layer
 *   (latency, success rate, crash rate) the spec asked for.
 *
 * Strict-rule audit
 *   • All trackers are fire-and-forget; never throw.
 *   • Memory-bounded: per-op timing buffer capped at 200 samples,
 *     count map capped by event-name variety (we don't dynamic-
 *     create keys; callers pass stable strings).
 *   • Pure read API for the snapshot — caller can't mutate.
 *   • Rolling window for timings (only the most recent samples
 *     count toward p50/p95) so a one-off spike doesn't poison
 *     the readout forever.
 */

const _TIMING_SAMPLE_CAP = 200;

// ─── State ────────────────────────────────────────────────────

const _counts   = new Map();   // name -> integer
const _timings  = new Map();   // name -> number[] (ms)
const _errors   = new Map();   // name -> { count, lastError, lastAt }
const _startTs  = (() => { try { return Date.now(); } catch { return 0; } })();

// ─── Helpers ──────────────────────────────────────────────────

function _now() { try { return Date.now(); } catch { return 0; } }

function _safeName(name) {
  return (typeof name === 'string' && name) ? name : null;
}

function _quantile(sorted, q) {
  if (!sorted || sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Increment a named counter. Returns the new count.
 *
 * @param {string} name
 * @param {number} [by=1]
 * @returns {number}
 */
export function trackCount(name, by) {
  const n = _safeName(name);
  if (!n) return 0;
  const delta = (typeof by === 'number' && Number.isFinite(by)) ? by : 1;
  const next = (_counts.get(n) || 0) + delta;
  _counts.set(n, next);
  return next;
}

/**
 * Start a timing. Returns a { end() } handle. Calling end() multiple
 * times is a no-op after the first.
 *
 * @param {string} name
 * @returns {{ end: () => number, cancel: () => void }}
 */
export function trackTiming(name) {
  const n = _safeName(name);
  const startedAt = _now();
  let ended = false;
  return {
    end() {
      if (ended) return 0;
      ended = true;
      if (!n) return 0;
      const ms = Math.max(0, _now() - startedAt);
      let buf = _timings.get(n);
      if (!buf) { buf = []; _timings.set(n, buf); }
      buf.push(ms);
      if (buf.length > _TIMING_SAMPLE_CAP) {
        buf.splice(0, buf.length - _TIMING_SAMPLE_CAP);
      }
      return ms;
    },
    cancel() { ended = true; },
  };
}

/**
 * Record an error for an op. Stores the count + last error message.
 *
 * @param {string} name
 * @param {Error|string} err
 */
export function trackError(name, err) {
  const n = _safeName(name);
  if (!n) return;
  const msg = (err && err.message) ? String(err.message)
            : (typeof err === 'string' ? err : 'unknown_error');
  const existing = _errors.get(n);
  if (existing) {
    existing.count += 1;
    existing.lastError = msg;
    existing.lastAt = _now();
  } else {
    _errors.set(n, { count: 1, lastError: msg, lastAt: _now() });
  }
}

/**
 * Convenience: wrap an async fn so success/failure/timing are all
 * recorded automatically.
 *
 * @param {string} name
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
export async function instrumented(name, fn) {
  const t = trackTiming(name);
  try {
    const result = await fn();
    t.end();
    trackCount(name + '.success');
    return result;
  } catch (err) {
    t.end();
    trackCount(name + '.failure');
    trackError(name, err);
    throw err;
  }
}

/**
 * Read-only snapshot of every counter + timing + error.
 *
 * @returns {{
 *   counts:  Record<string, number>,
 *   timings: Record<string, { count: number, avgMs: number, p50Ms: number, p95Ms: number }>,
 *   errors:  Record<string, { count: number, lastError: string, lastAt: number }>,
 *   sinceMs: number,
 * }}
 */
export function getTelemetrySnapshot() {
  const counts = {};
  for (const [k, v] of _counts.entries()) counts[k] = v;

  const timings = {};
  for (const [k, buf] of _timings.entries()) {
    if (!buf || buf.length === 0) continue;
    const sorted = buf.slice().sort((a, b) => a - b);
    const sum = sorted.reduce((acc, x) => acc + x, 0);
    timings[k] = {
      count: sorted.length,
      avgMs: Math.round(sum / sorted.length),
      p50Ms: Math.round(_quantile(sorted, 0.5)),
      p95Ms: Math.round(_quantile(sorted, 0.95)),
    };
  }

  const errors = {};
  for (const [k, v] of _errors.entries()) errors[k] = { ...v };

  return {
    counts,
    timings,
    errors,
    sinceMs: _now() - _startTs,
  };
}

/**
 * Wipe everything (test helper / sign-out).
 */
export function _resetTelemetry() {
  _counts.clear();
  _timings.clear();
  _errors.clear();
}

export default {
  trackCount,
  trackTiming,
  trackError,
  instrumented,
  getTelemetrySnapshot,
  _resetTelemetry,
};
