/**
 * scanSessionManager.js — canonical scan-session state holder.
 *
 *   import {
 *     createScanSession, getActiveSession, updateSession,
 *     endSession, restorePersistedSession,
 *     SESSION_STATUS,
 *   } from 'src/core/scan/scanSessionManager.js';
 *
 *   const s = createScanSession({ source: 'live_camera' });
 *   updateSession(s.sessionId, { localUri: 'data:image/jpeg;base64,...' });
 *   const live = getActiveSession();
 *
 * Why this exists
 * ───────────────
 *   The V5 stability spec asks for ONE place that carries the full
 *   scan-session shape across the (capture → normalize → upload →
 *   ai → render) pipeline. Before this module the surface tracked
 *   the same shape across SEVEN react state slots and a global
 *   image store — that's where the "image preview disappears mid-
 *   scan but result still renders" class of bug lived.
 *
 *   This module composes (not replaces):
 *     • stableScanImageStore   — owns the raw File/Blob lifecycle
 *     • scanSessionId          — owns the active-id race guard
 *     • scanLifecycleStateMachine — owns the 11-state FSM
 *     • scanStateMachine        — owns the coarse 8-state flow
 *
 *   Persistence: lightweight localStorage write per `updateSession`
 *   so a tab refresh restores the last in-flight scan. The actual
 *   File / Blob is NOT persisted (browsers can't); only the
 *   dataURL backup + the metadata. That's enough to repaint the
 *   preview + retry the AI call without re-capturing.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (no-op when no
 *     `localStorage` / no `window`).
 *   • All persistence writes wrapped in try/catch — quota /
 *     private-mode errors degrade silently to memory-only.
 *   • Snapshot carries NO PII other than the dataURL itself.
 */

import { startScanSession, endScanSession, isStaleScanSession } from './scanSessionId.js';
import { LIFECYCLE_STATE } from './scanLifecycleStateMachine.js';

export const SESSION_STATUS = Object.freeze({
  IDLE:      'idle',
  ACTIVE:    'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED:    'failed',
});

const STORAGE_KEY = 'farroway:scanSession:v1';
const HISTORY_KEY = 'farroway:scanHistory:v1';
const HISTORY_MAX = 25;
// Anything above ~3 MB of dataURL choke localStorage on Safari.
// We cap persisted previews; the in-memory record still holds the
// full dataURL.
const PERSIST_DATA_URL_MAX = 2_500_000;

let _active = null;  // current SessionRecord (frozen)

function _now() { return Date.now(); }

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}
function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value == null) localStorage.removeItem(key);
    else               localStorage.setItem(key, String(value));
  } catch { /* quota / private mode — degrade to memory-only */ }
}

function _stripForPersist(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const trim = (s) => (typeof s === 'string' && s.length > PERSIST_DATA_URL_MAX) ? '' : s;
  return {
    sessionId:    rec.sessionId,
    createdAt:    rec.createdAt,
    updatedAt:    rec.updatedAt,
    source:       rec.source,
    status:       rec.status,
    lifecycle:    rec.lifecycle,
    localUri:     trim(rec.localUri),
    normalizedUri:trim(rec.normalizedUri),
    uploadedUrl:  rec.uploadedUrl,
    aiStatus:     rec.aiStatus,
    previewStatus:rec.previewStatus,
    renderStatus: rec.renderStatus,
    cropPrediction:    rec.cropPrediction,
    diseasePrediction: rec.diseasePrediction,
    confidence:   rec.confidence,
    retryCount:   rec.retryCount,
    inferenceLatencyMs: rec.inferenceLatencyMs,
    failedStage:  rec.failedStage,
    locale:       rec.locale,
    device:       rec.device,
    browser:      rec.browser,
  };
}

function _persist(rec) {
  try {
    if (!rec) { _safeSet(STORAGE_KEY, null); return; }
    const safe = _stripForPersist(rec);
    _safeSet(STORAGE_KEY, JSON.stringify(safe));
  } catch { /* swallow */ }
}

function _pushHistory(rec) {
  try {
    const raw = _safeGet(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const safe = _stripForPersist(rec);
    if (!safe) return;
    const next = [safe, ...(Array.isArray(arr) ? arr : [])].slice(0, HISTORY_MAX);
    _safeSet(HISTORY_KEY, JSON.stringify(next));
  } catch { /* swallow */ }
}

function _detectDevice() {
  try {
    if (typeof navigator === 'undefined') return { device: 'unknown', browser: 'unknown' };
    const ua = String(navigator.userAgent || '');
    let device = 'desktop';
    if (/iPhone|iPod/i.test(ua)) device = 'iphone';
    else if (/iPad/i.test(ua)) device = 'ipad';
    else if (/Android/i.test(ua)) device = 'android';
    let browser = 'unknown';
    if (/CriOS/i.test(ua)) browser = 'chrome_ios';
    else if (/FxiOS/i.test(ua)) browser = 'firefox_ios';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';
    else if (/Chrome/i.test(ua)) browser = 'chrome';
    else if (/Firefox/i.test(ua)) browser = 'firefox';
    const standalone = (typeof navigator !== 'undefined' && navigator.standalone === true)
      || (typeof window !== 'undefined' && window.matchMedia
          && window.matchMedia('(display-mode: standalone)').matches);
    return { device, browser, standalone: !!standalone };
  } catch { return { device: 'unknown', browser: 'unknown', standalone: false }; }
}

function _readLocale() {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const v = document.documentElement.getAttribute('lang');
      if (v) return v;
    }
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem('farroway:lang');
      if (v) return v;
    }
  } catch { /* swallow */ }
  return 'en';
}

