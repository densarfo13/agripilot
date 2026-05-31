/**
 * src/runtime/appVersion/AppVersionRuntime.ts — build-version
 * diagnostic (read-only).
 *
 *   window.__appVersionHealth()
 *
 * What this is
 * ────────────
 * A composition-only probe over the build-identity the app ALREADY
 * stamps at build time. It does NOT introduce a second version /
 * reload mechanism — the forced stale-bundle kill switch lives in:
 *   • public/cache-bust.js     (synchronous SHA compare + reload-once)
 *   • index.html               (window.__FARROWAY_BUILD_SHA + meta tags)
 *   • src/lib/forceUiReset.js  (ensureUiVersion + killServiceWorkerAndCaches)
 *
 * This runtime just READS that state and exposes it for QA / ops so
 * "is the latest build live on this device?" is answerable from the
 * production console without DevTools spelunking.
 *
 * Build identity surfaced
 *   buildSha       — VITE_BUILD_SHA / window.__FARROWAY_BUILD_SHA
 *   buildTimestamp — VITE_BUILD_TIMESTAMP / <meta farroway-build-timestamp>
 *   uiVersion      — FARROWAY_UI_VERSION (drives ensureUiVersion reset)
 *   buildSequence  — FARROWAY_BUILD_SEQUENCE (monotonic direction guard)
 *   commitSha      — FARROWAY_COMMIT_SHA
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Reads localStorage / window / meta tags only; never writes,
 *     never reloads, never clears caches.
 */

export const APP_VERSION_RUNTIME_VERSION = 'app-version-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Read a <meta name="..."> content attribute. */
function _meta(name: string): string | null {
  return _safe(() => {
    if (typeof document === 'undefined' || !document.querySelector) return null;
    const el = document.querySelector(`meta[name="${name}"]`);
    const v = el && el.getAttribute('content');
    return v && v.indexOf('%') !== 0 ? v : null;   // skip un-substituted placeholders
  }, null);
}

/** Current build SHA pinned into index.html by the Vite plugin. */
export function readBuildSha(): string | null {
  return _safe(() => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (typeof w.__FARROWAY_BUILD_SHA === 'string'
          && w.__FARROWAY_BUILD_SHA.length > 0
          && w.__FARROWAY_BUILD_SHA.indexOf('%') !== 0) {
        return w.__FARROWAY_BUILD_SHA;
      }
    }
    const m = _meta('farroway-build-sha');
    if (m) return m;
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const v = (import.meta as any).env.VITE_BUILD_SHA
             || (import.meta as any).env.VITE_BUILD_ID;
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
  }, null);
}

export function readBuildTimestamp(): string | null {
  return _safe(() => {
    const m = _meta('farroway-build-timestamp');
    if (m) return m;
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const v = (import.meta as any).env.VITE_BUILD_TIMESTAMP;
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
  }, null);
}

export interface AppVersionHealth {
  runtimeVersion: string;
  initialized:    boolean;
  buildSha:       string | null;
  buildTimestamp: string | null;
  uiVersion:      string | null;
  buildSequence:  number | null;
  commitSha:      string | null;
}

export function appVersionHealth(): AppVersionHealth {
  return _safe(() => {
    let uiVersion: string | null = null;
    let buildSequence: number | null = null;
    let commitSha: string | null = null;
    // Read the bundled constants without a static import so a shape
    // change in forceUiReset never breaks this probe at module load.
    // The constants are also mirrored onto window in main.jsx.
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (typeof w.__FARROWAY_BUILD_VERSION === 'string') uiVersion = w.__FARROWAY_BUILD_VERSION;
      if (typeof w.__FARROWAY_COMMIT_SHA === 'string')    commitSha = w.__FARROWAY_COMMIT_SHA;
    }
    if (buildSequence == null) {
      // The build sequence is stamped into localStorage by
      // ensureUiVersion on the first matching boot.
      const raw = _safe(() => (typeof localStorage !== 'undefined'
        ? localStorage.getItem('farroway_build_sequence') : null), null);
      const n = raw != null ? Number(raw) : NaN;
      if (Number.isFinite(n)) buildSequence = n;
    }
    return Object.freeze({
      runtimeVersion: APP_VERSION_RUNTIME_VERSION,
      initialized:    true,
      buildSha:       readBuildSha(),
      buildTimestamp: readBuildTimestamp(),
      uiVersion,
      buildSequence,
      commitSha,
    });
  }, Object.freeze({
    runtimeVersion: APP_VERSION_RUNTIME_VERSION,
    initialized:    false,
    buildSha:       null,
    buildTimestamp: null,
    uiVersion:      null,
    buildSequence:  null,
    commitSha:      null,
  }));
}

export function installAppVersionHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__appVersionHealth !== 'function') {
      w.__appVersionHealth = function () {
        const out = appVersionHealth();
        try { console.log('[Farroway · App Version]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
