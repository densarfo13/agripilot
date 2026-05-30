/**
 * src/runtime/backup/BackupHealthRuntime.ts — wave-40 read-only
 * probe over Farroway's backup + restore posture.
 *
 *   window.__backupHealth()
 *
 * What this attests
 * ─────────────────
 *   • databaseBackupConfigured — operator-flipped env flag
 *     FARROWAY_DB_BACKUP_CONFIGURED. Default false; honest.
 *   • artifactBackupConfigured — operator-flipped env flag
 *     FARROWAY_ARTIFACT_BACKUP_CONFIGURED. Default false.
 *   • restoreProcedureDocumented — true iff the canonical
 *     docs/BACKUP_RUNBOOK.md ships in the build. Verified by
 *     the wave-40 governance gate at compile time; runtime
 *     mirrors that attestation via a build-time injected flag.
 *   • backupReady — all three of the above.
 *
 * Strict-rule audit
 *   • Pure read-only probe. Never writes.
 *   • SSR-safe. Frozen envelope. Never throws.
 *   • Honest: no fabricated greens. Env flags only flip when
 *     the operator explicitly sets them after backup
 *     configuration is verified end-to-end.
 */

export const BACKUP_HEALTH_RUNTIME_VERSION = 'backup-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _envFlag(name: string): boolean {
  return _safe(() => {
    // Vite exposes `import.meta.env` at build time. Vars must be
    // prefixed VITE_ to be embedded; we accept both prefixed and
    // unprefixed names so the operator can flip in Railway env
    // without rebuilding.
    let raw = '';
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        raw = String(import.meta.env[name] || import.meta.env[`VITE_${name}`] || '');
      }
    } catch { /* swallow */ }
    if (!raw && typeof process !== 'undefined' && process.env) {
      raw = String(process.env[name] || '');
    }
    if (!raw && typeof window !== 'undefined') {
      const w = window as any;
      if (w.__farrowayBackupFlags && typeof w.__farrowayBackupFlags === 'object') {
        raw = String(w.__farrowayBackupFlags[name] || '');
      }
    }
    const norm = raw.trim().toLowerCase();
    return norm === 'true' || norm === '1' || norm === 'yes' || norm === 'on';
  }, false);
}

function _hasRunbookFlag(): boolean {
  return _safe(() => {
    // The wave-40 build injects __farrowayBackupRunbookPresent on
    // boot when docs/BACKUP_RUNBOOK.md was bundled. The static
    // gate `check-backup-docs` (already in build:safe) is the
    // ground-truth enforcement; this runtime mirrors.
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return w.__farrowayBackupRunbookPresent === true;
  }, false);
}

export interface BackupHealth {
  runtimeVersion:               string;
  initialized:                  boolean;
  databaseBackupConfigured:     boolean;
  artifactBackupConfigured:     boolean;
  restoreProcedureDocumented:   boolean;
  backupReady:                  boolean;
}

const FROZEN_FALLBACK: Readonly<BackupHealth> = Object.freeze({
  runtimeVersion:               BACKUP_HEALTH_RUNTIME_VERSION,
  initialized:                  false,
  databaseBackupConfigured:     false,
  artifactBackupConfigured:     false,
  restoreProcedureDocumented:   false,
  backupReady:                  false,
});

export function backupHealth(): BackupHealth {
  return _safe(() => {
    const databaseBackupConfigured   = _envFlag('FARROWAY_DB_BACKUP_CONFIGURED');
    const artifactBackupConfigured   = _envFlag('FARROWAY_ARTIFACT_BACKUP_CONFIGURED');
    const restoreProcedureDocumented = _hasRunbookFlag();
    const backupReady =
         databaseBackupConfigured
      && artifactBackupConfigured
      && restoreProcedureDocumented;
    return Object.freeze({
      runtimeVersion:               BACKUP_HEALTH_RUNTIME_VERSION,
      initialized:                  true,
      databaseBackupConfigured,
      artifactBackupConfigured,
      restoreProcedureDocumented,
      backupReady,
    });
  }, FROZEN_FALLBACK);
}

/**
 * markBackupRunbookPresent — called by App.jsx boot path when
 * docs/BACKUP_RUNBOOK.md is bundled. Sets a sticky window flag
 * read by `_hasRunbookFlag()`. Idempotent.
 */
export function markBackupRunbookPresent(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    (window as any).__farrowayBackupRunbookPresent = true;
  }, undefined);
}

export function installBackupHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__backupHealth !== 'function') {
      w.__backupHealth = function () {
        const out = backupHealth();
        try { console.log('[Farroway · Backup]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
