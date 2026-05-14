/**
 * cameraErrorClassifier — pure translator from a getUserMedia
 * failure into the user-facing copy + action set the recovery UI
 * should render.
 *
 *   import { classifyCameraError } from '../lib/camera/cameraErrorClassifier.js';
 *
 *   const envelope = classifyCameraError(error, {
 *     attemptCount: 2,
 *     ios:          detectIosCamera(),
 *     isSecure:     window.isSecureContext,
 *   });
 *   //   { kind, tone, title, body, instructions, primaryCta,
 *   //     secondaryCta, autoFallback }
 *
 * Strict-rule audit
 *   * Pure function. Never throws. Frozen output.
 *   * No DOM / storage / network. SSR-safe.
 *   * No raw DOMException names leak into copy.
 *   * iOS-specific instructions only when the caller passes the
 *     detected platform shape.
 *   * autoFallback flips true after attemptCount >= 2 for any
 *     non-fatal failure — recoverable failures still let the
 *     user retry, but the UI is told to promote the gallery
 *     path so they're not stuck.
 */

export const CAMERA_FAILURE_KINDS = Object.freeze({
  PERMISSION_DENIED:           'permission_denied',
  PERMISSION_BLOCKED_PERSISTED: 'permission_blocked_persisted',
  NO_CAMERA:                   'no_camera',
  INSECURE_ORIGIN:             'insecure_origin',
  BROWSER_INTERRUPTED:         'browser_interrupted',
  STREAM_TIMEOUT:              'stream_timeout',
  HARDWARE_BUSY:               'hardware_busy',
  OVERCONSTRAINED:             'overconstrained',
  UNKNOWN:                     'unknown',
});

const _AUTO_FALLBACK_THRESHOLD = 2;

function _safeStr(v) { return typeof v === 'string' ? v : ''; }

function _domName(err) {
  if (!err) return '';
  return _safeStr(err.name) || _safeStr(err.code) || _safeStr(err.reason);
}

function _kindFromError(err, ctx) {
  const isSecure = ctx && typeof ctx.isSecure === 'boolean' ? ctx.isSecure : true;
  // Reason short-circuits — some callers (the existing
  // cameraSession service) pre-classify and pass a string instead
  // of a DOMException.
  const reason = _safeStr(err && err.reason);
  if (reason === 'unsupported')           return CAMERA_FAILURE_KINDS.NO_CAMERA;
  if (reason === 'ready_deadline')        return CAMERA_FAILURE_KINDS.STREAM_TIMEOUT;
  if (reason === 'no_video')              return CAMERA_FAILURE_KINDS.STREAM_TIMEOUT;
  if (reason === 'in_flight')             return CAMERA_FAILURE_KINDS.BROWSER_INTERRUPTED;
  if (reason === 'denied')                return CAMERA_FAILURE_KINDS.PERMISSION_DENIED;
  if (reason === 'not_found')             return CAMERA_FAILURE_KINDS.NO_CAMERA;
  if (reason === 'busy')                  return CAMERA_FAILURE_KINDS.HARDWARE_BUSY;
  if (reason === 'overconstrained')       return CAMERA_FAILURE_KINDS.OVERCONSTRAINED;

  const name = _domName(err);
  // SecurityError on an insecure origin → distinct from "denied"
  // because the only recovery is a different URL, not a settings
  // tweak.
  if (name === 'SecurityError' && !isSecure) return CAMERA_FAILURE_KINDS.INSECURE_ORIGIN;
  if (name === 'NotAllowedError' || name === 'SecurityError') return CAMERA_FAILURE_KINDS.PERMISSION_DENIED;
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return CAMERA_FAILURE_KINDS.NO_CAMERA;
  if (name === 'NotReadableError' || name === 'TrackStartError') return CAMERA_FAILURE_KINDS.HARDWARE_BUSY;
  if (name === 'AbortError') return CAMERA_FAILURE_KINDS.BROWSER_INTERRUPTED;
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return CAMERA_FAILURE_KINDS.OVERCONSTRAINED;
  return CAMERA_FAILURE_KINDS.UNKNOWN;
}

function _isIosSafari(ctx) {
  const ios = ctx && ctx.ios;
  return !!(ios && ios.isIos && ios.isSafari);
}

