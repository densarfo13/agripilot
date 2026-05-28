/**
 * seasonalContinuityRuntime.js — Wave 6 RUNTIME seasonal memory.
 *
 *   import {
 *     recordSeasonalSignal, getSeasonalSnapshot,
 *     getSeasonalTelemetry,
 *   } from 'src/runtime/intelligence/seasonalContinuityRuntime.js';
 *
 * What this is
 * ────────────
 *   The RUNTIME-layer entry to multi-season memory. Composes the
 *   existing `src/core/intelligence/multiSeasonMemory.js` (which
 *   already records season-level events under SEASON_EVENT). The
 *   wave-6 layer adds:
 *     • a snapshot wrapper so __continuitySignals() can render the
 *       depth + cross-season pattern view
 *     • a thin write helper that fans into recordSeasonEvent
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No PII; the underlying engine controls its own redaction.
 */

import {
  SEASON_EVENT, recordSeasonEvent, getMultiSeasonSnapshot,
} from '../../core/intelligence/multiSeasonMemory.js';

const RUNTIME_VERSION = 'seasonal-continuity-runtime-v1';

const _state = { signalsRecorded: 0 };
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

/**
 * Record a seasonal signal — wraps the engine's SEASON_EVENT
 * vocabulary so the wave-6 chokepoint is the single write path.
 *
 *   @param {string} kind  — one of SEASON_EVENT values
 *   @param {object} meta  — opaque to runtime; passed to engine
 */
export function recordSeasonalSignal(kind, meta) {
  if (typeof kind !== 'string' || !kind) {
    return Object.freeze({ ok: false, reason: 'invalid_kind' });
  }
  const out = _safe(() => recordSeasonEvent(kind, meta || {}), null);
  if (!out) return Object.freeze({ ok: false, reason: 'engine_threw' });
  _state.signalsRecorded += 1;
  return Object.freeze({ ok: true, kind });
}

/**
 * Read-only snapshot. ctx is opaque — passed through to the engine.
 */
export function getSeasonalSnapshot(ctx) {
  return _safe(() => {
    const snap = getMultiSeasonSnapshot(ctx || {}) || null;
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      ok:             !!snap,
      snapshot:       snap,
    });
  }, Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    ok: false, snapshot: null, reason: 'snapshot_threw',
  }));
}

export function getSeasonalTelemetry() {
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    signalsRecorded: _state.signalsRecorded,
    knownEvents:     Object.values(SEASON_EVENT || {}).length,
  });
}

export function _resetForTests() {
  _state.signalsRecorded = 0;
}
