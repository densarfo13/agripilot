/**
 * imageNormalization.js — single-pass image normalization for the
 * scan pipeline.
 *
 *   import { normalizeScanImage, isHeicFile } from
 *     'src/core/scan/imageNormalization.js';
 *
 *   const out = await normalizeScanImage(file, {
 *     maxDim:  2048,
 *     quality: 0.82,
 *   });
 *   // out = {
 *   //   ok, normalizedBlob, normalizedDataUrl, mimeType,
 *   //   width, height, originalMime, isHeic, exifRotated, reason,
 *   // }
 *
 * Why this module exists
 * ──────────────────────
 *   iPhone Safari is the dominant scan platform and ships HEIC by
 *   default. The existing gallery picker rejects HEIC at the mime
 *   gate, which surfaces as "Please use a JPEG, PNG, or WebP photo"
 *   on real user devices. This module:
 *
 *     1. Detects HEIC at file-signature level (mime + magic bytes)
 *     2. Decodes HEIC via the browser's <img> tag (Safari ≥ 17 can,
 *        Chrome / Android Chrome cannot — for those we surface a
 *        friendly "convert to JPEG" hint upstream)
 *     3. Reads EXIF orientation and rotates accordingly so a
 *        portrait photo doesn't render sideways
 *     4. Downscales to max 2048 px on the longest side
 *     5. Re-encodes to JPEG at 0.82 quality
 *     6. Returns a fresh Blob + dataURL so the caller can hand BOTH
 *        to the upload + preview slot without further work
 *
 *   The function NEVER throws. On any failure it returns
 *   `{ ok: false, reason }` and the caller falls back to the
 *   original file (which keeps the existing path working).
 *
 * Strict-rule audit
 *   • Pure async — no module-level state.
 *   • SSR-safe — guarded `typeof document` / `typeof FileReader`.
 *   • All canvas / FileReader / Image calls wrapped in try/catch.
 */

// Heic mime variants Safari and Apple Photos emit.
const _HEIC_MIME_RE = /^image\/(heic|heif|heic-sequence|heif-sequence)$/i;

// Heic magic bytes: starts with `ftyp` at offset 4, then a brand of
// heic / heix / mif1 / msf1 / hevc / hevx. Returning true on any
// of those keeps the conversion path safe — false positives just
// run the JPEG path which is also fine.
const _HEIC_BRANDS = new Set([
  'heic', 'heix', 'heim', 'heis', 'hevc', 'hevx',
  'mif1', 'msf1',
]);

/**
 * Quick mime + filename check. Cheap, runs synchronously.
 */
export function isHeicMime(mime) {
  return typeof mime === 'string' && _HEIC_MIME_RE.test(mime);
}

/**
 * Filename extension check. iOS Safari sometimes drops the mime and
 * leaves only the .heic / .heif extension.
 */
export function isHeicFilename(name) {
  if (typeof name !== 'string') return false;
  return /\.(heic|heif)$/i.test(name);
}

/**
 * Read the first 32 bytes and check the ISO BMFF brand. Returns
 * `false` for any file < 12 bytes or any read error.
 */
export async function isHeicByMagic(blob) {
  try {
    if (!blob || typeof blob.slice !== 'function') return false;
    const head = blob.slice(0, 32);
    const buf = await head.arrayBuffer().catch(() => null);
    if (!buf) return false;
    const u8 = new Uint8Array(buf);
    if (u8.length < 12) return false;
    // bytes 4..8 must be 'ftyp'
    if (u8[4] !== 0x66 || u8[5] !== 0x74 || u8[6] !== 0x79 || u8[7] !== 0x70) return false;
    const brand = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]).toLowerCase();
    return _HEIC_BRANDS.has(brand);
  } catch { return false; }
}

/**
 * Combined HEIC predicate — checks mime, filename, magic bytes.
 * Use this when you need a high-confidence answer before deciding
 * to run the JPEG re-encode path.
 */
export async function isHeicFile(file) {
  try {
    if (!file) return false;
    if (isHeicMime(file.type)) return true;
    if (isHeicFilename(file.name)) return true;
    return await isHeicByMagic(file);
  } catch { return false; }
}

