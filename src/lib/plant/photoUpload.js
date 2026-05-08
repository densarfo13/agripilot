/**
 * photoUpload.js — file → resized + compressed dataURL for plant photos.
 *
 *   import { compressImageFile, MAX_PHOTO_BYTES } from '../lib/plant/photoUpload.js';
 *
 *   const dataUrl = await compressImageFile(file, { maxDim: 800, quality: 0.82 });
 *   if (dataUrl) plantIdentity.setField('photo', dataUrl);
 *
 * Pipeline:
 *   File → readAsDataURL → <img> load → <canvas> resize → toDataURL JPEG
 *
 * Targets:
 *   • max 800 × 800 px (preserves aspect ratio; centers / fits longest edge)
 *   • JPEG quality 0.82 default; degrades to 0.6 if output > MAX_PHOTO_BYTES
 *   • output capped at 1.5 MB (mirrors plantStore's existing inline cap)
 *
 * Strict-rule audit
 *   • Pure module — no React, no I/O beyond canvas + FileReader.
 *   • Never throws — every error path resolves to null.
 *   • Always returns either a dataURL string or null (no Blob, no File).
 *   • Validates input type (image/jpeg | image/png | image/webp | image/heic).
 *   • Rejects oversized source files (> 12 MB) before reading them.
 *   • SSR-safe — guards every browser API behind typeof checks.
 */

export const MAX_PHOTO_BYTES = 1_500_000;          // 1.5 MB inline cap (matches plantStore)
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;  // 12 MB hard limit on input file
export const ACCEPTED_TYPES = Object.freeze([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

const DEFAULT_OPTS = Object.freeze({
  maxDim:        800,
  quality:       0.82,
  fallbackQuality: 0.60,
  outputType:    'image/jpeg',
});

// ─── Helpers ──────────────────────────────────────────────────────

function _isBrowser() {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && typeof FileReader !== 'undefined';
}

function _validateFile(file) {
  if (!file || !(file instanceof Blob)) return 'no-file';
  if (file.size > MAX_SOURCE_BYTES) return 'too-large';
  const t = String(file.type || '').toLowerCase();
  if (t && !ACCEPTED_TYPES.includes(t)) return 'bad-type';
  return null; // ok
}

function _readAsDataUrl(file) {
  return new Promise((resolve) => {
    try {
      const fr = new FileReader();
      fr.onload  = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.onabort = () => resolve(null);
      fr.readAsDataURL(file);
    } catch { resolve(null); }
  });
}

function _loadImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(null); return; }
    try {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      // Decode async where supported so we never block the main thread
      // on a huge JPEG.
      img.decoding = 'async';
      img.src = dataUrl;
    } catch { resolve(null); }
  });
}

function _approxDataUrlBytes(dataUrl) {
  // base64 expands binary by ~4/3. Sub the comma+header (~30 chars).
  if (typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const b64 = dataUrl.slice(commaIdx + 1);
  return Math.floor(b64.length * 3 / 4);
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * compressImageFile(file, opts?) → Promise<string|null>
 *
 * Returns a dataURL <= MAX_PHOTO_BYTES, or null on any failure.
 *
 * @param {File|Blob} file
 * @param {object} [opts]
 * @param {number} [opts.maxDim=800]            longest-edge ceiling in pixels
 * @param {number} [opts.quality=0.82]          first-pass JPEG quality
 * @param {number} [opts.fallbackQuality=0.60]  retry quality if first-pass too big
 */
export async function compressImageFile(file, opts = {}) {
  if (!_isBrowser()) return null;

  const errKind = _validateFile(file);
  if (errKind) return null;

  const o = { ...DEFAULT_OPTS, ...(opts && typeof opts === 'object' ? opts : {}) };

  const sourceUrl = await _readAsDataUrl(file);
  if (!sourceUrl) return null;

  const img = await _loadImage(sourceUrl);
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;

  // Compute target dims — preserve aspect, fit longest edge to maxDim.
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale   = longest > o.maxDim ? (o.maxDim / longest) : 1;
  const targetW = Math.max(1, Math.round(img.naturalWidth  * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  // Build the canvas + draw.
  let dataUrl = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // White background under transparent PNGs so JPEG output stays clean.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    dataUrl = canvas.toDataURL(o.outputType, o.quality);
  } catch { return null; }

  if (!dataUrl) return null;

  // Size check — retry at lower quality if the first pass is too big.
  if (_approxDataUrlBytes(dataUrl) > MAX_PHOTO_BYTES) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      dataUrl = canvas.toDataURL(o.outputType, o.fallbackQuality);
    } catch { return null; }
  }

  // Final cap — refuse to return a payload over the budget. Caller
  // should show a "try a smaller photo" message; null is the
  // canonical "couldn't compress enough" sentinel.
  if (!dataUrl || _approxDataUrlBytes(dataUrl) > MAX_PHOTO_BYTES) return null;
  return dataUrl;
}

/**
 * isAcceptedImageType(file) — used by the file input's `accept`
 * attribute as a JS-side double-check.
 */
export function isAcceptedImageType(file) {
  if (!file || !file.type) return false;
  return ACCEPTED_TYPES.includes(String(file.type).toLowerCase());
}

export const _internal = Object.freeze({
  DEFAULT_OPTS,
  _validateFile,
  _approxDataUrlBytes,
  _readAsDataUrl,
  _loadImage,
});
