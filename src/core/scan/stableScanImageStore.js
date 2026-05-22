/**
 * stableScanImageStore.js — one-record-at-a-time store for the
 * captured-or-uploaded scan image.
 *
 *   import { storeStableScanImage, getCurrentScanImage,
 *            replaceScanImage, clearScanImage,
 *            isValidForAnalysis, toAnalyzerInput }
 *     from 'src/core/scan/stableScanImageStore.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small module that holds the SELECTED scan image (camera or
 *   gallery) with a stable `objectUrl` + a `dataUrlBackup` fall-
 *   back. The lifecycle rule it permanently encodes:
 *
 *     "objectUrl is revoked ONLY when the user replaces the image
 *      or leaves the Scan screen — never during analysis."
 *
 *   This fixes the production bug where a real photo's blob URL
 *   was revoked before the preview rendered, causing the broken-
 *   image "?" icon and a false "low confidence — not enough
 *   detail" result.
 *
 *   It does NOT replace SafeImage (a UI component) and does NOT
 *   replace the existing camera capture / gallery upload — it
 *   gives both flows ONE store to hand the file to.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (URL APIs injected).
 *   • Pure-ish — one in-memory record only; tests inject custom
 *     createObjectURL / revokeObjectURL so behaviour is verifiable.
 */

const _defaultCreate = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
  ? URL.createObjectURL.bind(URL)
  : (_b) => '';
const _defaultRevoke = (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function')
  ? URL.revokeObjectURL.bind(URL)
  : () => {};

// Injectable URL hooks — tests + Node environments override.
let _createUrl = _defaultCreate;
let _revokeUrl = _defaultRevoke;

/** Test hook: swap the URL implementations. */
export function _setUrlHooks(create, revoke) {
  _createUrl = typeof create === 'function' ? create : _defaultCreate;
  _revokeUrl = typeof revoke === 'function' ? revoke : _defaultRevoke;
}

/** Test hook: restore the default URL implementations. */
export function _resetUrlHooks() {
  _createUrl = _defaultCreate;
  _revokeUrl = _defaultRevoke;
}

let _current = null;

function _newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallthrough */ }
  return `img_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function _num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function _mimeOf(input) {
  if (!input) return '';
  const t = input.type || input.mimeType || '';
  return String(t).toLowerCase();
}

function _sizeOf(input) {
  if (!input) return 0;
  const s = input.size != null ? input.size : input.sizeBytes;
  return _num(s);
}

/**
 * Store the captured / uploaded image as the current scan record.
 * Replaces (and revokes) any prior record. Returns the normalised
 * record — never null when at least a File/Blob is provided.
 *
 * @param {object} input
 * @param {File|Blob} [input.file]   the raw File from camera/gallery
 * @param {Blob}      [input.blob]   raw Blob (alias for file)
 * @param {string}    [input.dataUrlBackup]
 * @param {{width:number, height:number}} [input.dimensions]
 * @returns {object|null} the stored record
 */
export function storeStableScanImage(input) {
  try {
    if (!input || typeof input !== 'object') return null;
    const fileOrBlob = input.file || input.blob || null;
    if (!fileOrBlob) return null;
    // Replace any prior record (revokes its URL).
    if (_current && _current.objectUrl) {
      try { _revokeUrl(_current.objectUrl); } catch { /* ignore */ }
    }
    let objectUrl = '';
    try { objectUrl = _createUrl(fileOrBlob) || ''; } catch { objectUrl = ''; }
    const dim = (input.dimensions && typeof input.dimensions === 'object') ? input.dimensions : {};

    _current = Object.freeze({
      id:            _newId(),
      file:          input.file || fileOrBlob,
      blob:          fileOrBlob,
      objectUrl,
      dataUrlBackup: typeof input.dataUrlBackup === 'string' ? input.dataUrlBackup : '',
      mimeType:      _mimeOf(fileOrBlob),
      size:          _sizeOf(fileOrBlob),
      width:         _num(dim.width),
      height:        _num(dim.height),
      createdAt:     Date.now(),
    });
    return _current;
  } catch {
    return null;
  }
}

/** Read the current record (null if no image selected). */
export function getCurrentScanImage() {
  return _current;
}

/** Replace the current image (same as store — for clarity at call sites). */
export function replaceScanImage(input) {
  return storeStableScanImage(input);
}

/**
 * Clear the current image and revoke its objectUrl. Call this when
 * the user navigates away from the Scan screen.
 */
export function clearScanImage() {
  try {
    if (_current && _current.objectUrl) {
      try { _revokeUrl(_current.objectUrl); } catch { /* ignore */ }
    }
  } finally {
    _current = null;
  }
}

/**
 * Update the loaded dimensions once the <img onLoad> fires. Returns
 * the updated record. Does NOT change the objectUrl.
 */
export function setImageDimensions(width, height) {
  try {
    if (!_current) return null;
    _current = Object.freeze({
      ..._current,
      width:  _num(width),
      height: _num(height),
    });
    return _current;
  } catch {
    return null;
  }
}

/**
 * The hard pre-analysis gate.
 *
 *   file/blob exists  AND  mime starts with image/  AND  size > 0
 *   AND width > 0  AND  height > 0
 *
 * Returns `{ ok, reason }` so the caller can show controlled error
 * copy (NOT a fake low-confidence result) when the image is broken.
 */
export function isValidForAnalysis(record) {
  try {
    const r = record || _current;
    if (!r) return { ok: false, reason: 'no_image' };
    if (!r.blob && !r.file) return { ok: false, reason: 'no_blob' };
    if (!r.mimeType || !r.mimeType.startsWith('image/')) {
      return { ok: false, reason: 'bad_mime' };
    }
    if (!(r.size > 0)) return { ok: false, reason: 'empty_blob' };
    if (!(r.width > 0) || !(r.height > 0)) {
      return { ok: false, reason: 'not_loaded' };
    }
    return { ok: true, reason: '' };
  } catch {
    return { ok: false, reason: 'exception' };
  }
}

/**
 * Project the record into the classifier's analyze() input shape.
 * Always returns a usable object; missing fields are null.
 */
export function toAnalyzerInput(record) {
  try {
    const r = record || _current;
    if (!r) return { imageFile: null, imageBlob: null, imageMeta: null };
    return {
      imageFile: r.file || null,
      imageBlob: r.blob || null,
      imageMeta: {
        id:        r.id,
        mimeType:  r.mimeType,
        size:      r.size,
        width:     r.width,
        height:    r.height,
        objectUrl: r.objectUrl,
        createdAt: r.createdAt,
      },
    };
  } catch {
    return { imageFile: null, imageBlob: null, imageMeta: null };
  }
}

const _module = {
  storeStableScanImage, getCurrentScanImage, replaceScanImage,
  clearScanImage, setImageDimensions,
  isValidForAnalysis, toAnalyzerInput,
  _setUrlHooks, _resetUrlHooks,
};
export default _module;
