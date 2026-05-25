/**
 * cameraFallbackEngine.js — picks the right capture method for the
 * current device/state and orchestrates the fall-through chain.
 *
 *   import { chooseCaptureMethod, CAPTURE_METHOD }
 *     from 'src/core/scan/cameraFallbackEngine.js';
 *
 *   const m = chooseCaptureMethod({
 *     userAgent: navigator.userAgent,
 *     online:    navigator.onLine,
 *     prior:     { cameraDenied: false, cameraTimedOut: false },
 *   });
 *   // m.method = 'getUserMedia' | 'inputCapture' | 'gallery' | 'offline_queue'
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure decision tree. Given a few flags it returns the
 *   recommended capture method + the fallback chain the UI should
 *   try in order. It does NOT actually call getUserMedia or open
 *   a file picker — those are the surface's job.
 *
 *   Decision rules (highest priority first):
 *     1. Offline → offline_queue (save image locally, sync later)
 *     2. iOS Safari → input_capture (DOM <input capture="environment">
 *        is more reliable than getUserMedia on iOS Safari, which
 *        suspends on background tabs and has slow permission
 *        resolution)
 *     3. Prior camera denial / timeout → gallery (don't loop on
 *        the failing path)
 *     4. Default → getUserMedia
 *
 *   The fallback chain attached to each pick lets the surface
 *   advance through `chain[i]` on each failure WITHOUT querying
 *   this module again.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

export const CAPTURE_METHOD = Object.freeze({
  GET_USER_MEDIA:  'getUserMedia',
  INPUT_CAPTURE:   'inputCapture',
  GALLERY:         'gallery',
  OFFLINE_QUEUE:   'offline_queue',
});

function _isIosSafari(userAgent) {
  if (typeof userAgent !== 'string') return false;
  const ua = userAgent.toLowerCase();
  // iOS Safari: iPhone/iPad UA + Version/ token + Safari, no
  // CriOS (Chrome) / FxiOS (Firefox).
  const iOS = /iphone|ipad|ipod/.test(ua);
  if (!iOS) return false;
  const safari = ua.includes('safari/') && !ua.includes('crios/') && !ua.includes('fxios/');
  return safari;
}

function _isCapacitor(userAgent) {
  return typeof userAgent === 'string' && userAgent.toLowerCase().includes('capacitor');
}

/**
 * @param {{
 *   userAgent?: string,
 *   online?:    boolean,
 *   prior?:     { cameraDenied?: boolean, cameraTimedOut?: boolean },
 * }} ctx
 * @returns {{ method: string, chain: string[], reason: string }}
 */
export function chooseCaptureMethod(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const ua = typeof c.userAgent === 'string' ? c.userAgent
      : (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const online = c.online != null ? !!c.online
      : (typeof navigator !== 'undefined' && navigator.onLine !== false);
    const prior = (c.prior && typeof c.prior === 'object') ? c.prior : {};

    // Offline trumps everything — never block the user.
    if (!online) {
      return {
        method: CAPTURE_METHOD.OFFLINE_QUEUE,
        chain: [CAPTURE_METHOD.OFFLINE_QUEUE, CAPTURE_METHOD.INPUT_CAPTURE],
        reason: 'offline',
      };
    }

    // Prior denial / timeout → skip the failing path.
    if (prior.cameraDenied || prior.cameraTimedOut) {
      return {
        method: CAPTURE_METHOD.GALLERY,
        chain: [CAPTURE_METHOD.GALLERY, CAPTURE_METHOD.INPUT_CAPTURE],
        reason: 'prior_failure',
      };
    }

    // iOS Safari → prefer <input capture>; getUserMedia is unreliable
    // (background-tab suspension, slow permission resolution, blank
    // returns on first-launch).
    if (_isIosSafari(ua)) {
      return {
        method: CAPTURE_METHOD.INPUT_CAPTURE,
        chain: [CAPTURE_METHOD.INPUT_CAPTURE, CAPTURE_METHOD.GALLERY],
        reason: 'ios_safari',
      };
    }

    // Capacitor wraps native — getUserMedia works reliably there.
    if (_isCapacitor(ua)) {
      return {
        method: CAPTURE_METHOD.GET_USER_MEDIA,
        chain: [CAPTURE_METHOD.GET_USER_MEDIA, CAPTURE_METHOD.INPUT_CAPTURE, CAPTURE_METHOD.GALLERY],
        reason: 'capacitor',
      };
    }

    // Default — try getUserMedia, fall through to input_capture
    // then gallery.
    return {
      method: CAPTURE_METHOD.GET_USER_MEDIA,
      chain: [CAPTURE_METHOD.GET_USER_MEDIA, CAPTURE_METHOD.INPUT_CAPTURE, CAPTURE_METHOD.GALLERY],
      reason: 'default',
    };
  } catch {
    return {
      method: CAPTURE_METHOD.GALLERY,
      chain: [CAPTURE_METHOD.GALLERY],
      reason: 'exception',
    };
  }
}

const _module = { CAPTURE_METHOD, chooseCaptureMethod };
export default _module;
