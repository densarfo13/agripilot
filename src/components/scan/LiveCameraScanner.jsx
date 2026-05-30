/**
 * LiveCameraScanner — full-screen native-camera-style overlay
 * that owns a real `getUserMedia` stream and hands the captured
 * frame back to its parent.
 *
 *   <LiveCameraScanner
 *     open={isOpen}
 *     facingHint="environment"
 *     onCancel={() => setOpen(false)}
 *     onCaptured={({ file, dataUrl }) => { ... }}
 *     onFallbackUpload={(file) => { ... }}
 *   />
 *
 * UX contract
 *   • `open=false` → component renders nothing AND the camera
 *     stream is fully released. Toggling `open` is the only
 *     stop-the-camera signal a parent needs to send.
 *   • Live `<video>` preview fills the viewport, anchored under
 *     a rounded viewport mask. Top controls: Close + Flash.
 *     Bottom row: Gallery, Capture, Switch.
 *   • After capture, the live stream is paused and the frozen
 *     dataURL is shown full-screen with Retake + Analyze.
 *   • Permission denied → an inline "Upload from gallery" panel
 *     keeps the flow alive without trapping the user.
 *
 * iPhone Safari behaviour notes
 *   • <video> needs `playsInline` to stay embedded (otherwise
 *     iOS hijacks into the system fullscreen player).
 *   • `getUserMedia` MUST be invoked from a user gesture on iOS,
 *     so we never auto-start the stream on mount when the user
 *     has not yet tapped "Open camera". The parent decides
 *     when to flip `open=true`.
 *   • The torch / flashlight constraint is Chromium-only; we
 *     hide the flash button on iOS Safari and on any track
 *     whose capabilities don't expose `torch`.
 *   • iOS Permissions API doesn't always reflect camera state —
 *     we treat the actual getUserMedia error as the source of
 *     truth and fall back to the upload panel on any failure.
 *
 * Strict-rule audit
 *   • One source of stream lifecycle (the open prop). All paths
 *     stop tracks + revoke ObjectURLs.
 *   • SSR-safe — every navigator/window access is guarded.
 *   • Pure presentational over the camera primitive — no router,
 *     no analytics, no localStorage. Parent owns side-effects.
 *   • No emoji. Lucide-style inline SVG icons throughout.
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { tSafe } from '../../i18n/tSafe.js';
// Production-rebuild Phase 2: mobile camera lifecycle. Layered on
// top of this component's existing visibilitychange handler — adds
// `pagehide`/`pageshow` (Safari bfcache), stream-freeze detection,
// and `track.readyState` watchdog. Without this layer the user
// report "preview freezes after app-switch" persisted because iOS
// killed the MediaStream silently during the hide window.
import {
  installMobileCameraLifecycle,
  uninstallMobileCameraLifecycle,
} from '../../core/scan/mobileCameraLifecycle.js';
// Canonical Camera Runtime Manager — owns the single active
// MediaStream. Replaces the in-component getUserMedia + retry
// + stopStream legacy path so every scan surface goes through
// the same lifecycle owner.
import {
  initializeCamera, stopCamera, getActiveStream, releaseBlobUrl,
} from '../../core/camera/cameraRuntimeManager.js';

const PREFERRED_CONSTRAINTS = (facing) => ({
  audio: false,
  video: {
    facingMode: { ideal: facing },
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
  },
});

const MIN_CONSTRAINTS = (facing) => ({
  audio: false,
  video: { facingMode: facing },
});

function _isIos() {
  try {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.platform || '')
      || (navigator.userAgent && /iPad|iPhone|iPod/.test(navigator.userAgent))
      || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
  } catch { return false; }
}

// Treat iOS Safari + iOS PWA + iPadOS Safari uniformly — they all
// share the same getUserMedia latency profile (3–8s cold start)
// and the same playsInline + user-gesture autoplay constraints.
function _isMobileSafari() {
  try {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (!_isIos()) return false;
    // Exclude Chrome / Firefox / Edge / Opera on iOS (they all
    // ship a WKWebView under the hood but the UA distinguishes
    // them). We want any iOS browser, so this is mostly true.
    return /Safari/.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  } catch { return false; }
}

// Camera startup deadline. On iOS Safari the user-gesture →
// permission prompt → stream-attach → first-frame chain can take
// 8–10s on a cold app launch; on Android Chrome it's typically
// under 2s. Pick the deadline per platform so the retry surface
// doesn't kick in before iOS has had a fair chance.
// Scan Emergency Root Fix — iPhone Safari cold-start is reliably
// 5–10 s, and a slow device + auto-focus + low light can push past
// the previous 12 s deadline. The fallback was firing on healthy
// streams that simply hadn't painted their first frame yet — the
// "Camera fallback still appears on iPhone Safari" report.
// Raise the iOS deadline to 20 s; gallery fallback remains one
// tap away the whole time. Non-iOS unchanged.
const CAMERA_READY_DEADLINE_MS_IOS     = 20000;
const CAMERA_READY_DEADLINE_MS_DEFAULT = 8000;  // Spec §2.7 — 8s default.

// ─── Canonical camera state machine ─────────────────────────────
// Scan Fullscreen Auto-Camera spec §4 — unified scan state
// machine names. The IDLE state is removed: /scan auto-opens
// the camera so there is no idle pause. Phases below are the
// internal `phase` state values; `data-phase` (used by E2E
// tests) reflects these strings verbatim.
//
//   requesting_camera — getUserMedia in flight (permission
//                       prompt may be visible). Also the
//                       initial state on mount — no idle pause.
//   camera_active     — stream attached, loadedmetadata +
//                       playing fired. Capture button enabled.
//   image_captured    — post-shutter preview shown; stream
//                       paused while user reviews.
//   permission_denied — user explicitly denied OR Permissions
//                       API returned 'permission_denied'. Upload-from-
//                       gallery fallback rendered.
//   error             — any non-permission failure (no gUM
//                       API, hardware unavailable, deadline
//                       exceeded). Upload + retry rendered.
//
// The page-level scan flow (ScanPage.jsx) layers ANALYZING /
// RESULT_READY on top of these — see spec §4 for the unified
// vocabulary. Camera-component phases stop at image_captured;
// once the parent accepts the captured frame, the page
// transitions to ANALYZING / RESULT_READY.
export const CAMERA_STATES = Object.freeze({
  REQUESTING_CAMERA: 'requesting_camera',
  CAMERA_ACTIVE:     'camera_active',
  IMAGE_CAPTURED:    'image_captured',
  PERMISSION_DENIED: 'permission_denied',
  ERROR:             'error',
});

// Permissions API pre-flight. Returns the W3C spec value:
//   'granted' — user has previously approved; we can proceed.
//   'denied'  — user has previously denied; skip the gUM call
//               and surface the upload fallback immediately.
//   'prompt'  — first-time visit; gUM will trigger the prompt.
//   null      — Permissions API unavailable (Safari historically,
//               Permissions for 'camera' name unsupported).
// NB: these are the raw W3C values — they are NOT our internal
// CAMERA_STATES phase names. The caller is responsible for
// mapping ('denied' → PERMISSION_DENIED phase).
async function _queryCameraPermission() {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions) return null;
    if (typeof navigator.permissions.query !== 'function') return null;
    const status = await navigator.permissions.query({ name: 'camera' });
    if (!status || typeof status.state !== 'string') return null;
    return status.state;
  } catch {
    // Safari throws on `{name:'camera'}` historically. Treat as
    // 'unknown' so the standard gUM flow proceeds normally.
    return null;
  }
}

// Dev-only structured log. Production builds tree-shake the body
// thanks to the import.meta.env.DEV guard (Vite replaces it with a
// literal `false` in build) — the entire branch drops out.
//
// Production Runtime Stabilization spec §2.9 — also emit the
// spec-named prefix ([SCAN_INIT] / [SCAN_PERMISSION] /
// [SCAN_STREAM_READY] / [SCAN_STREAM_FAILED] / [SCAN_CLEANUP])
// derived from the internal event name so audit greps for the
// canonical scan-log format succeed without renaming every
// call site.
const _SCAN_LOG_MAP = Object.freeze({
  // Lifecycle
  requesting_permission:  'SCAN_PERMISSION',
  preflight_denied:       'SCAN_PERMISSION',
  permission_denied:      'SCAN_PERMISSION',
  permission_error:       'SCAN_PERMISSION',
  // Stream
  stream_created:         'SCAN_INIT',
  metadata_loaded:        'SCAN_INIT',
  autoplay_blocked:       'SCAN_INIT',
  video_playing:          'SCAN_STREAM_READY',
  camera_ready:           'SCAN_STREAM_READY',
  // Failure
  ready_timeout:          'SCAN_STREAM_FAILED',
  not_supported:          'SCAN_STREAM_FAILED',
  no_video_element:       'SCAN_STREAM_FAILED',
  // Cleanup
  stream_stopped:         'SCAN_CLEANUP',
  stale_start_discarded:  'SCAN_CLEANUP',
});

function _cameraLog(event, extra) {
  try {
    if (typeof import.meta !== 'undefined'
        && import.meta && import.meta.env
        && import.meta.env.DEV === true
        && typeof console !== 'undefined'
        && typeof console.log === 'function') {
      const specPrefix = _SCAN_LOG_MAP[event];
      if (specPrefix) {
        console.log('[' + specPrefix + ']', event, extra || {});
      } else {
        console.log('[FARROWAY_CAMERA]', event, extra || {});
      }
    }
  } catch { /* swallow */ }
}

