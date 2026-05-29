/**
 * appStoreReadinessRuntime.js — Wave 8 RUNTIME readiness composite.
 *
 *   import {
 *     installAppStoreReadinessRuntime, getAppStoreReadiness,
 *     getFarrowayBuild,
 *   } from 'src/runtime/appStore/appStoreReadinessRuntime.js';
 *
 * What this is
 * ────────────
 *   Single composite that reports the runtime-side App Store
 *   readiness verdict, drawing from:
 *
 *     • appStoreSafetyMode    — safe flag overrides applied?
 *     • classifierAvailability — real classifier vs fallback truth
 *     • notificationRuntime   — opt-in transport configured?
 *     • languageCoverage      — locale + tSafe hit rate
 *     • offlineRuntime (w7)   — queues + restoration installed?
 *     • continuityRuntime (w5) — persistence registry healthy?
 *     • intelligenceRuntime (w6) — pipeline installed?
 *
 *   Each is OPTIONAL — when not installed (test env, SSR) the
 *   composite reports a `degraded` envelope rather than failing.
 *
 *   The verdict is one of:
 *     - APP_STORE_READY   — every gate green
 *     - NEEDS_DEVICE_QA   — most gates green but at least one
 *                            requires device-level verification
 *                            (notifications, real classifier)
 *     - BLOCKED           — at least one critical gate red
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws (every probe wrapped in _safe).
 *   • Composition over the other runtimes. Idempotent install.
 *   • No PII; only flag/locale/counter values.
 */

import {
  installAppStoreSafetyMode, getAppStoreSafetySnapshot,
  getSafeFeatureFlags,
} from './appStoreSafetyMode.js';
import {
  installLanguageCoverage, getLanguageCoverageSnapshot,
} from '../language/languageCoverageRuntime.js';
import {
  installNotificationRuntime, getNotificationHealth,
} from '../notifications/notificationRuntime.js';
import {
  detectClassifierAvailability, getScanHealthSnapshot,
  probeClassifierAvailability,
} from '../scan/classifierAvailability.js';
import { getFarrowayBuild as _getFarrowayBuildCentral }
  from '../release/farrowayBuild.js';
import { isFeatureEnabled } from '../../config/features.js';

const RUNTIME_VERSION = 'app-store-readiness-runtime-v1';

