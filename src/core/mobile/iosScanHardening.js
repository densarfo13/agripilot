/**
 * iosScanHardening.js — iOS-specific helpers for the scan flow.
 *
 *   import {
 *     isHeic, computeDownscaleTarget, isIosSafari,
 *     shouldRetryAfterBackgroundResume,
 *   } from 'src/core/mobile/iosScanHardening.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Pure helpers that encode the iOS-specific scan workarounds the
 *   spec asks for:
 *     • HEIC detection (iOS-default camera output)
 *     • Downscale-target calculation (memory-safe upload size)
 *     • iOS Safari detection (separate from the cameraFallbackEngine
 *       version — exported here so callers don't pull two modules)
 *     • Background-resume retry decision (was the tab suspended
 *       while the user was framing? if so, the capture context
 *       may have been reclaimed)
 *
 *   It is NOT a HEIC decoder (that lives in the image processing
 *   pipeline; this module just IDs the format). It is NOT a
 *   downscaler (it just calculates the target dimensions).
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _IOS_RE = /iphone|ipad|ipod/i;
const _SAFARI_RE = /safari\//i;
const _NOT_SAFARI = /crios\/|fxios\/|opios\//i;

/**
 * Detects iOS Safari (not Chrome / Firefox / Opera on iOS).
 */
export function isIosSafari(userAgent) {
  try {
    const ua = typeof userAgent === 'string' ? userAgent
      : (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (!_IOS_RE.test(ua)) return false;
    if (_NOT_SAFARI.test(ua)) return false;
    return _SAFARI_RE.test(ua);
  } catch { return false; }
}

/**
 * Detects HEIC/HEIF — iOS-default camera output that browsers
 * don't always decode. Surfaces should convert to JPEG before
 * upload + analysis.
 *
 * @param {{ name?: string, type?: string, mimeType?: string }} fileLike
 */
export function isHeic(fileLike) {
  try {
    if (!fileLike) return false;
    const mime = String(fileLike.type || fileLike.mimeType || '').toLowerCase();
    if (mime === 'image/heic' || mime === 'image/heif') return true;
    const name = String(fileLike.name || '').toLowerCase();
    if (name.endsWith('.heic') || name.endsWith('.heif')) return true;
    return false;
  } catch { return false; }
}

/**
 * Calculate downscale target so a max-side of `maxSide` is hit
 * while preserving aspect ratio. Returns the original dimensions
 * unchanged if they already fit.
 *
 * Memory-safe rule: iOS Safari's canvas allocation can fail at
 * very large sizes (e.g. 4032 × 3024 native HEIC). Targeting a
 * max side of 2048 px keeps the canvas under ~25 MB at 4 bytes/pixel
 * — well under the 256 MB iOS limit per tab.
 *
 * @param {{ width:number, height:number }} dims
 * @param {number} [maxSide=2048]
 * @returns {{ width:number, height:number, scaled:boolean }}
 */
export function computeDownscaleTarget(dims, maxSide) {
  try {
    const w = Number(dims && dims.width);
    const h = Number(dims && dims.height);
    const max = Number.isFinite(maxSide) && maxSide > 0 ? maxSide : 2048;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return { width: 0, height: 0, scaled: false };
    }
    const longest = Math.max(w, h);
    if (longest <= max) return { width: w, height: h, scaled: false };
    const ratio = max / longest;
    return {
      width:  Math.round(w * ratio),
      height: Math.round(h * ratio),
      scaled: true,
    };
  } catch {
    return { width: 0, height: 0, scaled: false };
  }
}

/**
 * Decide whether to retry the capture after the tab returned from
 * background. iOS Safari reclaims memory aggressively for
 * background tabs — the camera stream + any blob URLs created
 * before suspension may be invalid on resume.
 *
 * @param {{ wasSuspended:boolean, secondsSuspended?:number, hasCameraStream?:boolean }} ctx
 * @returns {{ retry:boolean, reason:string }}
 */
export function shouldRetryAfterBackgroundResume(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    if (!c.wasSuspended) return { retry: false, reason: 'not_suspended' };
    const seconds = Number(c.secondsSuspended) || 0;
    // < 5s suspensions usually don't lose state — skip retry.
    if (seconds < 5) return { retry: false, reason: 'short_suspension' };
    // If the camera stream was active, we MUST retry — iOS likely
    // reclaimed it.
    if (c.hasCameraStream) return { retry: true, reason: 'camera_likely_reclaimed' };
    // Any suspension > 30s — be safe and refresh capture context.
    if (seconds >= 30) return { retry: true, reason: 'long_suspension' };
    return { retry: false, reason: 'short_suspension_no_stream' };
  } catch {
    return { retry: true, reason: 'exception' };
  }
}

const _module = {
  isIosSafari,
  isHeic,
  computeDownscaleTarget,
  shouldRetryAfterBackgroundResume,
};
export default _module;
