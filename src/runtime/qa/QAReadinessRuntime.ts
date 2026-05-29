/**
 * src/runtime/qa/QAReadinessRuntime.ts — Composite QA Readiness
 * verdict + manual check store.
 *
 *   import {
 *     loadManualChecks, setManualCheck, qaReadiness,
 *     installQAReadinessGlobal, QA_READINESS_RUNTIME_VERSION,
 *   } from 'src/runtime/qa/QAReadinessRuntime';
 *
 *   qaReadiness()
 *     → { iphoneSafari, androidChrome, pwa,
 *         scanFlowPassed, offlineFlowPassed, reconnectPassed,
 *         duplicatePreventionPassed, verdict,
 *         perDeviceSummary }
 *
 * Verdict rules
 *   READY   — all 27 checks passed
 *   FAILED  — any check failed
 *   PENDING — otherwise (some still pending and no failures)
 *
 * Strict-rule audit
 *   • Pure runtime — only writes localStorage from the admin-
 *     gated mutation helper (setManualCheck). Page enforces the
 *     internal flag before calling.
 *   • SSR-safe. Never throws.
 *   • No PII handled.
 *   • Engines return FROZEN envelopes.
 */

import {
  QA_RUNTIME_VERSION, QA_STORAGE_KEY,
  DEVICE_KINDS, CHECK_STATUSES, QA_VERDICTS,
  DeviceKind, CheckStatus, QAVerdict,
} from './qaContracts';
import {
  DEVICE_QA_CHECKLIST, DeviceQAChecklistItem,
} from './DeviceQAChecklist';

export const QA_READINESS_RUNTIME_VERSION = QA_RUNTIME_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Default — every checklist id maps to 'pending'. */
function _defaultMap(): Record<string, CheckStatus> {
  const out: Record<string, CheckStatus> = {};
  for (const item of DEVICE_QA_CHECKLIST) {
    out[item.id] = 'pending';
  }
  return out;
}

function _isStatus(v: unknown): v is CheckStatus {
  return v === 'pending' || v === 'passed' || v === 'failed';
}

/**
 * Read the manual QA check map from localStorage. Returns a
 * Record<id, status> covering every checklist id (defaults to
 * 'pending' when absent or malformed).
 */
export function loadManualChecks(): Record<string, CheckStatus> {
  return _safe(() => {
    const map = _defaultMap();
    if (typeof window === 'undefined') return map;
    const ls = window.localStorage;
    if (!ls) return map;
    const raw = ls.getItem(QA_STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (!_isObj(parsed)) return map;
    for (const item of DEVICE_QA_CHECKLIST) {
      const v = (parsed as any)[item.id];
      if (_isStatus(v)) map[item.id] = v;
    }
    return map;
  }, _defaultMap());
}

/**
 * Admin-only setter. The calling page enforces the internal
 * flag — this just persists. Returns true on success.
 */
export function setManualCheck(id: string, status: CheckStatus): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const ls = window.localStorage;
    if (!ls) return false;
    const checkId = _str(id);
    if (!checkId) return false;
    if (!_isStatus(status)) return false;
    // Reject ids not in the checklist — keeps the store narrow.
    const known = DEVICE_QA_CHECKLIST.some((it) => it.id === checkId);
    if (!known) return false;
    const next = loadManualChecks();
    next[checkId] = status;
    ls.setItem(QA_STORAGE_KEY, JSON.stringify(next));
    return true;
  }, false);
}

/* ── Verdict computation ────────────────────────────────────── */

interface DeviceSummary {
  readonly device:  DeviceKind;
  readonly total:   number;
  readonly passed:  number;
  readonly failed:  number;
  readonly pending: number;
  readonly verdict: QAVerdict;
}

function _deviceVerdict(passed: number, failed: number,
                          total: number): QAVerdict {
  if (failed > 0) return 'FAILED';
  if (passed === total) return 'READY';
  return 'PENDING';
}

function _summariseDevice(device: DeviceKind,
                            map: Record<string, CheckStatus>): DeviceSummary {
  const items = DEVICE_QA_CHECKLIST.filter((it) => it.device === device);
  let passed = 0, failed = 0, pending = 0;
  for (const it of items) {
    const s = map[it.id] || 'pending';
    if (s === 'passed') passed++;
    else if (s === 'failed') failed++;
    else pending++;
  }
  return Object.freeze({
    device,
    total: items.length,
    passed, failed, pending,
    verdict: _deviceVerdict(passed, failed, items.length),
  });
}

