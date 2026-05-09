/**
 * cameraLifecycle — production-hardened camera startup state machine.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The previous /scan flow occasionally:
 *   • Timed out at 4 s on slow Android camera initialisation.
 *   • Showed a black preview because the <video> mounted before
 *     the MediaStream finished negotiating its first frame.
 *   • Attached the stream BEFORE the track was actually `live`.
 *   • Failed silently on Safari (where srcObject is async).
 *   • Had no graceful fallback when the rear camera was missing
 *     or the user-agent rejected the OverConstrained `environment`
 *     hint (kiosk laptops, single-camera devices).
 *
 * This module replaces ad-hoc `getUserMedia` calls with a single
 * `startCamera()` helper that:
 *   1. Verifies MediaDevices is available (graceful 'unsupported').
 *   2. Calls getUserMedia with the recommended mobile constraints.
 *   3. Retries once with `{ video: true }` if the first call rejects
 *      with OverconstrainedError or NotFoundError (single-camera
 *      laptops / older browsers).
 *   4. Verifies the returned track is `live` (not `ended`).
 *   5. Attaches the stream to the supplied <video> element.
 *   6. Awaits `loadedmetadata` AND `video.readyState >= 2`.
 *   7. Verifies `videoWidth > 0 && videoHeight > 0` after metadata.
 *      One auto-retry on zero dimensions before failing.
 *   8. Calls `video.play()` and tolerates the autoplay-policy reject.
 *   9. Resolves only when the preview is ready to be rendered.
 *
 * A configurable hard timeout (default 10 s) ensures the caller can
 * surface the calm upload-fallback rather than leaving the user
 * staring at a "Preparing camera…" shimmer.
 *
 * STRICT-RULE AUDIT
 *   • Pure JS — no React, no DOM imports.
 *   • Never throws on caller's hot path; rejects with typed reasons:
 *       'unsupported' | 'denied' | 'not_found' | 'busy' |
 *       'overconstrained' | 'timeout' | 'no_track' |
 *       'attach_failed' | 'no_dimensions' | 'unknown'
 *   • SSR-safe — every navigator/document access is guarded.
 *   • `stopStream()` is idempotent and tolerates per-track failures.
 */

export const CAMERA_TIMEOUT_MS = 10000;         // 10s — was 4s; covers slow Android camera negotiation per pilot field captures.
export const CAMERA_RETRY_DELAY_MS = 350;       // small breath before auto-retry.

/**
 * Stop every track on a stream. Safe on null / no-op.
 * Always release `srcObject` on the supplied video so the OS
 * camera light goes off immediately.
 */
export function stopStream(stream, videoEl) {
  try {
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* tolerate per-track */ }
      });
    }
  } catch { /* swallow */ }
  try {
    if (videoEl) {
      try { videoEl.pause(); } catch { /* ignore */ }
      try { videoEl.srcObject = null; } catch { /* ignore */ }
    }
  } catch { /* swallow */ }
}

/**
 * Detect whether the runtime can call getUserMedia at all.
 */
export function isCameraSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.mediaDevices) return false;
    if (typeof navigator.mediaDevices.getUserMedia !== 'function') return false;
    return true;
  } catch { return false; }
}

/**
 * Map an unknown getUserMedia error to one of our typed reasons.
 * Uses DOMException.name first (the spec-compliant signal) then
 * falls back to message-string sniffing for older browsers.
 */
function _classifyError(err) {
  try {
    const name = err && err.name ? String(err.name) : '';
    const msg  = err && err.message ? String(err.message) : '';
    // DOMException.name is the spec-compliant signal — always
    // prefer it over message-string sniffing.
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError') return 'not_found';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'busy';
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'overconstrained';
    if (name === 'AbortError') return 'unknown';
    // Older browsers / non-DOMException paths — sniff the message.
    const lower = (name + ' ' + msg).toLowerCase();
    if (lower.includes('notallowed') || lower.includes('denied') || lower.includes('permission')) return 'denied';
    if (lower.includes('notfound')) return 'not_found';
    if (lower.includes('overconstrained')) return 'overconstrained';
    if (lower.includes('notreadable') || lower.includes('busy') || lower.includes('in use')) return 'busy';
    if (lower.includes('aborted')) return 'unknown';
    if (lower.includes('not supported') || lower.includes('unsupported')) return 'unsupported';
    return 'unknown';
  } catch { return 'unknown'; }
}

/**
 * Wait for the supplied <video> element to be ready for paint.
 * Resolves when EITHER `loadedmetadata` fires OR `readyState >= 2`.
 * Rejects on the timeout fence supplied by the caller.
 */
