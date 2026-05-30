/**
 * src/runtime/persistence/PersistenceGuard.ts — pure guard
 * function that write paths call BEFORE attempting any production
 * write. Returns `{ok:false, safeUserMessage}` when persistence is
 * unavailable, never throws.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe.
 *   • Reads from cached probe (PersistenceHealth.persistenceHealth()).
 *   • Frozen envelope.
 *   • The safe-user-message is the canonical 503 copy and is
 *     enforced by the governance gate.
 */

import {
  PERSISTENCE_MODE, SAFE_503_MESSAGE,
  type PersistenceGuardResult,
} from './persistenceContracts';
import { persistenceHealth } from './PersistenceHealth';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * requireWritablePersistence — call BEFORE attempting any
 * production write to a critical model (User, FarmerProfile,
 * Organization, Program, ProgramEnrollment, EnrollmentBatch,
 * SellListing, BuyerInterest, AuditEvent, Artifact, ImpactRecord).
 *
 * Returns:
 *   { ok: true,  mode: 'postgres' } → safe to write
 *   { ok: false, mode, reason, safeUserMessage } → reject the write
 *
 * Rule: in production, only `mode === 'postgres'` AND
 * `productionWritesEnabled === true` are safe. Anything else
 * rejects. In development, in_memory is allowed (caller still
 * receives mode so it can log honest provenance).
 */
export function requireWritablePersistence(): PersistenceGuardResult {
  return _safe(() => {
    const h = persistenceHealth();
    // Production gate.
    if (h.isProduction) {
      if (h.mode === PERSISTENCE_MODE.POSTGRES
          && h.productionWritesEnabled) {
        return Object.freeze({
          ok:   true,
          mode: h.mode,
        });
      }
      return Object.freeze({
        ok: false,
        mode: h.mode,
        reason: h.mode === PERSISTENCE_MODE.UNAVAILABLE
                ? 'persistence_unavailable'
                : 'production_writes_disabled',
        safeUserMessage: SAFE_503_MESSAGE,
      });
    }
    // Development gate — in_memory acceptable, but reported.
    if (h.mode === PERSISTENCE_MODE.UNAVAILABLE) {
      return Object.freeze({
        ok: false,
        mode: h.mode,
        reason: 'persistence_unavailable',
        safeUserMessage: SAFE_503_MESSAGE,
      });
    }
    return Object.freeze({
      ok:   true,
      mode: h.mode,
    });
  }, Object.freeze({
    ok: false,
    mode: PERSISTENCE_MODE.UNAVAILABLE,
    reason: 'guard_error',
    safeUserMessage: SAFE_503_MESSAGE,
  }));
}

/**
 * Convenience: is the runtime currently safe for production writes?
 * Pure. Reads cached probe. Never throws.
 */
export function isWritablePersistenceReady(): boolean {
  return _safe(() => requireWritablePersistence().ok, false);
}
