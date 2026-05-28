/**
 * farmMemoryRuntime.js — Wave 6 RUNTIME farm longitudinal memory.
 *
 *   import {
 *     getFarmMemoryView, getFarmMemoryTelemetry,
 *   } from 'src/runtime/intelligence/farmMemoryRuntime.js';
 *
 * What this is
 * ────────────
 *   The RUNTIME-layer entry to the farm-side memory store. Composes
 *   the existing `src/core/memory/farmMemoryEngine.js` (which
 *   records ignored/accepted recommendations + outcomes) without
 *   replacing it.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No write semantics on this layer — writes happen via
 *     interventionOutcomeRuntime (for outcomes) and through the
 *     existing engine for accept/ignore. This module is READ-ONLY
 *     so it can't accidentally introduce a duplicate writer.
 *   • RUNTIME → INTELLIGENCE (allowed by ALLOWED_IMPORTS).
 */

import {
  getFarmMemorySnapshot,
} from '../../core/memory/farmMemoryEngine.js';

const RUNTIME_VERSION = 'farm-memory-runtime-v1';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const _telemetry = { reads: 0 };

/**
 * Read the canonical farm-memory snapshot.
 */
export function getFarmMemoryView(ctx) {
  _telemetry.reads += 1;
  return _safe(() => {
    const snap = getFarmMemorySnapshot(ctx) || null;
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

export function getFarmMemoryTelemetry() {
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    reads: _telemetry.reads,
  });
}

export function _resetForTests() {
  _telemetry.reads = 0;
}