function _awaitVideoReady(video, deadlineMs) {
  return new Promise((resolve, reject) => {
    if (!video) return reject(new Error('no_video'));
    // Already ready (Safari sometimes hits this synchronously).
    if (video.readyState >= 2) return resolve();

    let settled = false;
    const onMeta = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('video_error'));
    };
    const cleanup = () => {
      try { video.removeEventListener('loadedmetadata', onMeta); } catch { /* ignore */ }
      try { video.removeEventListener('loadeddata',     onMeta); } catch { /* ignore */ }
      try { video.removeEventListener('canplay',        onMeta); } catch { /* ignore */ }
      try { video.removeEventListener('error',          onErr ); } catch { /* ignore */ }
      if (poll) clearInterval(poll);
      if (fence) clearTimeout(fence);
    };

    try { video.addEventListener('loadedmetadata', onMeta, { once: true }); } catch { /* ignore */ }
    try { video.addEventListener('loadeddata',     onMeta, { once: true }); } catch { /* ignore */ }
    try { video.addEventListener('canplay',        onMeta, { once: true }); } catch { /* ignore */ }
    try { video.addEventListener('error',          onErr,  { once: true }); } catch { /* ignore */ }

    // Polling fallback — some Android Chrome builds attach the
    // stream and bump readyState without firing the events.
    const poll = setInterval(() => {
      try {
        if (video.readyState >= 2) {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        }
      } catch { /* ignore */ }
    }, 120);

    const fence = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('timeout'));
    }, Math.max(500, deadlineMs));
  });
}

/**
 * Inner getUserMedia call wrapped in the timeout race. Pulled out
 * so we can call it twice (rear-camera attempt + generic-camera
 * fallback) without duplicating the race wiring.
 */
function _requestStream(constraints, timeoutMs) {
  return Promise.race([
    navigator.mediaDevices.getUserMedia(constraints),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), Math.max(500, timeoutMs))
    ),
  ]);
}

/**
 * Open the rear camera, attach to a <video>, and wait until the
 * preview is genuinely ready to paint.
 *
 * @param {Object} opts
 * @param {HTMLVideoElement} opts.video
 * @param {number} [opts.timeoutMs=CAMERA_TIMEOUT_MS]
 * @param {'environment'|'user'} [opts.facing='environment']
 * @param {(reason:string,detail?:object)=>void} [opts.onLog]
 * @returns {Promise<{ok:true,stream:MediaStream}|{ok:false,reason:string,message:string}>}
 */
