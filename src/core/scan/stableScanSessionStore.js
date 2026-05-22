/**
 * stableScanSessionStore.js — the spec-named alias for the
 * single-source-of-truth scan image store.
 *
 *   import { storeScanSession, getCurrentScanSession,
 *            isValidForAnalysis, toAnalyzerInput,
 *            clearScanSession }
 *     from 'src/core/scan/stableScanSessionStore.js';
 *
 * What it is
 * ──────────
 *   Aliases the existing `stableScanImageStore` exports at the
 *   `stableScanSessionStore` path so the spec's named import
 *   works while keeping ONE store. No duplicate state — the
 *   underlying record (id, file, blob, objectUrl, dataUrlBackup,
 *   previewUrl, width, height, mimeType, size, createdAt) is the
 *   same as the existing store's shape.
 *
 * Hard lifecycle rule (encoded in stableScanImageStore):
 *   objectUrl is revoked ONLY when the user replaces the image
 *   OR leaves the Scan session — never during analysis or render.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws. SSR-safe.
 */

import {
  storeStableScanImage   as _store,
  getCurrentScanImage    as _get,
  replaceScanImage,
  clearScanImage         as _clear,
  setImageDimensions,
  isValidForAnalysis,
  toAnalyzerInput,
  _setUrlHooks,
  _resetUrlHooks,
} from './stableScanImageStore.js';

/**
 * Store the captured / uploaded image as the current scan session.
 * Adds a `previewUrl` field (alias for objectUrl) so callers using
 * the spec wording have a clear "this is the UI source" handle.
 */
export function storeScanSession(input) {
  const rec = _store(input);
  if (!rec) return null;
  // Re-emit with a previewUrl alias. The base record is frozen so
  // we layer the alias on a fresh wrapper — callers should treat
  // this as read-only.
  return Object.freeze({
    ...rec,
    previewUrl: rec.objectUrl || rec.dataUrlBackup || '',
  });
}

/** Read the current scan session (null if no image selected). */
export function getCurrentScanSession() {
  const rec = _get();
  if (!rec) return null;
  return Object.freeze({
    ...rec,
    previewUrl: rec.objectUrl || rec.dataUrlBackup || '',
  });
}

/** Clear and revoke. Call this when leaving the Scan screen. */
export function clearScanSession() {
  return _clear();
}

export {
  replaceScanImage,
  setImageDimensions,
  isValidForAnalysis,
  toAnalyzerInput,
  _setUrlHooks,
  _resetUrlHooks,
};

const _module = {
  storeScanSession,
  getCurrentScanSession,
  clearScanSession,
  replaceScanImage,
  setImageDimensions,
  isValidForAnalysis,
  toAnalyzerInput,
};
export default _module;
