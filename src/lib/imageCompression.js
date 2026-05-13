/**
 * imageCompression.js — client-side resize + JPEG/WebP compression
 * for scan uploads.
 *
 *   import { compressImage } from './imageCompression.js';
 *
 *   const compressed = await compressImage(file, { maxBytes: 1_500_000 });
 *   // compressed is a File (or null if compression failed)
 *
 * Why this exists
 *   Modern phone cameras emit 8-15 MB JPEGs (full-resolution 4032x3024
 *   or larger). Uploading those over a 3G/4G link in rural Africa
 *   wastes 5-15 seconds per scan and costs the farmer real data.
 *   The diagnosis engine doesn't need more than ~1500px on the long
 *   edge — anything beyond that is decorative resolution.
 *
 *   This helper:
 *     1. Reads the file into an ImageBitmap (or HTMLImageElement
 *        fallback for Safari < 17).
 *     2. Resizes to fit within MAX_DIMENSION on the long edge,
 *        preserving aspect ratio.
 *     3. Re-encodes at progressively lower quality until the
 *        output is under the target byte cap.
 *     4. Returns a new File with the original name + .jpg suffix.
 *
 *   Never throws — on any failure (Safari blocking canvas readback,
 *   missing OffscreenCanvas, encoder failure) it returns the
 *   ORIGINAL file unchanged. The caller can always count on
 *   getting *something*.
 *
 * Strict-rule audit
 *   • Pure / browser-only — no-ops in SSR (returns input).
 *   • Never throws — catches every step.
 *   • Bounded work: at most QUALITY_STEPS.length re-encodes.
 *   • No external dependencies — uses the browser's native
 *     canvas + Blob APIs.
 */

// Long-edge cap. 1500px is the sweet spot for the scan engine:
// fine enough to read leaf spots, small enough that a 4-tier
// quality ladder fits any output under ~1.5 MB.
const MAX_DIMENSION = 1500;

// Default byte cap. Spec §9 — target 1-2 MB. We aim slightly
// under the lower bound so cellular uploads stay snappy.
const DEFAULT_MAX_BYTES = 1_500_000;

// Quality ladder. The first value that lands under the byte cap
// wins. 0.85 looks indistinguishable from the original on a
// phone screen; 0.6 is the floor before JPEG artefacts start
// being visible on green leaves.
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

/**
 * Compress an image file. Returns a new File (jpeg by default)
 * or the original file when compression isn't useful / possible.
 *
 * @param {File|Blob} file
 * @param {{ maxBytes?: number, maxDimension?: number, mimeType?: 'image/jpeg'|'image/webp' }} [options]
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
  try {
    if (!file || typeof file !== 'object') return file;
    if (typeof window === 'undefined') return file;
    if (typeof document === 'undefined') return file;
    // Already small — return as-is. Saves us the decode pass.
    const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : DEFAULT_MAX_BYTES;
    if (typeof file.size === 'number' && file.size <= maxBytes) {
      return file;
    }
    const maxDimension = Number.isFinite(options.maxDimension)
      ? options.maxDimension
      : MAX_DIMENSION;
    const targetType = options.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';

    // Decode the source. Prefer createImageBitmap (faster, no
    // intermediate DOM nodes) and fall back to HTMLImageElement
    // for browsers that don't support it.
    const bitmap = await _decode(file);
    if (!bitmap) return file;

    const { width, height } = _fitWithin(bitmap.width, bitmap.height, maxDimension);

    // Canvas re-encode. OffscreenCanvas avoids touching the DOM
    // but isn't on every Safari yet; fall back to a detached
    // <canvas> for compatibility.
    const canvas = _makeCanvas(width, height);
    if (!canvas) {
      _disposeBitmap(bitmap);
      return file;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      _disposeBitmap(bitmap);
      return file;
    }
    try { ctx.drawImage(bitmap, 0, 0, width, height); }
    catch {
      _disposeBitmap(bitmap);
      return file;
    }
    _disposeBitmap(bitmap);

    // Quality ladder — keep re-encoding until the output fits.
    for (const quality of QUALITY_STEPS) {
      const blob = await _toBlob(canvas, targetType, quality);
      if (!blob) continue;
      if (blob.size <= maxBytes) {
        return _toFile(blob, file.name, targetType);
      }
    }
    // Even at the lowest quality the output was over the cap —
    // return the lowest-quality version anyway (still smaller
    // than the original).
    const fallback = await _toBlob(canvas, targetType, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
    if (fallback && (!file.size || fallback.size < file.size)) {
      return _toFile(fallback, file.name, targetType);
    }
    return file;
  } catch {
    return file;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function _fitWithin(srcW, srcH, maxDim) {
  if (srcW <= maxDim && srcH <= maxDim) return { width: srcW, height: srcH };
  if (srcW >= srcH) {
    const scale = maxDim / srcW;
    return { width: maxDim, height: Math.round(srcH * scale) };
  }
  const scale = maxDim / srcH;
  return { width: Math.round(srcW * scale), height: maxDim };
}

async function _decode(file) {
  try {
    if (typeof createImageBitmap === 'function') {
      return await createImageBitmap(file);
    }
  } catch { /* fall through to <img> path */ }
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error('image_decode_failed'));
      img.src = url;
    });
    // Free the ObjectURL once the image has decoded — the bitmap
    // is held by the <img> element until we draw it.
    try { URL.revokeObjectURL(url); } catch { /* swallow */ }
    return img;
  } catch {
    return null;
  }
}

function _disposeBitmap(b) {
  // ImageBitmap has a close() method; HTMLImageElement doesn't.
  try { if (b && typeof b.close === 'function') b.close(); } catch { /* swallow */ }
}

function _makeCanvas(w, h) {
  try {
    if (typeof OffscreenCanvas === 'function') {
      return new OffscreenCanvas(w, h);
    }
  } catch { /* fall through */ }
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  } catch {
    return null;
  }
}

function _toBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    try {
      // OffscreenCanvas exposes convertToBlob; HTMLCanvasElement
      // uses toBlob(callback). Detect by method presence.
      if (typeof canvas.convertToBlob === 'function') {
        canvas.convertToBlob({ type, quality })
          .then((b) => resolve(b || null))
          .catch(() => resolve(null));
        return;
      }
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((b) => resolve(b || null), type, quality);
        return;
      }
      resolve(null);
    } catch { resolve(null); }
  });
}

function _toFile(blob, originalName, mimeType) {
  const baseName = (originalName && typeof originalName === 'string')
    ? originalName.replace(/\.[^.]+$/, '')
    : 'scan';
  const ext = mimeType === 'image/webp' ? '.webp' : '.jpg';
  try {
    return new File([blob], baseName + ext, { type: mimeType });
  } catch {
    // Older Safari sometimes lacks File constructor — return
    // the blob and let the upload path handle it.
    return blob;
  }
}

const _module = { compressImage };
export default _module;