// ─── Icons (inline SVG, no emoji) ───────────────────────────────

function _CloseIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  );
}
function _FlashIcon({ size = 22, on = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L5 14h6l-2 8 10-14h-6l2-6z"
            stroke="currentColor" strokeWidth="1.7"
            strokeLinejoin="round"
            fill={on ? 'currentColor' : 'none'}/>
    </svg>
  );
}
function _SwitchIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h12l-2 -2M20 17H8l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
    </svg>
  );
}
function _GalleryIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none"/>
      <path d="M3 16l5-4 4 3 3-2 6 5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none"/>
      <circle cx="8" cy="9.5" r="1.3" fill="currentColor"/>
    </svg>
  );
}
function _RetakeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 16-5.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M19 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M21 12a9 9 0 0 1-16 5.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M5 20v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────

export default function LiveCameraScanner({
  open,
  facingHint = 'environment',
  onCancel,
  onCaptured,
  onFallbackUpload,
  testId = 'live-camera-scanner',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  // Sequence id — every startStream() call bumps this. Any
  // in-flight async work that resolves AFTER a newer call has
  // started sees a stale id and bails out instead of mutating
  // state / attaching to a torn-down video element. Prevents the
  // "duplicate streams" + "stream attached to unmounted element"
  // races the iOS hardening spec calls out.
  const startSeqRef = useRef(0);

  const [facing, setFacing] = useState(facingHint || 'environment');
  const [phase, setPhase] = useState('idle');
  // Rotating guidance text — cycles through 3 tips on a 3.2s loop
  // so the camera feels like it's coaching the user without
  // adding click affordance. Pauses when the camera isn't
  // streaming.
  const [guideTipIdx, setGuideTipIdx] = useState(0);
  // Capture flash flag — flips true for 220ms when the user taps
  // the shutter so the viewport feels like a real camera body
  // taking a photograph. CSS-only, no JS animation timer.
  const [captureFlash, setCaptureFlash] = useState(false);
  // Internal phase values. 'idle' is the closed-state (never
  // rendered — see `if (!open) return null` at the bottom).
  // The 5 visible phases match the spec's CAMERA_STATES:
  //   'requesting_camera' | 'camera_active' | 'image_captured'
  //   | 'permission_denied' | 'error'
  // — see CAMERA_STATES constants above.
  const [errorMsg, setErrorMsg] = useState('');
  const [capturedUrl, setCapturedUrl] = useState(null);
  // capturedFile value is no longer read (the review screen is
  // gone) — only the setter is kept so close()/abort can clear it.
  const [, setCapturedFile] = useState(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);

  const isIos = useMemo(_isIos, []);
  const isMobileSafari = useMemo(_isMobileSafari, []);
  const readyDeadlineMs = isIos
    ? CAMERA_READY_DEADLINE_MS_IOS
    : CAMERA_READY_DEADLINE_MS_DEFAULT;

  // ─── Stream lifecycle ──────────────────────────────────────
  //
  // Camera startup state machine (spec §3 + §7):
  //   idle → requesting (gUM) → streaming (loadedmetadata + playing)
  //   any step can fall through to denied / error.
  //
  // `streamRef` holds the SINGLE active stream. Every code path
  // that opens a new stream must first call stopStream() so we
  // never leak a track. The sequence id (startSeqRef) cancels
  // stale in-flight starts so two rapid toggles can't both
  // attach a stream to the same <video>.

  // Canonical Camera Runtime Manager delegation — single-stream
  // teardown owned by src/core/camera/cameraRuntimeManager.js.
  // Replaces the in-component track-stopping + srcObject-clearing
  // path so every Scan surface goes through the same lifecycle.
  const stopStream = useCallback(() => {
    stopCamera('scan_stop');
    streamRef.current = null;
    // Defensive — pause + reset the video element after the
    // manager has detached the srcObject. Covers any caller that
    // bypassed the manager but still owns the <video>.
    const v = videoRef.current;
    if (v) {
      try { v.srcObject = null; } catch { /* swallow */ }
      try { v.pause(); } catch { /* swallow */ }
    }
    setTorchOn(false);
    setHasTorch(false);
    _cameraLog('stream_stopped');
  }, []);

  // Wait for the video element to actually start playing.
  // Resolves once loadedmetadata + playing have both fired (or
  // a single canplay frame on browsers that don't emit the
  // playing event reliably). Rejects on deadline.
  const _awaitVideoPlaying = useCallback((v, deadlineMs) => new Promise((resolve, reject) => {
    if (!v) { reject(new Error('no_video_element')); return; }
    let done = false;
    let metadataSeen = false;
    let playingSeen = false;
    const cleanup = () => {
      try { v.removeEventListener('loadedmetadata', onMeta); } catch { /* swallow */ }
      try { v.removeEventListener('canplay',        onCanPlay); } catch { /* swallow */ }
      try { v.removeEventListener('playing',        onPlaying); } catch { /* swallow */ }
      try { v.removeEventListener('error',          onErr); } catch { /* swallow */ }
      try { clearTimeout(deadlineTimer); } catch { /* swallow */ }
    };
    const finish = (ok, why) => {
      if (done) return;
      done = true;
      cleanup();
      if (ok) resolve(); else reject(new Error(why || 'unknown'));
    };
    function maybeReady() {
      if (metadataSeen && (playingSeen || (v.readyState >= 3))) {
        _cameraLog('video_playing', {
          videoWidth: v.videoWidth || 0,
          videoHeight: v.videoHeight || 0,
          readyState: v.readyState,
        });
        finish(true);
      }
    }
    function onMeta() {
      metadataSeen = true;
      _cameraLog('metadata_loaded', {
        videoWidth: v.videoWidth || 0,
        videoHeight: v.videoHeight || 0,
      });
      maybeReady();
    }
    function onCanPlay() {
      // Some iOS builds never emit `playing` — canplay + a
      // non-zero videoWidth is good enough for us.
      if (v.videoWidth > 0) {
        metadataSeen = true;
        playingSeen  = true;
        maybeReady();
      }
    }
    function onPlaying() {
      playingSeen = true;
      maybeReady();
    }
    function onErr() { finish(false, 'video_error'); }
    try { v.addEventListener('loadedmetadata', onMeta); } catch { /* swallow */ }
    try { v.addEventListener('canplay',        onCanPlay); } catch { /* swallow */ }
    try { v.addEventListener('playing',        onPlaying); } catch { /* swallow */ }
    try { v.addEventListener('error',          onErr); } catch { /* swallow */ }
    // If metadata was already there when we attached (fast
    // hardware), trigger the checks once synchronously.
    if (v.readyState >= 1) onMeta();
    if (v.readyState >= 3) onCanPlay();
    const deadlineTimer = setTimeout(
      () => finish(false, 'video_deadline'),
      Math.max(1000, deadlineMs | 0),
    );
  }), []);

  const startStream = useCallback(async (nextFacing) => {
    const facingToUse = nextFacing || facing;
    // Bump sequence id — any in-flight start from a previous
    // call sees a stale id and bails before mutating state.
    const mySeq = ++startSeqRef.current;
    const isStale = () => startSeqRef.current !== mySeq;

    if (typeof navigator === 'undefined'
        || !navigator.mediaDevices
        || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      // No gUM API at all — surface FAILED (not denied) since
      // this is a capability gap, not a permission decision.
      setPhase('error');
      setErrorMsg(tSafe(
        'scan.camera.notSupported',
        'Camera is not available in this browser. Upload a photo instead.',
      ));
      _cameraLog('not_supported');
      return;
    }

    // Permanent Scanner Hardening §1 — Permissions API pre-flight.
    // When supported (Chrome/Edge/Firefox), this lets us short-
    // circuit to DENIED without flashing the "Opening camera…"
    // spinner if the user has already denied. Safari historically
    // throws on { name: 'camera' } — the helper returns null in
    // that case so we fall through to the standard gUM flow.
    const preflight = await _queryCameraPermission();
    if (isStale()) return;
    // Permissions API uses W3C spec values ('granted' / 'denied'
    // / 'prompt') — those are NOT our internal phase names. Map
    // the W3C 'denied' value to our PERMISSION_DENIED phase.
    if (preflight === 'denied') {
      setPhase('permission_denied');
      setErrorMsg(tSafe(
        'scan.camera.denied',
        'Camera is not available right now. Upload a photo instead.',
      ));
      _cameraLog('preflight_denied');
      return;
    }

    setPhase('requesting_camera');
    setErrorMsg('');
    // Always tear down the previous stream FIRST — guarantees
    // there is never more than one active stream / srcObject.
    stopStream();
    _cameraLog('requesting_permission', {
      facing: facingToUse, isIos, isMobileSafari, preflight,
    });

    // Canonical Camera Runtime Manager — single-stream open.
    // Replaces the two-tier in-component getUserMedia retry path.
    // The manager:
    //   • releases any prior stream before opening a new one
    //     (enforces "one active stream globally")
    //   • applies iOS Safari attrs (playsInline / muted / autoplay)
    //     when a video element is supplied
    //   • races an 8s timeout per the runtime contract
    //   • re-validates on visibilitychange and pagehide
    let stream = null;
    let openErrName = null;
    const _videoElForOpen = videoRef.current;
    {
      const r1 = await initializeCamera({
        videoEl:     _videoElForOpen,
        constraints: PREFERRED_CONSTRAINTS(facingToUse),
      });
      if (r1 && r1.ok) {
        stream = r1.stream;
      } else {
        // Second attempt with lenient constraints. Some Android
        // browsers reject the ideal-resolution hints; the bare
        // facingMode call usually succeeds.
        openErrName = (r1 && r1.reason) || 'init_failed';
        const r2 = await initializeCamera({
          videoEl:     _videoElForOpen,
          constraints: MIN_CONSTRAINTS(facingToUse),
        });
        if (r2 && r2.ok) {
          stream = r2.stream;
          openErrName = null;
        } else {
          if (isStale()) return;
          const reason = (r2 && r2.reason) || openErrName || 'init_failed';
          const denied = reason === 'init_timeout_or_denied'
            || /NotAllowed|denied|Security/i.test(String(reason));
          setPhase(denied ? 'permission_denied' : 'error');
          setErrorMsg(
            denied
              ? tSafe(
                  'scan.camera.denied',
                  'Camera is not available right now. Upload a photo instead.',
                )
              : tSafe(
                  'scan.camera.failed',
                  "Couldn't open the camera. Tap retry or upload a photo.",
                ),
          );
          _cameraLog(denied ? 'permission_denied' : 'permission_error', {
            r1: r1 && r1.reason,
            r2: r2 && r2.reason,
          });
          return;
        }
      }
    }
    if (isStale()) {
      // Newer start superseded us — runtime manager owns cleanup.
      stopCamera('stale_start_discarded');
      _cameraLog('stale_start_discarded');
      return;
    }
    _cameraLog('stream_created');

    streamRef.current = stream;
    const v = videoRef.current;
    if (!v) {
      // Video element unmounted between manager open and attach.
      // Delegate teardown to the runtime manager.
      stopCamera('no_video_element');
      streamRef.current = null;
      _cameraLog('no_video_element');
      return;
    }
    try {
      // initializeCamera already bound srcObject when videoEl was
      // supplied above; this reassignment is defensive only for
      // the case where the element changed identity between open
      // and attach (rare during fast re-mounts).
      if (v.srcObject !== stream) v.srcObject = stream;
      // iOS Safari + Android Chrome both need an explicit play()
      // call. The `muted` + `playsInline` attributes on the
      // <video> element let play() succeed without an active
      // user gesture in most flows; if the browser still
      // refuses (autoplay policy), we surface the error path.
      const p = v.play();
      if (p && typeof p.then === 'function') {
        try { await p; }
        catch (autoplayErr) {
          if (isStale()) return;
          // Autoplay was blocked. Log it but don't bail yet —
          // some iOS WKWebView builds throw here even though
          // playback actually starts a beat later. We let
          // _awaitVideoPlaying decide; if no frames arrive, it
          // rejects on the deadline and we go to error state.
          _cameraLog('autoplay_blocked', { name: autoplayErr && autoplayErr.name });
        }
      }
    } catch { /* swallow */ }

    // Wait for the video to actually be playing before flipping
    // to streaming. This is the critical fix for the
    // "Camera didn't start in time" false-positive: previously
    // we marked the camera ready before the first frame had
    // even decoded, so any iOS hiccup surfaced as a generic
    // failure surface.
    try {
      await _awaitVideoPlaying(v, readyDeadlineMs);
    } catch (waitErr) {
      if (isStale()) return;
      // Genuine startup failure — release the stream and show
      // the error surface with retry + gallery fallback.
      stopStream();
      setPhase('error');
      setErrorMsg(tSafe(
        'scan.camera.failed',
        "Couldn't open the camera. Tap retry or upload a photo.",
      ));
      _cameraLog('ready_timeout', { why: waitErr && waitErr.message });
      return;
    }

    if (isStale()) return;

    // Probe torch capability + camera count for the switch button.
    try {
      const track = stream.getVideoTracks()[0];
      const caps = (track && typeof track.getCapabilities === 'function')
        ? track.getCapabilities() : null;
      setHasTorch(!!(caps && caps.torch));
    } catch { setHasTorch(false); }
    try {
      const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (isStale()) return;
      const cams = devs.filter((d) => d.kind === 'videoinput');
      setCanSwitch(cams.length > 1);
    } catch { setCanSwitch(false); }
    setPhase('camera_active');
    _cameraLog('camera_ready');
  }, [facing, stopStream, isIos, isMobileSafari, readyDeadlineMs, _awaitVideoPlaying]);

  // Open / close gating.
  useEffect(() => {
    if (!open) {
      // Bump seq so any in-flight start aborts before it can
      // mutate state on a closed surface.
      startSeqRef.current += 1;
      stopStream();
      // Reset captured state so a re-open shows the live preview,
      // not the previously frozen frame.
      if (capturedUrl) {
        releaseBlobUrl(capturedUrl);
      }
      setCapturedUrl(null);
      setCapturedFile(null);
      setPhase('idle');
      setErrorMsg('');
      setTorchOn(false);
      return undefined;
    }
    // open=true: kick off the stream.
    startStream(facing);
    // Cleanup on every open→close transition AND on unmount.
    return () => {
      startSeqRef.current += 1;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Page Visibility — if the tab is hidden, release the camera so
  // the OS indicator doesn't stay lit. We re-acquire on return.
  useEffect(() => {
    if (!open) return undefined;
    function onVis() {
      try {
        if (document.visibilityState === 'hidden') {
          stopStream();
        } else if (phase !== 'image_captured') {
          startStream(facing);
        }
      } catch { /* swallow */ }
    }
    try { document.addEventListener('visibilitychange', onVis); } catch { /* swallow */ }
    return () => {
      try { document.removeEventListener('visibilitychange', onVis); } catch { /* swallow */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, facing]);

  // Mobile camera lifecycle layer (Production-Rebuild Phase 2).
  // Pairs with the visibilitychange handler above; catches the
  // failure modes that handler can't see:
  //   • Safari bfcache eviction (pageshow with persisted=true)
  //   • track.readyState 'ended' without an 'ended' event
  //   • Frozen stream (currentTime stuck across watchdog ticks)
  //   • Stale srcObject after foregrounding
  // The lifecycle is installed only while the camera surface is
  // open AND we're past 'image_captured' so the watchdog doesn't
  // false-positive on the still-frame review state.
  useEffect(() => {
    if (!open) return undefined;
    if (phase === 'image_captured') return undefined;
    const handle = installMobileCameraLifecycle({
      videoElRef:    () => videoRef.current,
      restartCamera: async () => {
        try {
          await startStream(facing);
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: (err && err.message) || 'restart_failed' };
        }
      },
      stopCamera:    () => { try { stopStream(); } catch { /* swallow */ } },
      onFreeze:      () => {
        // Stream froze mid-capture — most often a Safari background
        // killed the track. Reuse the same restart path the
        // visibility handler uses so we don't end up with two
        // overlapping getUserMedia calls.
        try {
          stopStream();
          startStream(facing);
        } catch { /* swallow */ }
      },
      onStaleStream: () => {
        try {
          stopStream();
          startStream(facing);
        } catch { /* swallow */ }
      },
    });
    return () => {
      try { handle.uninstall && handle.uninstall(); }
      catch { /* swallow */ }
      try { uninstallMobileCameraLifecycle(); }
      catch { /* swallow */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, facing]);

  // Body-scroll lock while the camera is open.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { try { document.body.style.overflow = prev; } catch { /* swallow */ } };
  }, [open]);

  // Rotating live guidance text — four tips cycle on a 3.0s
  // loop while the camera is streaming. Reset to the first tip
  // when the camera opens / re-streams so each capture session
  // starts with "Center crop or leaf".
  useEffect(() => {
    if (phase !== 'camera_active') { setGuideTipIdx(0); return undefined; }
    const id = setInterval(() => {
      setGuideTipIdx((i) => (i + 1) % 4);
    }, 3000);
    return () => { try { clearInterval(id); } catch { /* swallow */ } };
  }, [phase]);

  // ─── Actions ───────────────────────────────────────────────

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const nextOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: nextOn }] });
      setTorchOn(nextOn);
    } catch {
      // Torch unsupported on this hardware / browser. Hide the
      // button so the user doesn't tap it again.
      setHasTorch(false);
    }
  }, [torchOn]);

  const switchCamera = useCallback(async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startStream(next);
  }, [facing, startStream]);

  const captureFrame = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    // Flash the viewport for ~220ms so the capture feels like a
    // real camera shutter. The flag clears via setTimeout so the
    // overlay never sticks if the capture path bails out.
    setCaptureFlash(true);
    try {
      setTimeout(() => { try { setCaptureFlash(false); } catch { /* swallow */ } }, 220);
    } catch { /* swallow */ }
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0, w, h);
    } catch { return; }
    // Prefer a Blob → File so the existing pipeline (which expects
    // a File) keeps working. Fall back to dataURL if the Blob
    // path throws (older Safari sometimes does).
    let file = null;
    let dataUrl = '';
    try {
      const blob = await new Promise((res, rej) => {
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error('toBlob returned null'))),
          'image/jpeg',
          0.92,
        );
      });
      // Captured frame ObjectURL — created here, released via the
      // canonical cameraRuntimeManager.releaseBlobUrl when the
      // captured surface unmounts or a new frame replaces it.
      dataUrl = URL.createObjectURL(blob);
      file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } catch {
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        // Best-effort File from the dataURL.
        const bin = atob(dataUrl.split(',')[1] || '');
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/jpeg' });
        file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      } catch { /* swallow */ }
    }
    if (!file && !dataUrl) return;
    // Auto-analyze (Remove Manual Analyze Button Fix §1-§3, §7):
    // the shutter tap IS the intent to analyze. Fire onCaptured
    // immediately instead of parking on an "image_captured" review
    // screen behind an "Analyze photo" button. ScanCapture runs a
    // blur/dark preflight on the file and re-opens the camera when
    // the photo is unusable, so the manual review gate is both
    // redundant and banned by the spec. Freeing the stream first
    // also drops the OS camera indicator while analysis runs.
    stopStream();
    setCapturedFile(file);
    setCapturedUrl(dataUrl);
    try { onCaptured && onCaptured({ file, dataUrl }); }
    catch { /* never propagate */ }
  }, [stopStream, onCaptured]);

  // retake() + acceptCaptured() were removed with the post-shutter
  // review screen — capture auto-analyzes, so there is no review
  // state to retake from or to "accept".

  const close = useCallback(() => {
    // Bump seq so any in-flight start aborts before mutating
    // state on the closing surface.
    startSeqRef.current += 1;
    stopStream();
    if (capturedUrl) {
      releaseBlobUrl(capturedUrl);
    }
    setCapturedUrl(null);
    setCapturedFile(null);
    try { onCancel && onCancel(); } catch { /* swallow */ }
  }, [capturedUrl, onCancel, stopStream]);

  const pickFromGallery = useCallback(() => {
    try { fileInputRef.current?.click(); } catch { /* swallow */ }
  }, []);

  const onFileInputChange = useCallback((ev) => {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    stopStream();
    try { onFallbackUpload && onFallbackUpload(f); } catch { /* swallow */ }
  }, [onFallbackUpload, stopStream]);

  // ─── Render ────────────────────────────────────────────────

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const showFlash  = hasTorch && !isIos && phase === 'camera_active';
  const showSwitch = canSwitch && phase === 'camera_active';

  return createPortal(
    <div
      style={S.root}
      data-testid={testId}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={tSafe('scan.camera.title', 'Scanner camera')}
    >
      {/* ─── Top control bar ────────────────────────────────── */}
      <div style={S.topBar}>
        <button
          type="button"
          onClick={close}
          style={S.iconBtn}
          aria-label={tSafe('common.close', 'Close')}
          data-testid={`${testId}-close`}
        >
          <_CloseIcon />
        </button>
        {showFlash && (
          <button
            type="button"
            onClick={toggleTorch}
            style={{ ...S.iconBtn, ...(torchOn ? S.iconBtnOn : null) }}
            aria-label={tSafe('scan.camera.flash', 'Toggle flash')}
            aria-pressed={torchOn ? 'true' : 'false'}
            data-testid={`${testId}-flash`}
          >
            <_FlashIcon on={torchOn} />
          </button>
        )}
      </div>

      {/* ─── Camera viewport ────────────────────────────────── */}
      <div style={S.viewport} data-testid={`${testId}-viewport`}>
        {phase === 'camera_active' || phase === 'requesting_camera' ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={S.video}
            data-testid={`${testId}-video`}
          />
        ) : null}

        {/* Frame guide + animated scan line — only visible while
            live-streaming. The scan line sweeps top-to-bottom on
            a 2.4s loop, CSS-driven (no JS timer), and gives the
            viewfinder a "scanning" feel without claiming AI is
            doing anything before the user actually captures. */}
        {phase === 'camera_active' && (
          <>
            <div style={S.guideFrame} aria-hidden="true">
              {/* Soft ochre glow ring around the frame */}
              <span style={S.guideGlow} />
              {/* Animated sweep line */}
              <span style={S.scanLine} />
              <span style={{ ...S.guideCorner, top: -2,    left: -2,
                              borderTop:  '3px solid #E6BC85',
                              borderLeft: '3px solid #E6BC85' }}/>
              <span style={{ ...S.guideCorner, top: -2,    right: -2,
                              borderTop:   '3px solid #E6BC85',
                              borderRight: '3px solid #E6BC85' }}/>
              <span style={{ ...S.guideCorner, bottom: -2, left: -2,
                              borderBottom: '3px solid #E6BC85',
                              borderLeft:   '3px solid #E6BC85' }}/>
              <span style={{ ...S.guideCorner, bottom: -2, right: -2,
                              borderBottom: '3px solid #E6BC85',
                              borderRight:  '3px solid #E6BC85' }}/>
            </div>
            {/* Live coaching text — rotates through four tips on
                a 3.0s loop. The key on the <p> drives a CSS fade
                transition between tips (each tip mounts fresh so
                the entry animation re-fires). */}
            <p
              key={`tip-${guideTipIdx}`}
              style={S.guideHint}
              data-testid={`${testId}-tip-${guideTipIdx}`}
            >
              {guideTipIdx === 0 && tSafe('scan.camera.guideCenter',   'Center crop or leaf')}
              {guideTipIdx === 1 && tSafe('scan.camera.guideLighting', 'Good lighting helps analysis')}
              {guideTipIdx === 2 && tSafe('scan.camera.guideSteady',   'Hold steady')}
              {guideTipIdx === 3 && tSafe('scan.camera.guideReady',    'AI ready')}
            </p>
          </>
        )}

        {/* Shutter flash overlay — paints a brief white wash
            over the viewport when the capture button is tapped
            so the moment feels like a real camera shutter. */}
        {captureFlash && (
          <div style={S.captureFlash} aria-hidden="true" />
        )}


        {phase === 'requesting_camera' && (
          <div style={S.statusOverlay}>
            <span style={S.spinner} />
            <p style={S.statusText}>
              {tSafe('scan.camera.requesting', 'Opening camera…')}
            </p>
          </div>
        )}

        {(phase === 'permission_denied' || phase === 'error') && (
          <div style={S.statusOverlay}>
            <p style={S.statusTitle}>
              {phase === 'permission_denied'
                ? tSafe('scan.camera.deniedTitle', 'Camera blocked')
                : tSafe('scan.camera.errorTitle',  'Camera unavailable')}
            </p>
            <p style={S.statusText}>{errorMsg}</p>
            <button
              type="button"
              onClick={pickFromGallery}
              style={S.uploadBtn}
              data-testid={`${testId}-upload-fallback`}
            >
              <_GalleryIcon size={18} />
              <span style={{ marginLeft: 8 }}>
                {tSafe('scan.camera.useSaved', 'Upload photo')}
              </span>
            </button>
            {/* Try-again is offered in BOTH error AND denied states.
                In denied, the click re-invokes getUserMedia which
                re-triggers the browser permission prompt (the user
                may have dismissed it accidentally). One click = one
                attempt — there's no auto-retry loop. If the user
                explicitly denies again, the overlay stays put with
                the gallery fallback. */}
            <button
              type="button"
              onClick={() => startStream(facing)}
              style={S.retryBtn}
              data-testid={`${testId}-retry`}
            >
              <_RetakeIcon size={16} />
              <span style={{ marginLeft: 6 }}>
                {tSafe('common.tryAgain', 'Try again')}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Bottom control bar ────────────────────────────── */}
      {/* The post-shutter review screen (Retake / "Analyze photo")
          was removed in the Remove Manual Analyze Button Fix —
          capture auto-analyzes, so the bar only ever shows the
          live-camera controls. */}
      <div style={S.bottomBar}>
        {(
          <>
            <button
              type="button"
              onClick={pickFromGallery}
              style={S.bottomBtnGhost}
              aria-label={tSafe('scan.camera.upload', 'Upload from gallery')}
              data-testid={`${testId}-gallery`}
            >
              <_GalleryIcon size={24} />
              <span style={S.bottomBtnLabel}>
                {tSafe('scan.camera.gallery', 'Gallery')}
              </span>
            </button>

            <button
              type="button"
              onClick={captureFrame}
              disabled={phase !== 'camera_active'}
              style={{
                ...S.shutter,
                ...(phase !== 'camera_active' ? S.shutterDisabled : null),
              }}
              aria-label={tSafe('scan.camera.capture', 'Capture')}
              data-testid={`${testId}-capture`}
            >
              <span style={S.shutterInner} />
            </button>

            {showSwitch ? (
              <button
                type="button"
                onClick={switchCamera}
                style={S.bottomBtnGhost}
                aria-label={tSafe('scan.camera.switch', 'Switch camera')}
                data-testid={`${testId}-switch`}
              >
                <_SwitchIcon size={24} />
                <span style={S.bottomBtnLabel}>
                  {tSafe('scan.camera.flip', 'Flip')}
                </span>
              </button>
            ) : (
              <span style={S.bottomSpacer} aria-hidden="true" />
            )}
          </>
        )}
      </div>

      {/* Hidden file input — feeds onFallbackUpload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileInputChange}
        style={{ display: 'none' }}
        data-testid={`${testId}-file-input`}
      />
    </div>,
    document.body,
  );
}

const S = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    background: '#0A0F14',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    paddingTop:    'env(safe-area-inset-top, 0)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  topBar: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.65rem 0.8rem',
    zIndex: 2,
  },
  viewport: {
    position: 'relative',
    flex: 1,
    margin: '0 0.6rem',
    borderRadius: 22,
    overflow: 'hidden',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000',
  },
  guideFrame: {
    position: 'absolute',
    top: '12%',
    left: '8%',
    right: '8%',
    bottom: '24%',
    borderRadius: 16,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  guideGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: 22,
    boxShadow: '0 0 0 1px rgba(230,188,133,0.18), 0 0 28px rgba(230,188,133,0.10)',
    pointerEvents: 'none',
  },
  scanLine: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: 0,
    height: 2,
    borderRadius: 2,
    background: 'linear-gradient(90deg, rgba(230,188,133,0) 0%, rgba(230,188,133,0.95) 50%, rgba(230,188,133,0) 100%)',
    boxShadow: '0 0 12px rgba(230,188,133,0.55)',
    animation: 'farroway-scan-line-sweep 2.4s ease-in-out infinite',
    willChange: 'transform, opacity',
    pointerEvents: 'none',
  },
  guideCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
  },
  capturedBadge: {
    position: 'absolute',
    top: '5%',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.4rem 0.85rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#A8C283',
    background: 'rgba(143,171,115,0.18)',
    border: '1px solid rgba(143,171,115,0.45)',
    borderRadius: 999,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    pointerEvents: 'none',
    letterSpacing: '0.01em',
  },
  capturedDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#8FAB73',
    boxShadow: '0 0 8px rgba(143,171,115,0.7)',
  },
  guideHint: {
    position: 'absolute',
    bottom: '8%',
    left: '50%',
    transform: 'translateX(-50%)',
    margin: 0,
    padding: '0.45rem 0.9rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: 999,
    color: 'rgba(255,255,255,0.95)',
    pointerEvents: 'none',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    // Soft fade-up when the tip swaps — the `key` change on the
    // <p> remounts the element so this animation re-fires each
    // rotation. 240ms in / 240ms out matches the global fade.
    animation: 'farroway-fade-in 240ms ease-out both',
  },
  // Shutter flash — full-viewport white wash for ~220ms when
  // the user taps capture. Three-stop opacity ramp so it reads
  // as a punchy shutter rather than a slow fade.
  captureFlash: {
    position: 'absolute',
    inset: 0,
    background: '#FFFFFF',
    pointerEvents: 'none',
    zIndex: 3,
    animation: 'farroway-capture-flash 220ms ease-out forwards',
  },
  statusOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10,15,20,0.75)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem 1.5rem',
    textAlign: 'center',
  },
  statusTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  statusText: {
    margin: '0.5rem 0 1rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    maxWidth: '20rem',
    lineHeight: 1.4,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '2.5px solid rgba(255,255,255,0.18)',
    borderTopColor: '#C8944D',
    borderRadius: '50%',
    animation: 'farroway-spin 0.9s linear infinite',
    marginBottom: '0.6rem',
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.7rem 1.1rem',
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#0A0F14',
    background: '#FFFFFF',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: '0.55rem',
    padding: '0.5rem 0.95rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#FFFFFF',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  iconBtn: {
    width: 42,
    height: 42,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#FFFFFF',
    borderRadius: '50%',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    WebkitTapHighlightColor: 'transparent',
  },
  iconBtnOn: {
    background: 'rgba(245,201,125,0.85)',
    color: '#1F2933',
    border: '1px solid rgba(255,255,255,0.6)',
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.95rem 1.4rem 1.1rem',
    gap: '0.6rem',
    zIndex: 2,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: '50%',
    background: 'transparent',
    border: '4px solid #FFFFFF',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    flexShrink: 0,
  },
  shutterDisabled: {
    opacity: 0.5,
    cursor: 'default',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: '#FFFFFF',
    transition: 'transform 0.12s ease',
  },
  bottomBtnGhost: {
    width: 64,
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0.3rem 0',
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  bottomBtnPrimary: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0.6rem 1.3rem',
    background: '#FFFFFF',
    border: 'none',
    color: '#0A0F14',
    borderRadius: 999,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minWidth: 130,
  },
  bottomBtnLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '0.02em',
  },
  bottomBtnLabelPrimary: {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: '#0A0F14',
    letterSpacing: '0.005em',
  },
  bottomSpacer: {
    width: 64,
    display: 'inline-block',
  },
};