/**
 * Read EXIF orientation from a JPEG blob. Returns 1 (no rotation)
 * for anything that isn't a recognizable JPEG EXIF segment so the
 * caller can blindly trust the value.
 *
 * Orientation values per EXIF spec:
 *   1 = top-left (no rotation)
 *   3 = bottom-right (180°)
 *   6 = right-top (90° CW)
 *   8 = left-bottom (270° CW / 90° CCW)
 *
 * The 4 mirror values (2,4,5,7) are uncommon for camera photos;
 * we treat them as 1 to keep the math simple. Real-world iPhone
 * captures only ever produce 1/3/6/8.
 */
export async function readExifOrientation(blob) {
  try {
    if (!blob || typeof blob.slice !== 'function') return 1;
    const head = blob.slice(0, 65536);
    const buf = await head.arrayBuffer().catch(() => null);
    if (!buf) return 1;
    const view = new DataView(buf);
    if (view.byteLength < 4) return 1;
    if (view.getUint16(0) !== 0xFFD8) return 1; // not a JPEG SOI
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xFFE1) { // APP1 (EXIF)
        const segLen = view.getUint16(offset);
        // EXIF marker 'Exif\0\0' at offset+2
        if (view.getUint32(offset + 2) !== 0x45786966) return 1;
        const tiffOffset = offset + 8;
        const little = view.getUint16(tiffOffset) === 0x4949;
        const get16 = (o) => view.getUint16(o, little);
        const get32 = (o) => view.getUint32(o, little);
        if (get16(tiffOffset + 2) !== 0x002A) return 1;
        const firstIfd = tiffOffset + get32(tiffOffset + 4);
        const tagCount = get16(firstIfd);
        for (let i = 0; i < tagCount; i++) {
          const entry = firstIfd + 2 + i * 12;
          const tag = get16(entry);
          if (tag === 0x0112) { // Orientation
            const value = get16(entry + 8);
            if (value >= 1 && value <= 8) return value;
            return 1;
          }
        }
        return 1;
      } else if ((marker & 0xFF00) !== 0xFF00) {
        return 1; // malformed
      } else {
        const segLen = view.getUint16(offset);
        if (!Number.isFinite(segLen) || segLen < 2) return 1;
        offset += segLen;
      }
    }
    return 1;
  } catch { return 1; }
}

function _applyExifRotation(ctx, orientation, w, h) {
  // Translate to centre, rotate, translate back. All canvases at
  // this point have the FINAL width/height set; ctx must rotate
  // and then drawImage at 0,0 using the SOURCE dimensions.
  switch (orientation) {
    case 3: ctx.translate(w, h); ctx.rotate(Math.PI); break;
    case 6: ctx.translate(h, 0); ctx.rotate(Math.PI / 2); break;
    case 8: ctx.translate(0, w); ctx.rotate(-Math.PI / 2); break;
    default: /* no rotation */
  }
}

/**
 * Decode a blob into an HTMLImageElement. Returns null on any
 * decode failure (HEIC on Chrome, corrupted bytes, etc.).
 */
function _decodeImage(blob) {
  return new Promise((resolve) => {
    try {
      if (typeof URL === 'undefined' || typeof Image === 'undefined') return resolve(null);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const cleanup = () => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      };
      img.onload = () => {
        // We DELIBERATELY revoke after decode here — the decoded
        // Image is held in JS heap and no longer references the
        // blob URL once `naturalWidth` is non-zero.
        const ok = img.naturalWidth > 0 && img.naturalHeight > 0;
        cleanup();
        resolve(ok ? img : null);
      };
      img.onerror = () => { cleanup(); resolve(null); };
      img.src = url;
    } catch { resolve(null); }
  });
}

/**
 * Compute the downscaled target dimensions. Maintains aspect ratio
 * and never upscales — if the source is smaller than maxDim on
 * both sides, the original dimensions are returned.
 */
