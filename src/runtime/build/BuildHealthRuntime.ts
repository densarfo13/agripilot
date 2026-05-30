/**
 * src/runtime/build/BuildHealthRuntime.ts — wave-23 read-only
 * probe attesting the current build was produced by a clean
 * pipeline (no stale dist / no stale Vite cache).
 *
 *   window.__buildHealth()
 *
 * What this attests
 * ─────────────────
 *   • cleanBuildReady       — the build:safe pipeline ran the
 *                             pre-build clean step. Mirrored by the
 *                             window flag __farrowayCleanBuild set
 *                             at boot from a build-time injected
 *                             constant.
 *   • staleArtifactsDetected — false. SPA cannot see the local
 *                              filesystem; the static gate
 *                              check-clean-build.mjs enforces
 *                              the truth at build time.
 *   • viteCacheCleared      — mirrors cleanBuildReady.
 *
 * Strict-rule audit
 *   • Pure read-only probe. Never writes anything.
 *   • SSR-safe. Frozen envelope. Never throws.
 *   • Honest: defaults to false until the boot path attests
 *     the clean-build pipeline ran.
 */

export const BUILD_HEALTH_RUNTIME_VERSION = 'build-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface BuildHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  cleanBuildReady:          boolean;
  staleArtifactsDetected:   boolean;
  viteCacheCleared:         boolean;
  /** Build version surfaced by farrowayBuild module if present. */
  buildVersion?:            string;
}

const FROZEN_FALLBACK: Readonly<BuildHealth> = Object.freeze({
  runtimeVersion:           BUILD_HEALTH_RUNTIME_VERSION,
  initialized:              false,
  cleanBuildReady:          false,
  staleArtifactsDetected:   true,
  viteCacheCleared:         false,
});

function _attested(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    return (window as any).__farrowayCleanBuild === true;
  }, false);
}

function _readBuildVersion(): string | undefined {
  return _safe(() => {
    if (typeof window === 'undefined') return undefined;
    const w = window as any;
    if (typeof w.__farrowayBuild === 'function') {
      const b = w.__farrowayBuild();
      if (b && typeof b.version === 'string') return b.version;
    }
    return undefined;
  }, undefined);
}

export function buildHealth(): BuildHealth {
  return _safe(() => {
    const attested = _attested();
    return Object.freeze({
      runtimeVersion:         BUILD_HEALTH_RUNTIME_VERSION,
      initialized:            true,
      cleanBuildReady:        attested,
      // SPA can't see the FS — if the boot attestation is missing
      // we report unknown-via-false-default. Truth lives in the
      // static gate check-clean-build.mjs.
      staleArtifactsDetected: !attested,
      viteCacheCleared:       attested,
      buildVersion:           _readBuildVersion(),
    });
  }, FROZEN_FALLBACK);
}

/**
 * markCleanBuild — called by App.jsx boot path when the build was
 * produced by the wave-23 clean pipeline. Sets a sticky window
 * flag. Idempotent.
 */
export function markCleanBuild(): void {
  _safe(() => {
    if (typeof window === 'undefined') return;
    (window as any).__farrowayCleanBuild = true;
  }, undefined);
}

export function installBuildHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__buildHealth !== 'function') {
      w.__buildHealth = function () {
        const out = buildHealth();
        try { console.log('[Farroway · Build]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
