/**
 * providerTimeout.js — timeout + circuit-breaker wrapper for
 * external provider calls (scan AI, geocoding, weather, etc.).
 *
 *   import { callWithTimeout, createCircuitBreaker }
 *     from '../lib/providerTimeout.js';
 *
 *   // Single call with timeout:
 *   const r = await callWithTimeout(
 *     () => fetch('https://api.example.com/x'),
 *     { timeoutMs: 4000, label: 'weather' }
 *   );
 *   // r = { ok: true, value }   |   { ok: false, reason }
 *
 *   // Repeating call protected by a circuit breaker:
 *   const breaker = createCircuitBreaker({ label: 'weather' });
 *   const r = await breaker.call(() => weatherClient.fetch());
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny abstraction so every intelligence engine that reaches
 *   out to an external provider:
 *     • Stops waiting after a deadline (avoids the silent
 *       30 s hang we used to see when an upstream stalled).
 *     • Trips a circuit after N consecutive failures so we
 *       stop hammering a dead provider (and stop logging the
 *       same error 100 times/min).
 *     • Returns `{ ok, value, reason }` instead of throwing —
 *       the surface stays in control of the user-visible
 *       error path.
 *
 *   It is NOT a retry helper, NOT a full state machine, and NOT
 *   a metrics reporter. Retries belong inside the provider
 *   client (each provider has its own backoff profile);
 *   structured metrics belong in `intelligenceLogger.js`.
 *
 * Strict-rule audit
 *   • Pure JS — no Node-only globals beyond `Date.now` / timers.
 *   • Never throws from the public API; errors → { ok: false }.
 *   • SSR-safe (no global state without a fresh breaker call).
 */

/**
 * Default timeout deadline for intelligence-grade providers.
 * Scan / weather / pricing should respond well under this.
 */
const _DEFAULT_TIMEOUT_MS = 5000;

export const REASON = Object.freeze({
  TIMEOUT:         'timeout',
  CIRCUIT_OPEN:    'circuit_open',
  CALLER_THROW:    'caller_throw',
  INVALID_ARGS:    'invalid_args',
});

/**
 * Wrap an async function with a hard deadline. Resolves with
 * `{ ok, value }` or `{ ok: false, reason, error }`.
 *
 * @param {() => Promise<any>} fn
 * @param {{ timeoutMs?: number, label?: string }} [opts]
 * @returns {Promise<object>}
 */
export function callWithTimeout(fn, opts) {
  return new Promise((resolve) => {
    try {
      if (typeof fn !== 'function') {
        resolve({ ok: false, reason: REASON.INVALID_ARGS });
        return;
      }
      const o = opts || {};
      const timeoutMs = Number.isFinite(o.timeoutMs) && o.timeoutMs > 0
        ? o.timeoutMs
        : _DEFAULT_TIMEOUT_MS;

      let settled = false;
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, reason: REASON.TIMEOUT, label: o.label || null });
      }, timeoutMs);

      Promise.resolve()
        .then(() => fn())
        .then((value) => {
          if (settled) return;
          settled = true;
          clearTimeout(t);
          resolve({ ok: true, value });
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          clearTimeout(t);
          resolve({ ok: false, reason: REASON.CALLER_THROW,
                    error: (error && error.message) || String(error) });
        });
    } catch (error) {
      resolve({ ok: false, reason: REASON.CALLER_THROW,
                error: (error && error.message) || String(error) });
    }
  });
}

/**
 * Create a simple circuit breaker. State machine:
 *   CLOSED  → calls pass through; failures increment counter.
 *   OPEN    → calls short-circuit with reason 'circuit_open'.
 *             After `cooldownMs`, transitions to HALF_OPEN.
 *   HALF_OPEN → exactly one call is allowed through. Success
 *               closes the breaker; failure re-opens it.
 *
 * @param {{
 *   label?: string,
 *   threshold?: number,       // consecutive failures before opening (default 5)
 *   cooldownMs?: number,      // open-state cooldown (default 30s)
 *   timeoutMs?: number,       // per-call deadline (default 5s)
 * }} [opts]
 */
export function createCircuitBreaker(opts) {
  const o = opts || {};
  const label      = o.label      || 'provider';
  const threshold  = Number.isFinite(o.threshold)  && o.threshold  > 0 ? o.threshold  : 5;
  const cooldownMs = Number.isFinite(o.cooldownMs) && o.cooldownMs > 0 ? o.cooldownMs : 30000;
  const timeoutMs  = Number.isFinite(o.timeoutMs)  && o.timeoutMs  > 0 ? o.timeoutMs  : _DEFAULT_TIMEOUT_MS;

  // closed | open | half_open
  let state = 'closed';
  let consecutiveFailures = 0;
  let openedAt = 0;
  let halfOpenInFlight = false;

  function _now() { return Date.now(); }

  function _onSuccess() {
    consecutiveFailures = 0;
    state = 'closed';
    halfOpenInFlight = false;
  }

  function _onFailure() {
    consecutiveFailures += 1;
    halfOpenInFlight = false;
    if (consecutiveFailures >= threshold) {
      state = 'open';
      openedAt = _now();
    }
  }

  function _maybeRecoverFromOpen() {
    if (state !== 'open') return;
    if (_now() - openedAt >= cooldownMs) {
      state = 'half_open';
    }
  }

  return {
    label,
    /** Snapshot the current state — useful for the admin status route. */
    snapshot: () => ({
      label, state, consecutiveFailures,
      openedAt: openedAt || null,
      threshold, cooldownMs, timeoutMs,
    }),
    /** Reset the breaker to CLOSED. Operator-only. */
    reset: () => {
      state = 'closed';
      consecutiveFailures = 0;
      openedAt = 0;
      halfOpenInFlight = false;
    },
    /**
     * Run `fn` through the breaker.
     * @param {() => Promise<any>} fn
     * @returns {Promise<object>}  callWithTimeout-shaped result
     */
    call: async function (fn) {
      _maybeRecoverFromOpen();
      if (state === 'open') {
        return { ok: false, reason: REASON.CIRCUIT_OPEN, label };
      }
      if (state === 'half_open') {
        if (halfOpenInFlight) {
          return { ok: false, reason: REASON.CIRCUIT_OPEN, label };
        }
        halfOpenInFlight = true;
      }
      const r = await callWithTimeout(fn, { timeoutMs, label });
      if (r.ok) _onSuccess(); else _onFailure();
      return r;
    },
  };
}

const _module = { REASON, callWithTimeout, createCircuitBreaker };
export default _module;
