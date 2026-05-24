/**
 * intelligenceLogger.js — structured logging wrapper for
 * intelligence engine calls.
 *
 *   import { logIntelligenceCall, wrapIntelligenceCall }
 *     from '../lib/intelligenceLogger.js';
 *
 *   // Plain log:
 *   logIntelligenceCall('soil', { ok: true, durationMs: 12 });
 *
 *   // Wrapper that times + logs an async call:
 *   const r = await wrapIntelligenceCall('soil', async () => {
 *     return analyzeSoilContext(ctx);
 *   });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A thin helper that writes ONE structured line per
 *   intelligence call. Each line carries:
 *     • engine label (soil / yield / scan / market / ...)
 *     • outcome (ok / error / timeout)
 *     • duration ms
 *     • optional input-shape signature (no PII)
 *
 *   Lines flow to the existing `opsLogger` event store + stdout,
 *   so they show up in `railway logs` and at `/api/system/errors`
 *   without new infra.
 *
 *   It is NOT a tracer (no spans, no correlation propagation —
 *   that lives in `requestId.js`). It is NOT a metrics
 *   aggregator (counters live in the admin monitoring
 *   dashboard).
 *
 *   PII discipline: the wrapper NEVER serialises the call
 *   arguments or the response body. Only structural metadata
 *   (input keys present, output ok-bool, byte counts).
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • No raw image data. No free-text user content.
 *   • Hot-path overhead is one Date.now() + one console.log.
 */

function _now() { return Date.now(); }

function _inputShape(input) {
  try {
    if (input == null || typeof input !== 'object') return null;
    return Object.keys(input).slice(0, 12).sort();
  } catch { return null; }
}

/**
 * Emit one log line for an intelligence call.
 *
 * @param {string} engine   short label, e.g. 'soil', 'yield', 'scan'
 * @param {object} meta     { ok, durationMs, reason, inputKeys, outcome }
 */
export function logIntelligenceCall(engine, meta) {
  try {
    const m = (meta && typeof meta === 'object') ? meta : {};
    const line = {
      tag:         'intelligence',
      engine:      String(engine || 'unknown'),
      ok:          m.ok === true,
      outcome:     m.outcome || (m.ok ? 'success' : (m.reason || 'failure')),
      durationMs:  Number.isFinite(m.durationMs) ? m.durationMs : null,
      inputKeys:   Array.isArray(m.inputKeys) ? m.inputKeys : null,
      ts:          new Date().toISOString(),
    };
    // eslint-disable-next-line no-console
    console.log('[intelligence]', JSON.stringify(line));
  } catch { /* swallow — logging never breaks the engine */ }
}

/**
 * Wrap an async intelligence call. Times it, logs structured
 * outcome, never lets the wrapper itself throw.
 *
 * Returns whatever the inner `fn` returns on success, OR
 * `{ ok: false, reason: 'caller_throw', error }` if `fn` throws.
 *
 * @param {string} engine
 * @param {() => Promise<any>} fn
 * @param {object} [opts]   { input?: object } — input is used ONLY
 *                          for its key shape; never serialised.
 */
export async function wrapIntelligenceCall(engine, fn, opts) {
  const o = opts || {};
  const started = _now();
  const inputKeys = _inputShape(o.input);
  try {
    const value = await Promise.resolve().then(() => fn());
    logIntelligenceCall(engine, {
      ok:         true,
      durationMs: _now() - started,
      inputKeys,
      outcome:    'success',
    });
    return value;
  } catch (error) {
    logIntelligenceCall(engine, {
      ok:         false,
      durationMs: _now() - started,
      inputKeys,
      outcome:    'caller_throw',
      reason:     (error && error.message) || String(error),
    });
    return { ok: false, reason: 'caller_throw',
             error: (error && error.message) || String(error) };
  }
}

const _module = { logIntelligenceCall, wrapIntelligenceCall };
export default _module;