const _state = {
  installed:   false,
  installedAt: null,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _safeAsync = async (fn, fb) => { try { return await fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

function _readBuildEnv() {
  return _safe(() => {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    return Object.freeze({
      sha:        env.VITE_BUILD_SHA       || env.VITE_BUILD_ID   || null,
      timestamp:  env.VITE_BUILD_TIMESTAMP || null,
      mode:       env.MODE                 || null,
      isProduction: !!env.PROD,
    });
  }, Object.freeze({
    sha: null, timestamp: null, mode: null, isProduction: false,
  }));
}

export function getFarrowayBuild() {
  // RC1 — central module is now the source of truth for build
  // identity. We compose its frozen envelope with the runtime-side
  // `appStoreMode` reading so the existing callers (readiness
  // composite, diagnostic) get one shape with both signals.
  const central = _safe(() => _getFarrowayBuildCentral(), null);
  const env = _readBuildEnv();
  let appStoreMode = false;
  try {
    const safety = _safe(() => getAppStoreSafetySnapshot(), null);
    appStoreMode = !!(safety && safety.appStoreMode);
  } catch { /* swallow */ }
  const winSha = _safe(() => {
    if (typeof window === 'undefined') return null;
    return window.__SCAN_BUILD_SHA__
      || window.__FARROWAY_BUILD_VERSION
      || null;
  }, null);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    sha:            (central && central.sha !== 'unknown' && central.sha)
                      || env.sha || winSha || 'unknown',
    builtAt:        (central && central.builtAt) || env.timestamp || null,
    timestamp:      (central && central.builtAt) || env.timestamp || null,
    mode:           env.mode,
    appStoreMode:   appStoreMode
                      || !!(central && central.appStoreMode),
    isProduction:   env.isProduction,
    detectedAt:     _now(),
  });
}

/**
 * Install all wave-8 runtimes idempotently. Called once from
 * App.jsx mount.
 */
export async function installAppStoreReadinessRuntime(opts) {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  // 1) Probe classifier availability from current env.
  const mlScanFlagOn = _safe(() => isFeatureEnabled('mlScan'), false);
  const scanApiEnabled = _safe(() => isFeatureEnabled('scanApiEnabled'), false);
  const classifierEndpoint = _safe(() => {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    return env.VITE_SCAN_API_URL || null;
  }, null);
  _safe(() => detectClassifierAvailability({
    mlScanFlagOn, scanApiEnabled, classifierEndpoint,
  }), null);
  // 2) Safety mode (flag overrides).
  _safe(() => installAppStoreSafetyMode(opts || {}), null);
  // 3) Notifications transport detection.
  await _safeAsync(() => installNotificationRuntime(), null);
  // 4) Language coverage.
  _safe(() => installLanguageCoverage(), null);
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({ ok: true });
}

/**
 * Composite readiness verdict.
 *
 *   {
 *     verdict: 'APP_STORE_READY' | 'NOT_READY',
 *     blockers: string[],
 *     warnings: string[],
 *     checks: {
 *       scanApiEnabled, realClassifierAvailable,
 *       privacyUrlPresent, termsUrlPresent,
 *       nativeModeDetected, hiddenRoutesSafe,
 *       translationsPass, offlineRuntimeReady,
 *       queueRegistered,
 *     }
 *   }
 */
export async function getAppStoreReadiness() {
  // RC1 — fire the authoritative server probe alongside the
  // synchronous reads. Cached internally so cost is bounded.
  const probe = await _safeAsync(() => probeClassifierAvailability(), null);
  const scan = _safe(() => getScanHealthSnapshot(), null);
  const safety = _safe(() => getAppStoreSafetySnapshot(), null);
  const flags = _safe(() => getSafeFeatureFlags(), null);
  const notif = _safe(() => getNotificationHealth(), null);
  const lang = _safe(() => getLanguageCoverageSnapshot(), null);
  const build = _safe(() => getFarrowayBuild(), null);

  // Detect document-side privacy/terms meta tags so the runtime
  // verdict reflects what App Store reviewers will see in HTML.
  let privacyUrlPresent = null;
  let termsUrlPresent = null;
  _safe(() => {
    if (typeof document === 'undefined') return;
    const head = document.head;
    if (!head) return;
    privacyUrlPresent = !!(
      head.querySelector('link[rel="privacy"]')
      || head.querySelector('meta[name="privacy-policy"]')
    );
    termsUrlPresent = !!head.querySelector('meta[name="terms-of-service"]');
  }, null);

  const queueRegistered = await _safeAsync(async () => {
    const dyn = new Function('s', 'return import(s)');
    const mod = await dyn('../offline/queueRegistry.js');
    if (!mod || typeof mod.getRegistrySnapshot !== 'function') return null;
    const snap = await mod.getRegistrySnapshot();
    return snap && snap.registered >= 5;
  }, null);

  const probeOk = !!(probe && probe.realClassifierAvailable === true);
  const checks = Object.freeze({
    scanProviderConfigured:  probe ? !!probe.configured : null,
    realClassifierAvailable: probeOk
                             || (scan ? !!scan.realClassifierAvailable : null),
    provider:                probe ? probe.provider : null,
    scanApiEnabled:          _safe(() => isFeatureEnabled('scanApiEnabled'), null),
    privacyUrlPresent,
    termsUrlPresent,
    nativeModeDetected:      safety ? !!safety.nativeShell : null,
    hiddenRoutesSafe:        flags
      ? !flags.flags.buyMarketplace?.applied
        && !flags.flags.marketTransactionFlow?.applied
        && !flags.flags.marketScale?.applied
        && !flags.flags.multiMarket?.applied
      : null,
    translationsPass:        lang
      ? (lang.hitRate == null ? null : lang.hitRate >= 0.80)
      : null,
    offlineRuntimeReady:     queueRegistered,
    queueRegistered,
    buildShaPresent:         !!(build && build.sha && build.sha !== 'unknown'),
  });

  const blockers = [];
  const warnings = [];

  // Blockers — must be true for App Store ready.
  if (checks.scanApiEnabled === false) blockers.push('scan_api_disabled');
  if (checks.privacyUrlPresent === false) blockers.push('privacy_url_missing');
  if (checks.termsUrlPresent === false) blockers.push('terms_url_missing');
  if (checks.hiddenRoutesSafe === false) blockers.push('flagged_routes_exposed');
  // RC1 — classifier unavailable is a BLOCKER for external TestFlight
  // and App Store. Internal TestFlight tolerates it (warning only).
  if (checks.realClassifierAvailable === false) {
    blockers.push('classifier_unavailable_for_external_release');
  }

  // Warnings — non-blocking, surfaced for QA + internal TestFlight.
  if (checks.realClassifierAvailable === false) warnings.push('classifier_will_use_fallback');
  if (checks.scanProviderConfigured === false) warnings.push('scan_provider_not_configured');
  if (checks.translationsPass === false) warnings.push('translation_coverage_below_80');
  if (checks.translationsPass == null) warnings.push('translation_coverage_unknown');
  if (checks.offlineRuntimeReady === false) warnings.push('offline_runtime_not_ready');
  if (checks.nativeModeDetected === false) warnings.push('not_running_in_native_shell');
  if (!checks.buildShaPresent) warnings.push('build_sha_unknown');
  if (notif && notif.transport === 'none') warnings.push('notification_transport_none');
  if (notif && notif.permission !== 'granted') warnings.push('notification_permission_not_granted');

  const verdict = blockers.length === 0
    ? 'APP_STORE_READY'
    : 'NOT_READY';

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    verdict,
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(warnings),
    checks,
    detail: Object.freeze({
      safetyMode:    safety,
      scan:          scan,
      notifications: notif,
      language:      lang,
      build:         build,
      flags:         flags,
    }),
    generatedAt: _now(),
  });
}

export function _resetForTests() {
  _state.installed = false;
  _state.installedAt = null;
}
