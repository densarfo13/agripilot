/**
 * photoCompress.js — compress an image File into a budget-fit
 * data URL.
 *
 * Why
 * ───
 * v1 stored raw base64 photos and capped at ~250KB; anything
 * larger was dropped. That meant most modern phone photos
 * (2-5MB) silently lost their image. This module compresses
 * down to a target byte budget by:
 *
 *   1. Down-scaling to fit `maxDim` on the longest side via
 *      a canvas resize.
 *   2. Encoding as JPEG and walking quality down (0.82 -> 0.45)
 *      until the data URL fits inside `targetBytes`.
 *
 * If the result still doesn't fit at the lowest quality we
 * resolve null so the caller can save the report without an
 * image rather than failing the whole submit.
 *
 * Strict-rule audit:
 *   * works offline (canvas + FileReader, no network)
 *   * never throws (resolves null on any failure path)
 *   * pure browser API; no third-party dependency
 */

export const COMPRESS_DEFAULTS = Object.freeze({
  // 1280px on the longest side keeps farm scout photos legible
  // while typically yielding < 200KB at 0.7 quality.
  maxDim:      1280,
  // 220KB - leaves headroom inside the typical IDB row size
  // budget while still being a usable image.
  targetBytes: 220 * 1024,
  // Quality ladder. We descend until the encode fits.
  qualities:   [0.82, 0.75, 0.65, 0.55, 0.45],
  mimeType:    'image/jpeg',
});

function _isImageFile(file) {
  if (!file || typeof file !== 'object') return false;
  if (typeof file.type !== 'string') return false;
  return file.type.startsWith('image/');
}

function _readAsImage(file) {
  return new Promise((resolve) => {
    if (!_isImageFile(file)) return resolve(null);
    if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
      return resolve(null);
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const img = new Image();
          img.onload  = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = String(reader.result || '');
        } catch { resolve(null); }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } catch { resolve(null); }
  });
}

function _drawScaled(img, maxDim) {
  if (typeof document === 'undefined' || !img) return null;
  try {
    const w = Number(img.naturalWidth)  || Number(img.width)  || 0;
    const h = Number(img.naturalHeight) || Number(img.height) || 0;
    if (w === 0 || h === 0) return null;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width  = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, dw, dh);
    return canvas;
  } catch { return null; }
}

function _encode(canvas, mime, quality) {
  try {
    const url = canvas.toDataURL(mime, quality);
    if (typeof url !== 'string' || !url) return null;
    return url;
  } catch { return null; }
}

/**
 * compressImageFile(file, opts?)
 *   -> Promise<dataUrl | null>
 *
 * Resolves null when:
 *   * file is missing or not an image
 *   * the browser environment is missing canvas / FileReader
 *   * every quality level still exceeds targetBytes
 *
 * The CALLER decides what to do with null. The OutbreakReportModal
 * stores `photoUrl: null` and saves the rest of the report.
 */
export async function compressImageFile(file, opts = {}) {
  const {
    maxDim      = COMPRESS_DEFAULTS.maxDim,
    targetBytes = COMPRESS_DEFAULTS.targetBytes,
    qualities   = COMPRESS_DEFAULTS.qualities,
    mimeType    = COMPRESS_DEFAULTS.mimeType,
  } = opts || {};

  const img = await _readAsImage(file);
  if (!img) return null;

  const canvas = _drawScaled(img, maxDim);
  if (!canvas) return null;

  // Walk the quality ladder; first fit wins.
  for (const q of qualities) {
    const url = _encode(canvas, mimeType, q);
    if (!url) continue;
    if (url.length <= targetBytes) return url;
  }

  // Last resort: return the smallest encode anyway IF the caller
  // explicitly opted in to "store something" via opts.allowOversize.
  if (opts && opts.allowOversize) {
    const lastQ = qualities[qualities.length - 1];
    const url = _encode(canvas, mimeType, lastQ);
    return url || null;
  }
  return null;
}

export const _internal = Object.freeze({
  _isImageFile, _readAsImage, _drawScaled, _encode,
});