export function computeTargetDimensions(srcW, srcH, maxDim) {
  const sw = Number(srcW) || 0;
  const sh = Number(srcH) || 0;
  const md = Number(maxDim) || 2048;
  if (sw <= 0 || sh <= 0) return { width: 0, height: 0, scale: 1 };
  const longest = Math.max(sw, sh);
  if (longest <= md) return { width: sw, height: sh, scale: 1 };
  const scale = md / longest;
  return {
    width:  Math.max(1, Math.round(sw * scale)),
    height: Math.max(1, Math.round(sh * scale)),
    scale,
  };
}

/**
 * Render image to a canvas, applying EXIF orientation + the target
 * dimensions, and return a JPEG dataURL + Blob at the requested
 * quality. Never throws.
 */
async function _renderToJpeg(img, orientation, targetW, targetH, quality) {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    // Swap canvas dimensions for the 6/8 orientations.
    const swap = (orientation === 6 || orientation === 8);
    canvas.width  = swap ? targetH : targetW;
    canvas.height = swap ? targetW : targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    _applyExifRotation(ctx, orientation, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const q = Math.max(0.1, Math.min(1, Number(quality) || 0.82));
    let dataUrl = '';
    try { dataUrl = canvas.toDataURL('image/jpeg', q); }
    catch { dataUrl = ''; }
    if (!dataUrl) return null;
    let blob = null;
    try {
      blob = await new Promise((resolve) => {
        try { canvas.toBlob((b) => resolve(b), 'image/jpeg', q); }
        catch { resolve(null); }
      });
    } catch { blob = null; }
    return { dataUrl, blob, width: canvas.width, height: canvas.height };
  } catch { return null; }
}

/**
 * One-shot normalization. Handles HEIC, EXIF orientation, downscale,
 * and JPEG re-encode. Returns a stable shape the caller can branch
 * on without exception handling.
 *
 * @param {File|Blob} file
 * @param {object} [opts]
 * @param {number} [opts.maxDim=2048]   max pixels on the longest side
 * @param {number} [opts.quality=0.82]  JPEG quality (0..1)
 * @param {number} [opts.maxBytes=12_000_000]  reject huge files early
 */
export async function normalizeScanImage(file, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const maxDim   = Number(o.maxDim)   > 0 ? Number(o.maxDim)   : 2048;
  const quality  = Number(o.quality)  > 0 ? Number(o.quality)  : 0.82;
  const maxBytes = Number(o.maxBytes) > 0 ? Number(o.maxBytes) : 12_000_000;
  const originalMime = (file && typeof file.type === 'string') ? file.type : '';
  const fallback = (reason) => Object.freeze({
    ok: false,
    normalizedBlob:    null,
    normalizedDataUrl: '',
    mimeType:          'image/jpeg',
    width:             0,
    height:            0,
    originalMime,
    isHeic:            false,
    exifRotated:       false,
    reason,
  });
  try {
    if (!file) return fallback('no_file');
    if (typeof file.size === 'number' && file.size > maxBytes) {
      return fallback('too_large');
    }
    const heic = await isHeicFile(file);
    const orientation = heic ? 1 : await readExifOrientation(file);
    const img = await _decodeImage(file);
    if (!img) {
      // If HEIC and the browser couldn't decode, we surface a
      // distinct reason so the UI shows the "convert to JPEG"
      // hint rather than "photo could not be loaded".
      return fallback(heic ? 'heic_decode_unsupported' : 'decode_failed');
    }
    const target = computeTargetDimensions(img.naturalWidth, img.naturalHeight, maxDim);
    if (target.width <= 0 || target.height <= 0) return fallback('zero_dim');
    const rendered = await _renderToJpeg(img, orientation, target.width, target.height, quality);
    if (!rendered || !rendered.dataUrl) return fallback('render_failed');
    return Object.freeze({
      ok: true,
      normalizedBlob:    rendered.blob || null,
      normalizedDataUrl: rendered.dataUrl,
      mimeType:          'image/jpeg',
      width:             rendered.width,
      height:            rendered.height,
      originalMime,
      isHeic:            heic,
      exifRotated:       orientation !== 1,
      reason:            '',
    });
  } catch {
    return fallback('exception');
  }
}

const _module = {
  isHeicMime, isHeicFilename, isHeicByMagic, isHeicFile,
  readExifOrientation, computeTargetDimensions, normalizeScanImage,
};
export default _module;