export async function startCamera({
  video,
  timeoutMs = CAMERA_TIMEOUT_MS,
  facing    = 'environment',
  onLog     = null,
} = {}) {
  const log = (event, detail) => {
    try { if (typeof onLog === 'function') onLog(event, detail || {}); } catch { /* swallow */ }
  };

  if (!isCameraSupported()) {
    log('camera_unsupported');
    return { ok: false, reason: 'unsupported', message: 'getUserMedia not available' };
  }
  if (!video) {
    log('camera_attach_failed', { reason: 'no_video_element' });
    return { ok: false, reason: 'attach_failed', message: 'No video element' };
  }

  let stream = null;
  // Start time fence so the caller can rely on a single hard
  // deadline even if getUserMedia takes most of the budget.
  const startedAt = Date.now();
  const deadline  = () => Math.max(500, timeoutMs - (Date.now() - startedAt));

  // ─── 1. Try the spec-recommended mobile constraints. ─────
  const PRIMARY_CONSTRAINTS = {
    video: {
      facingMode: { ideal: facing },
      width:      { ideal: 1280 },
      height:     { ideal: 720 },
    },
    audio: false,
  };
  try {
    log('camera_request', { facing, timeoutMs, attempt: 'primary' });
    stream = await _requestStream(PRIMARY_CONSTRAINTS, deadline());
  } catch (err) {
    const reason = (err && err.message === 'timeout') ? 'timeout' : _classifyError(err);
    // Generic fallback: if the rear-camera/resolution constraints
    // were too strict for this device, retry with `video: true`.
    // Permission denial / NotReadable / timeout do NOT trigger
    // a retry — those are user-facing fallback states.
    if (reason === 'overconstrained' || reason === 'not_found') {
      log('camera_fallback_generic', { firstReason: reason });
      try {
        stream = await _requestStream({ video: true, audio: false }, deadline());
      } catch (err2) {
        const reason2 = (err2 && err2.message === 'timeout') ? 'timeout' : _classifyError(err2);
        log('camera_start_failed', { reason: reason2, message: (err2 && err2.message) ? String(err2.message).slice(0, 200) : '' });
        return { ok: false, reason: reason2, message: (err2 && err2.message) ? String(err2.message) : 'Camera unavailable' };
      }
    } else {
      log('camera_start_failed', { reason, message: (err && err.message) ? String(err.message).slice(0, 200) : '' });
      return { ok: false, reason, message: (err && err.message) ? String(err.message) : 'Camera unavailable' };
    }
  }

  // ─── 2. Verify we actually got a live video track. ───────
  let track = null;
  try {
    const tracks = (stream && typeof stream.getVideoTracks === 'function')
      ? stream.getVideoTracks() : [];
    track = tracks && tracks[0];
  } catch { /* fall through */ }
  if (!track || track.readyState !== 'live') {
    log('camera_start_failed', { reason: 'no_track' });
    stopStream(stream, video);
    return { ok: false, reason: 'no_track', message: 'No live video track' };
  }

  // ─── 3. Attach the stream BEFORE awaiting metadata. ──────
  try {
    // Mobile safety: muted + playsInline + autoplay attributes
    // SHOULD already be on the element from JSX, but we set them
    // here too so callers can't forget.
    try { video.muted = true; } catch { /* ignore */ }
    try { video.setAttribute('muted', ''); } catch { /* ignore */ }
    try { video.setAttribute('playsinline', ''); } catch { /* ignore */ }
    try { video.setAttribute('autoplay', ''); } catch { /* ignore */ }
    try { video.srcObject = stream; }
    catch {
      // Older Safari without srcObject — fall back to URL.createObjectURL.
      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          video.src = URL.createObjectURL(stream);
        }
      } catch {
        log('camera_attach_failed', { reason: 'srcObject_unavailable' });
        stopStream(stream, video);
        return { ok: false, reason: 'attach_failed', message: 'Could not attach stream' };
      }
    }
  } catch (err) {
    log('camera_attach_failed', { message: (err && err.message) ? String(err.message).slice(0, 200) : '' });
    stopStream(stream, video);
    return { ok: false, reason: 'attach_failed', message: (err && err.message) ? String(err.message) : 'Attach failed' };
  }

  // ─── 4. Wait for the preview to be paint-ready. ──────────
  try {
    await _awaitVideoReady(video, deadline());
  } catch (err) {
    const reason = (err && err.message === 'timeout') ? 'timeout' : 'attach_failed';
    log('camera_start_failed', { reason });
    stopStream(stream, video);
    return { ok: false, reason, message: (err && err.message) ? String(err.message) : 'Preview not ready' };
  }

  // ─── 5. Verify non-zero dimensions; one auto-retry. ──────
  // Some Android builds report metadata + readyState=2 with
  // zero videoWidth/videoHeight for ~250 ms after attach. Wait
  // briefly and re-check before declaring black-preview failure.
  if (!(video.videoWidth > 0 && video.videoHeight > 0)) {
    log('camera_zero_dim_retry', {});
    await new Promise((r) => setTimeout(r, Math.min(450, deadline())));
    if (!(video.videoWidth > 0 && video.videoHeight > 0)) {
      log('camera_start_failed', { reason: 'no_dimensions' });
      stopStream(stream, video);
      return { ok: false, reason: 'no_dimensions', message: 'Preview reported zero dimensions' };
    }
  }

  // ─── 6. Try to play(). Autoplay rejects are tolerated. ───
  try {
    const p = video.play();
    if (p && typeof p.then === 'function') {
      // Don't await past the deadline.
      await Promise.race([
        p.catch(() => null),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    }
  } catch { /* tolerate — preview is mounted, frames will paint */ }

  log('camera_started', { elapsedMs: Date.now() - startedAt });
  return { ok: true, stream };
}

/**
 * Quick non-throwing sanity check — true once the supplied video
 * element has metadata + a live track + non-zero dimensions.
 * Used by render guards so the preview only mounts once the
 * stream is genuinely ready.
 */
export function isVideoLive(video, stream) {
  try {
    if (!video || !stream) return false;
    if (video.readyState < 2) return false;
    if (!(video.videoWidth > 0 && video.videoHeight > 0)) return false;
    const tracks = (typeof stream.getVideoTracks === 'function') ? stream.getVideoTracks() : [];
    if (!tracks.length) return false;
    return tracks[0].readyState === 'live';
  } catch { return false; }
}

const _internal = Object.freeze({ _classifyError, _awaitVideoReady });
export { _internal };

export default startCamera;
