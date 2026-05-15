/**
 * scanPreviewLifecycle — manages the local preview image's
 * object URL lifecycle so it survives the entire scan pipeline
 * without ever rendering a broken placeholder.
 *
 *   import { createPreviewSession } from
 *     '../lib/scan/scanPreviewLifecycle.js';
 *
 *   const preview = createPreviewSession();
 *   const url = preview.attach(file);
 *   //   url is a blob: URL the UI sets on the <img src=>.
 *   //   The URL stays valid through compression, upload, and
 *   //   inference. Revoking ONLY happens via preview.release()
 *   //   or createPreviewSession()'s teardown.
 *
 *   // ... pipeline runs ...
 *
 *   preview.release();   // safe-release the object URL.
 *
 *   // If the inference returns an imageUrl, prefer it:
 *   const final = preview.adoptRemote(remoteUrl);
 *   //   keeps the blob URL until the remote URL is image-decoded
 *   //   (so there's never a flash of broken placeholder), then
 *   //   revokes the blob.
 *
 * Why this exists
 *   The previous flow created an object URL inline on the
 *   capture event, then revoked it inside the same React state
 *   update that swapped to the remote URL. iOS Safari occasionally
 *   re-rendered the <img> with the now-revoked blob URL before
 *   the remote URL hit the network, producing the broken-image
 *   icon the spec calls out.
 *
 *   This session helper owns the lifecycle explicitly:
 *     - one attach per session (idempotent — re-attach revokes
 *       the previous)
 *     - release ONLY at session teardown OR on explicit handoff
 *       to a remote URL after that remote URL has decoded
 *     - revoke is wrapped in try/catch so a double-release is a
 *       no-op
 *
 * Strict-rule audit
 *   * SSR-safe. createPreviewSession() in Node returns a stub
 *     whose attach() returns null + every other method is a no-op.
 *   * Never throws.
 *   * No global state — every session is independent. A new
 *     scan run gets a new session.
 */

function _hasUrlApi() {
  try {
    return typeof URL !== 'undefined'
        && typeof URL.createObjectURL === 'function'
        && typeof URL.revokeObjectURL === 'function';
  } catch { return false; }
}

function _hasImage() {
  try { return typeof Image !== 'undefined'; } catch { return false; }
}

/**
 * Create a fresh preview session. The session OWNS at most one
 * object URL at a time + tracks whether the URL has been
 * superseded by a remote URL.
 *
 * @returns {object} session handle
 */
export function createPreviewSession() {
  let _blobUrl = null;
  let _remoteUrl = null;
  let _released = false;

  function _safeRevoke(url) {
    try { if (_hasUrlApi() && url) URL.revokeObjectURL(url); }
    catch { /* swallow */ }
  }

  /**
   * Attach a File / Blob to the session. Returns the object URL
   * the UI should set as the <img> src. Calling attach again
   * revokes the previous URL first so a retry never leaks
   * memory.
   *
   * @param {File|Blob} source
   * @returns {string|null}
   */
  function attach(source) {
    if (_released) return null;
    if (!_hasUrlApi() || !source) return null;
    try {
      if (_blobUrl) _safeRevoke(_blobUrl);
      _blobUrl = URL.createObjectURL(source);
      _remoteUrl = null;
      return _blobUrl;
    } catch { return null; }
  }

  /**
   * @returns {string|null} the current best URL to render —
   *                       remote URL when present, blob URL
   *                       otherwise, null on session release.
   */
  function getUrl() {
    if (_released) return null;
    return _remoteUrl || _blobUrl;
  }

  /**
   * Hand off the preview to a remote URL. Waits for the remote
   * URL to decode (so the UI never flashes a broken placeholder),
   * then revokes the local blob URL. Returns a Promise that
   * resolves to the URL the UI should render. If the remote URL
   * never loads, the blob URL stays in place + the function
   * resolves with the existing blob URL.
   *
   * @param {string} remoteUrl
   * @returns {Promise<string|null>}
   */
  function adoptRemote(remoteUrl) {
    if (_released) return Promise.resolve(null);
    if (typeof remoteUrl !== 'string' || !remoteUrl.trim()) {
      return Promise.resolve(_blobUrl);
    }
    return new Promise((resolve) => {
      if (!_hasImage()) {
        _remoteUrl = remoteUrl;
        const prev = _blobUrl;
        _blobUrl = null;
        _safeRevoke(prev);
        resolve(_remoteUrl);
        return;
      }
      try {
        const probe = new Image();
        let settled = false;
        const settle = (success) => {
          if (settled) return;
          settled = true;
          if (success) {
            _remoteUrl = remoteUrl;
            const prev = _blobUrl;
            _blobUrl = null;
            _safeRevoke(prev);
            resolve(_remoteUrl);
          } else {
            // Remote failed - keep the blob URL so the UI never
            // shows a broken-image placeholder.
            resolve(_blobUrl);
          }
        };
        probe.onload  = () => settle(true);
        probe.onerror = () => settle(false);
        probe.src = remoteUrl;
        // Safety net — if the probe never fires after 5s, fall
        // back to the blob URL.
        setTimeout(() => settle(false), 5000);
      } catch { resolve(_blobUrl); }
    });
  }

  /**
   * Tear down the session. Revokes any held URL + flags the
   * session as released so further attach/getUrl return null.
   * Idempotent.
   */
  function release() {
    if (_released) return;
    _released = true;
    const url = _blobUrl;
    _blobUrl = null;
    _remoteUrl = null;
    _safeRevoke(url);
  }

  /** @returns {boolean} */
  function isReleased() { return _released; }

  return Object.freeze({
    attach,
    getUrl,
    adoptRemote,
    release,
    isReleased,
  });
}

const _module = { createPreviewSession };
export default _module;