function _copyForKind(kind, ctx) {
  const iosSafari = _isIosSafari(ctx);
  const attemptCount = (ctx && Number.isFinite(ctx.attemptCount)) ? ctx.attemptCount : 0;
  const blocked = attemptCount >= _AUTO_FALLBACK_THRESHOLD;

  switch (kind) {
    case CAMERA_FAILURE_KINDS.PERMISSION_DENIED: {
      if (blocked) {
        return {
          tone:  'warning',
          title: iosSafari
            ? 'Camera access is turned off for Safari.'
            : 'Camera access is turned off.',
          body:  'You can still scan using a saved photo. To use the camera, allow access in your browser settings.',
          instructions: iosSafari
            ? ['Open the iPhone Settings app', 'Tap Safari', 'Tap Camera', 'Set to Allow', 'Reopen Farroway']
            : ['Open your browser settings', 'Find the Camera permission', 'Set this site to Allow', 'Reload Farroway'],
          primaryCta:   { kind: 'use_saved_photo', label: 'Use saved photo' },
          secondaryCta: iosSafari
            ? { kind: 'open_settings', label: 'Open Safari Settings' }
            : { kind: 'retry',         label: 'Retry camera' },
        };
      }
      return {
        tone:  'info',
        title: 'Camera permission needed',
        body:  'Allow camera access to scan, or use a saved photo instead.',
        instructions: [],
        primaryCta:   { kind: 'retry', label: 'Retry camera' },
        secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      };
    }
    case CAMERA_FAILURE_KINDS.PERMISSION_BLOCKED_PERSISTED: {
      return {
        tone:  'warning',
        title: iosSafari
          ? 'Camera access is turned off for Safari.'
          : 'Camera access is blocked.',
        body:  'You can still scan using a saved photo.',
        instructions: iosSafari
          ? ['Open the iPhone Settings app', 'Tap Safari', 'Tap Camera', 'Set to Allow']
          : ['Open your browser settings', 'Allow camera access for this site', 'Reload Farroway'],
        primaryCta:   { kind: 'use_saved_photo', label: 'Use saved photo' },
        secondaryCta: iosSafari
          ? { kind: 'open_settings', label: 'Open Safari Settings' }
          : null,
      };
    }
    case CAMERA_FAILURE_KINDS.NO_CAMERA: {
      return {
        tone:  'info',
        title: 'No camera available',
        body:  'Scanning works with saved photos too.',
        instructions: [],
        primaryCta:   { kind: 'use_saved_photo', label: 'Use saved photo' },
        secondaryCta: null,
      };
    }
    case CAMERA_FAILURE_KINDS.INSECURE_ORIGIN: {
      return {
        tone:  'warning',
        title: 'Secure connection required',
        body:  'Camera access needs https. Open Farroway via the secure URL, or scan with a saved photo.',
        instructions: [],
        primaryCta:   { kind: 'use_saved_photo', label: 'Use saved photo' },
        secondaryCta: null,
      };
    }
    case CAMERA_FAILURE_KINDS.BROWSER_INTERRUPTED: {
      return {
        tone:  'info',
        title: 'Camera was interrupted',
        body:  blocked
          ? 'Scanning works with saved photos too.'
          : 'Try again in a moment.',
        instructions: [],
        primaryCta:   { kind: 'retry', label: 'Retry camera' },
        secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      };
    }
    case CAMERA_FAILURE_KINDS.STREAM_TIMEOUT: {
      return {
        tone:  'info',
        title: 'Camera is taking too long',
        body:  blocked
          ? 'Scanning works with saved photos too.'
          : 'Try once more, or use a saved photo.',
        instructions: [],
        primaryCta:   { kind: 'retry', label: 'Retry camera' },
        secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      };
    }
    case CAMERA_FAILURE_KINDS.HARDWARE_BUSY: {
      return {
        tone:  'info',
        title: 'Camera is busy',
        body:  'Another app may be using the camera. Close it and try again, or use a saved photo.',
        instructions: [],
        primaryCta:   { kind: 'retry', label: 'Retry camera' },
        secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      };
    }
    case CAMERA_FAILURE_KINDS.OVERCONSTRAINED: {
      return {
        tone:  'info',
        title: 'Camera could not be configured',
        body:  'Try again, or use a saved photo.',
        instructions: [],
        primaryCta:   { kind: 'retry', label: 'Retry camera' },
        secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      };
    }
    case CAMERA_FAILURE_KINDS.UNKNOWN:
    default: {
      return {
        tone:  'info',
        title: 'Camera could not start',
        body:  blocked
          ? 'Scanning works with saved photos too.'
          : 'Try again, or use a saved photo.',
        instructions: [],
        primaryCta:   { kind: 'retry', label: 'Retry camera' },
        secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      };
    }
  }
}

/**
 * Build the camera-recovery envelope from a failure + context.
 * Pure. Never throws. Frozen output.
 *
 * @param {any} err    DOMException, Error, or a pre-classified
 *                     `{ reason }` object from cameraSession.
 * @param {object} [ctx]
 *   @param {number}  [ctx.attemptCount]  count of failed attempts in
 *                                        the current session (drives
 *                                        autoFallback).
 *   @param {object}  [ctx.ios]           detectIosCamera() snapshot.
 *   @param {boolean} [ctx.isSecure]      window.isSecureContext.
 * @returns {{ kind, tone, title, body, instructions, primaryCta,
 *             secondaryCta, autoFallback }}
 */
export function classifyCameraError(err, ctx) {
  try {
    const kind = _kindFromError(err, ctx);
    const copy = _copyForKind(kind, ctx);
    const attemptCount = (ctx && Number.isFinite(ctx.attemptCount)) ? ctx.attemptCount : 0;
    return Object.freeze({
      kind,
      ...copy,
      autoFallback: attemptCount >= _AUTO_FALLBACK_THRESHOLD,
    });
  } catch {
    return Object.freeze({
      kind:         CAMERA_FAILURE_KINDS.UNKNOWN,
      tone:         'info',
      title:        'Camera could not start',
      body:         'Try again, or use a saved photo.',
      instructions: [],
      primaryCta:   { kind: 'retry', label: 'Retry camera' },
      secondaryCta: { kind: 'use_saved_photo', label: 'Use saved photo' },
      autoFallback: false,
    });
  }
}

const _module = {
  CAMERA_FAILURE_KINDS,
  classifyCameraError,
};
export default _module;