/**
 * Returns true when EVERY device passes the given category.
 */
function _categoryPassedAllDevices(category: string,
                                     map: Record<string, CheckStatus>): boolean {
  for (const device of DEVICE_KINDS) {
    const id = `qa.${device}.${category}`;
    if (map[id] !== 'passed') return false;
  }
  return true;
}

/**
 * Compute the live QA Readiness envelope.
 *
 *   iphoneSafari, androidChrome, pwa — per-device verdicts.
 *   scanFlowPassed                   — scan_nav + upload_photo
 *                                       + camera_photo passed
 *                                       on every device.
 *   offlineFlowPassed                — offline_add passed
 *                                       everywhere.
 *   reconnectPassed                  — reconnect_sync passed
 *                                       everywhere.
 *   duplicatePreventionPassed        — no_duplicate passed
 *                                       everywhere.
 *   verdict                          — READY | PENDING | FAILED.
 *   perDeviceSummary                 — frozen per-device rollup.
 */
export function qaReadiness() {
  return _safe(() => {
    const map = loadManualChecks();

    const iphoneSafari  = _summariseDevice('iphone_safari', map);
    const androidChrome = _summariseDevice('android_chrome', map);
    const pwa           = _summariseDevice('pwa', map);

    const scanCategories = ['scan_nav', 'upload_photo', 'camera_photo'];
    const scanFlowPassed = scanCategories.every(
      (c) => _categoryPassedAllDevices(c, map));
    const offlineFlowPassed         = _categoryPassedAllDevices('offline_add', map);
    const reconnectPassed           = _categoryPassedAllDevices('reconnect_sync', map);
    const duplicatePreventionPassed = _categoryPassedAllDevices('no_duplicate', map);

    let totalPassed = 0, totalFailed = 0, totalPending = 0;
    for (const it of DEVICE_QA_CHECKLIST) {
      const s = map[it.id] || 'pending';
      if (s === 'passed') totalPassed++;
      else if (s === 'failed') totalFailed++;
      else totalPending++;
    }

    let verdict: QAVerdict = 'PENDING';
    if (totalFailed > 0) verdict = 'FAILED';
    else if (totalPassed === DEVICE_QA_CHECKLIST.length) verdict = 'READY';

    const perDeviceSummary = Object.freeze({
      iphone_safari:  iphoneSafari,
      android_chrome: androidChrome,
      pwa,
    });

    return Object.freeze({
      runtimeVersion: QA_READINESS_RUNTIME_VERSION,
      iphoneSafari,
      androidChrome,
      pwa,
      scanFlowPassed,
      offlineFlowPassed,
      reconnectPassed,
      duplicatePreventionPassed,
      verdict,
      perDeviceSummary,
      totals: Object.freeze({
        total:   DEVICE_QA_CHECKLIST.length,
        passed:  totalPassed,
        failed:  totalFailed,
        pending: totalPending,
      }),
    });
  }, Object.freeze({
    runtimeVersion: QA_READINESS_RUNTIME_VERSION,
    iphoneSafari:  Object.freeze({
      device: 'iphone_safari' as DeviceKind,
      total: 0, passed: 0, failed: 0, pending: 0,
      verdict: 'PENDING' as QAVerdict,
    }),
    androidChrome: Object.freeze({
      device: 'android_chrome' as DeviceKind,
      total: 0, passed: 0, failed: 0, pending: 0,
      verdict: 'PENDING' as QAVerdict,
    }),
    pwa: Object.freeze({
      device: 'pwa' as DeviceKind,
      total: 0, passed: 0, failed: 0, pending: 0,
      verdict: 'PENDING' as QAVerdict,
    }),
    scanFlowPassed: false,
    offlineFlowPassed: false,
    reconnectPassed: false,
    duplicatePreventionPassed: false,
    verdict: 'PENDING' as QAVerdict,
    perDeviceSummary: Object.freeze({}),
    totals: Object.freeze({ total: 0, passed: 0, failed: 0, pending: 0 }),
  }));
}

/**
 * Pin window.__qaReadiness() onto the global so QA + admins can
 * call from the production console.
 */
export function installQAReadinessGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__qaReadiness !== 'function') {
      w.__qaReadiness = function () {
        const out = qaReadiness();
        try { console.log('[Farroway · QA Readiness]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
