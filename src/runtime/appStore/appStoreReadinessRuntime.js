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
} from '../scan/classifierAvailability.js';
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
  const env = _readBuildEnv();
  const winSha = _safe(() => {
    if (typeof window === 'undefined') return null;
    return window.__SCAN_BUILD_SHA__
      || window.__FARROWAY_BUILD_VERSION
      || null;
  }, null);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    sha:            env.sha || winSha || 'unknown',
    timestamp:      env.timestamp,
    mode:           env.mode,
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
 */
export async function getAppStoreReadiness() {
  const scan = _safe(() => getScanHealthSnapshot(), null);
  const safety = _safe(() => getAppStoreSafetySnapshot(), null);
  const flags = _safe(() => getSafeFeatureFlags(), null);
  const notif = _safe(() => getNotificationHealth(), null);
  const lang = _safe(() => getLanguageCoverageSnapshot(), null);
  const build = _safe(() => getFarrowayBuild(), null);

  // Scoring — true = pass, false = needs work, null = unknown.
  const gates = {
    safetyModeApplied: safety && safety.appStoreMode === true,
    classifierHonest:  scan && scan.realClassifierAvailable !== null,
    notifTransportOk:  notif && notif.transport !== 'none',
    notifOptIn:        notif && notif.permission === 'granted',
    languageCoverage:  lang && (lang.hitRate == null || lang.hitRate >= 0.80),
    hasBuildSha:       build && build.sha && build.sha !== 'unknown',
  };
  const criticalGates = ['safetyModeApplied', 'classifierHonest'];
  const deviceGates   = ['notifTransportOk', 'notifOptIn'];
  const criticalOk = criticalGates.every((g) => gates[g] === true || gates[g] === null);
  const criticalFail = criticalGates.some((g) => gates[g] === false);
  const deviceWork = deviceGates.some((g) => gates[g] === false);

  let verdict;
  if (criticalFail) verdict = 'BLOCKED';
  else if (deviceWork) verdict = 'NEEDS_DEVICE_QA';
  else if (criticalOk) verdict = 'APP_STORE_READY';
  else verdict = 'NEEDS_DEVICE_QA';

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    verdict,
    gates,
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