/**
 * Create a fresh scan session. Bumps the race-guard session id so
 * any stale async write from a prior session no-ops. Returns the
 * frozen session record.
 */
export function createScanSession(opts) {
  try {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const sessionId = startScanSession();
    const env = _detectDevice();
    _active = Object.freeze({
      sessionId,
      createdAt:        _now(),
      updatedAt:        _now(),
      source:           o.source || 'unknown',  // 'live_camera' | 'gallery' | 'cached_frame' | …
      status:           SESSION_STATUS.ACTIVE,
      lifecycle:        LIFECYCLE_STATE.IDLE,
      localUri:         '',
      normalizedUri:    '',
      uploadedUrl:      '',
      aiStatus:         'pending',
      previewStatus:    'pending',
      renderStatus:     'pending',
      cropPrediction:   null,
      diseasePrediction:null,
      confidence:       null,
      retryCount:       0,
      inferenceLatencyMs: null,
      failedStage:      null,
      locale:           _readLocale(),
      device:           env.device,
      browser:          env.browser,
      standalone:       !!env.standalone,
    });
    _persist(_active);
    return _active;
  } catch { return null; }
}

/**
 * Patch the active session. Returns the new frozen record OR the
 * existing record unchanged if `sessionId` doesn't match the
 * active one (the race-guard signature — stale writes from older
 * sessions are NO-OP'd here, the surface never sees them).
 */
export function updateSession(sessionId, patch) {
  try {
    if (!_active || _active.sessionId !== sessionId) return _active;
    const p = (patch && typeof patch === 'object') ? patch : {};
    _active = Object.freeze({
      ..._active,
      ...p,
      sessionId: _active.sessionId,  // never patchable
      createdAt: _active.createdAt,  // never patchable
      updatedAt: _now(),
    });
    _persist(_active);
    return _active;
  } catch { return _active; }
}

/**
 * Mark the session terminal and push it to history. Does NOT end
 * the underlying race-guard id (that happens on user cancel /
 * navigation). Returns the final snapshot for the caller.
 */
export function completeSession(sessionId, finalPatch) {
  try {
    const out = updateSession(sessionId, {
      ...(finalPatch && typeof finalPatch === 'object' ? finalPatch : {}),
      status: SESSION_STATUS.COMPLETED,
    });
    if (out) _pushHistory(out);
    return out;
  } catch { return _active; }
}

export function failSession(sessionId, failedStage, reason) {
  try {
    return updateSession(sessionId, {
      status:       SESSION_STATUS.FAILED,
      failedStage:  failedStage || 'unknown',
      failReason:   typeof reason === 'string' ? reason : '',
    });
  } catch { return _active; }
}

/**
 * Tear down the active session. Bumps the race-guard id so any
 * in-flight async resolver sees `isStaleScanSession === true` and
 * no-ops. Drops the persisted record so a refresh does NOT
 * restore a cancelled scan.
 */
export function endSession() {
  try { endScanSession(); } catch { /* swallow */ }
  _active = null;
  _persist(null);
}

/** Read the active session (or null when idle). */
export function getActiveSession() {
  return _active;
}

/**
 * Race-guard helper. Use at every async resolver:
 *
 *   if (isSessionStale(localSessionId)) return;
 *
 * Returns true when the supplied id is null OR doesn't match the
 * active session OR the active session has been ended.
 */
export function isSessionStale(sessionId) {
  if (!sessionId) return true;
  if (!_active) return true;
  if (_active.sessionId !== sessionId) return true;
  try { return isStaleScanSession(sessionId); } catch { return false; }
}

/**
 * Bump the retry counter atomically. Returns the new counter.
 */
export function recordRetry(sessionId, stage) {
  try {
    if (!_active || _active.sessionId !== sessionId) return _active ? _active.retryCount : 0;
    const next = (Number(_active.retryCount) || 0) + 1;
    updateSession(sessionId, {
      retryCount:   next,
      failedStage:  stage || _active.failedStage,
    });
    return next;
  } catch { return 0; }
}

/**
 * Restore the persisted session on boot. Returns the rehydrated
 * record OR null when no persisted session exists / the record
 * was older than `maxAgeMs`. Does NOT replace the active record
 * if one already exists in memory (call sites should treat the
 * return value as advisory).
 */
export function restorePersistedSession(opts) {
  try {
    if (_active) return _active;
    const maxAgeMs = (opts && typeof opts === 'object' && Number(opts.maxAgeMs) > 0)
      ? Number(opts.maxAgeMs) : 24 * 60 * 60 * 1000;
    const raw = _safeGet(STORAGE_KEY);
    if (!raw) return null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    if (Number.isFinite(parsed.createdAt) && (_now() - parsed.createdAt) > maxAgeMs) {
      _safeSet(STORAGE_KEY, null);
      return null;
    }
    return Object.freeze({ ...parsed, _restored: true });
  } catch { return null; }
}

/** Read scan history (latest first). Up to HISTORY_MAX entries. */
export function getScanHistory() {
  try {
    const raw = _safeGet(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** Clear history. */
export function clearScanHistory() { _safeSet(HISTORY_KEY, null); }

/** Test-only reset. */
export function _resetSessionManagerForTests() {
  _active = null;
  _safeSet(STORAGE_KEY, null);
  _safeSet(HISTORY_KEY, null);
  try { endScanSession(); } catch { /* swallow */ }
}

const _module = {
  SESSION_STATUS,
  createScanSession, getActiveSession, updateSession,
  completeSession, failSession, endSession,
  isSessionStale, recordRetry,
  restorePersistedSession, getScanHistory, clearScanHistory,
  _resetSessionManagerForTests,
};
export default _module;
