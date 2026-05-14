/**
 * iosDetection — small platform-detection helper for the camera
 * recovery flow.
 *
 *   import { detectIosCamera } from '../lib/camera/iosDetection.js';
 *
 *   const ios = detectIosCamera();
 *   //   { isIos, isSafari, isStandalone, isPrivateLikely }
 *
 * Why this exists
 *   The iPhone Safari Camera Permission Recovery Fix needs to
 *   show iOS-specific instructions ("Settings → Safari → Camera
 *   → Allow") when permission has been blocked. Browser sniffing
 *   is fragile, so the helper exposes a SINGLE typed shape +
 *   leaves the decision to render iOS copy or generic copy to
 *   the caller.
 *
 * Strict-rule audit
 *   * Pure, never throws, SSR-safe (returns empty shape on
 *     server / missing navigator).
 *   * No DOM mutation. No storage.
 *   * Does NOT call out to the OS — sniffs the UA and a couple
 *     of well-known capability hints only.
 */

const EMPTY = Object.freeze({
  isIos:            false,
  isSafari:         false,
  isStandalone:     false,
  isPrivateLikely:  false,
  uaSummary:        'unknown',
});

function _str(v) { return typeof v === 'string' ? v : ''; }

function _isIos(ua, platform) {
  // Modern iPads identify as Macintosh with `maxTouchPoints > 1`.
  // The classic iPhone/iPad/iPod check still covers older devices.
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPad in desktop mode: platform reports "MacIntel" or
  // "Macintosh", UA includes "Macintosh", and maxTouchPoints > 1
  // (Apple's documented detection signal).
  const looksMac = /Mac(Intel|intosh|PPC)/i.test(platform)
                 || /Macintosh/i.test(ua);
  if (looksMac) {
    try {
      const t = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints);
      if (Number.isFinite(t) && t > 1) return true;
    } catch { /* swallow */ }
  }
  return false;
}

function _isSafari(ua) {
  // Safari, NOT Chrome/CriOS/EdgiOS/FxiOS on iOS, NOT Android.
  if (!/Safari/.test(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Android/i.test(ua)) return false;
  return true;
}

function _isStandalone() {
  try {
    if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
    if (typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch { /* swallow */ }
  return false;
}

/**
 * Best-effort private-mode probe. iOS Safari private browsing has
 * historically blocked writes to localStorage; modern versions
 * sometimes ALSO block sessionStorage. The probe is intentionally
 * fast — false negatives are fine (we just skip iOS-private copy).
 */
function _isPrivateLikely() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    const key = '__farroway_private_probe__';
    window.sessionStorage.setItem(key, '1');
    window.sessionStorage.removeItem(key);
    return false;
  } catch {
    return true;
  }
}

/**
 * Snapshot of iPhone-Safari-relevant capability flags. Pure read.
 *
 * @returns {{
 *   isIos: boolean,
 *   isSafari: boolean,
 *   isStandalone: boolean,
 *   isPrivateLikely: boolean,
 *   uaSummary: string,
 * }}
 */
export function detectIosCamera() {
  try {
    if (typeof navigator === 'undefined') return EMPTY;
    const ua       = _str(navigator.userAgent);
    const platform = _str(navigator.platform);
    const isIos    = _isIos(ua, platform);
    const isSafari = _isSafari(ua);
    return Object.freeze({
      isIos,
      isSafari,
      isStandalone:    _isStandalone(),
      isPrivateLikely: _isPrivateLikely(),
      uaSummary:       (isIos && isSafari) ? 'ios_safari'
                       : isIos              ? 'ios_other'
                       : isSafari           ? 'safari_desktop'
                       : 'other',
    });
  } catch {
    return EMPTY;
  }
}

const _module = {
  detectIosCamera,
};
export default _module;
