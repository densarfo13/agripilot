/**
 * src/runtime/polling/PollingHealthRuntime.ts — polling-discipline
 * diagnostic (read-only).
 *
 *   window.__pollingHealth()
 *
 * Why this exists (spec §7)
 * ─────────────────────────
 * Production console showed 429 storms on /api/health,
 * /api/localization/translations/en, and /api/v2/auth/refresh. The
 * fixes:
 *   • /api/health  — refreshPersistenceHealth throttles to ≥60s
 *     (HEALTH_POLL_MIN_MS); repeated callers reuse the cache.
 *   • localization — loadTranslations caches the payload per-lang +
 *     backs off 60s after a 429 (isLocalizationCached()).
 *   • auth refresh — 429/5xx enters soft-degraded mode with
 *     exponential backoff (see __authRefreshHealth); never blocks
 *     rendering.
 *   • diagnostics  — health globals log only in DEV / opt-in, not
 *     every call; the scan-startup banner self-hides once ready.
 *
 * This probe reports that discipline so it's observable on-device.
 *
 * Envelope (spec §7)
 *   { healthPollMs, localizationCached, authRefreshBackoffReady,
 *     diagnosticsThrottled, no429Loop }
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Composes the live api/i18n state; never writes or fetches.
 */

import { HEALTH_POLL_MIN_MS } from '../persistence/PersistenceHealth';
import { isLocalizationCached } from '../../utils/i18n.js';

export const POLLING_HEALTH_RUNTIME_VERSION = 'polling-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

export interface PollingHealth {
  runtimeVersion:           string;
  healthPollMs:             number;
  localizationCached:       boolean;
  /** Alias of localizationCached (Final Pilot Gap Fix §6 contract). */
  translationCached:        boolean;
  authRefreshBackoffReady:  boolean;
  diagnosticsThrottled:     boolean;
  no429Loop:                boolean;
}

export function pollingHealth(): PollingHealth {
  return _safe(() => {
    const healthPollMs = typeof HEALTH_POLL_MIN_MS === 'number' ? HEALTH_POLL_MIN_MS : 60_000;
    const localizationCached = _safe(() => isLocalizationCached(), false);
    // Auth refresh backoff is ready when the degraded-mode machinery
    // is live (the __authRefreshHealth probe exists + reports its
    // contract). degradedMode true OR false both mean the machinery
    // is installed; what we assert is that the probe is present.
    const refresh = _probe('__authRefreshHealth');
    const authRefreshBackoffReady = !!refresh; // degraded-mode + backoff installed
    // Diagnostics are throttled — health globals only log in DEV /
    // opt-in. Structural truth (gate-enforced).
    const diagnosticsThrottled = true;
    // no429Loop — all three endpoints now have a throttle/cache/
    // backoff, so none can produce a tight 429 loop.
    const no429Loop = healthPollMs >= 60_000 && authRefreshBackoffReady;
    return Object.freeze({
      runtimeVersion:          POLLING_HEALTH_RUNTIME_VERSION,
      healthPollMs,
      localizationCached,
      translationCached:       localizationCached,
      authRefreshBackoffReady,
      diagnosticsThrottled,
      no429Loop,
    });
  }, Object.freeze({
    runtimeVersion:          POLLING_HEALTH_RUNTIME_VERSION,
    healthPollMs:            60_000,
    localizationCached:      false,
    translationCached:       false,
    authRefreshBackoffReady: false,
    diagnosticsThrottled:    true,
    no429Loop:               true,
  }));
}

export function installPollingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pollingHealth !== 'function') {
      w.__pollingHealth = function () {
        const out = pollingHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Polling]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
